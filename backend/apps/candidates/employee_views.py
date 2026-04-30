"""
Public employee-portal views — no authentication required.
"""

import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.candidates.models import Candidate, CandidateJobMapping, Referral, ResumeFile
from apps.jobs.models import Job
from apps.notifications.models import InAppNotification

logger = logging.getLogger(__name__)


class EmployeeJobListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        jobs = (
            Job.objects.filter(status='open')
            .select_related('department', 'hiring_manager')
            .order_by('-created_at')
        )
        data = [
            {
                'id': str(j.id),
                'title': j.title,
                'department': j.department.name if j.department else None,
                'location': j.location or '',
                'job_code': j.job_code or '',
                'experience_min': j.experience_min,
                'experience_max': j.experience_max,
                'skills_required': j.skills_required or [],
            }
            for j in jobs
        ]
        return Response(data)


class EmployeeReferralView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser]

    def post(self, request):
        from apps.resumes.services.text_extractor import extract_text, TextExtractionError
        from apps.resumes.services.llm_parser import parse_resume_with_llm, LLMParsingError

        employee_name = request.data.get('employee_name', '').strip()
        employee_id   = request.data.get('employee_id', '').strip()
        job_id        = request.data.get('job_id', '').strip()
        resume_file   = request.FILES.get('resume')

        if not all([employee_name, employee_id, job_id, resume_file]):
            return Response(
                {'detail': 'employee_name, employee_id, job_id and resume are all required.'},
                status=400,
            )

        job = get_object_or_404(Job, pk=job_id, status='open')

        fname = resume_file.name.lower()
        if fname.endswith('.pdf'):
            file_type = 'pdf'
        elif fname.endswith('.docx'):
            file_type = 'docx'
        else:
            return Response({'detail': 'Only PDF and DOCX resumes are accepted.'}, status=400)

        # Extract text
        try:
            resume_file.seek(0)
            raw_text = extract_text(resume_file, file_type)
        except TextExtractionError as exc:
            return Response({'detail': f'Could not read resume: {exc}'}, status=400)

        if not raw_text or len(raw_text.strip()) < 20:
            return Response(
                {'detail': 'Resume appears to be empty or scanned. Please upload a text-based PDF.'},
                status=400,
            )

        # Parse with LLM
        try:
            parsed = parse_resume_with_llm(raw_text)
        except LLMParsingError as exc:
            return Response({'detail': f'Failed to parse resume: {exc}'}, status=500)

        # Store as a pending referral — admin must approve
        resume_file.seek(0)
        referral = Referral.objects.create(
            job=job,
            employee_name=employee_name,
            employee_id=employee_id,
            parsed_data=parsed,
            raw_text=raw_text,
            resume_file=resume_file,
            original_filename=resume_file.name,
            file_type=file_type,
            file_size=resume_file.size,
            status=Referral.STATUS_PENDING,
        )

        # Notify admins only
        admins = User.objects.filter(role='admin', is_active=True)
        candidate_name = (
            f"{(parsed.get('first_name') or '').strip()} {(parsed.get('last_name') or '').strip()}".strip()
            or resume_file.name
        )
        msg = (
            f'New referral: {candidate_name} for "{job.title}" '
            f'by {employee_name} (Employee ID: {employee_id}). Awaiting your approval.'
        )
        InAppNotification.objects.bulk_create([
            InAppNotification(
                recipient=u,
                sender=None,
                notification_type='referral',
                message=msg,
                candidate=None,
            )
            for u in admins
        ])
        from apps.notifications.utils import notify_referral_submitted
        notify_referral_submitted(referral, list(admins))

        logger.info(
            'Employee referral saved (pending): %s referred for job %s by %s',
            candidate_name, job.title, employee_name,
        )

        return Response({
            'referral_id': str(referral.id),
            'candidate_name': candidate_name,
            'job_title': job.title,
            'status': 'pending',
        }, status=201)


# ---- Admin referral management ---- #

class ReferralListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Forbidden.'}, status=403)

        status_filter = request.query_params.get('status', 'pending')
        qs = (
            Referral.objects.filter(status=status_filter)
            .select_related('job', 'candidate', 'reviewed_by')
            .order_by('-created_at')
        )
        data = [_referral_data(r, request) for r in qs]
        return Response(data)


class ReferralApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone

        if request.user.role != 'admin':
            return Response({'detail': 'Forbidden.'}, status=403)

        referral = get_object_or_404(Referral, pk=pk, status=Referral.STATUS_PENDING)
        parsed = referral.parsed_data
        admin_user = request.user

        first_name = (parsed.get('first_name') or '').strip()
        last_name  = (parsed.get('last_name')  or '').strip()
        full_name  = f'{first_name} {last_name}'.strip() or referral.original_filename
        email      = (parsed.get('email') or '').strip()

        if not email:
            return Response(
                {'detail': 'Resume has no email address. Cannot create candidate.'},
                status=400,
            )

        experience = parsed.get('experience_years')
        try:
            experience = float(experience) if experience else None
        except (ValueError, TypeError):
            experience = None

        with transaction.atomic():
            existing = Candidate.objects.filter(email__iexact=email).first()
            if existing:
                candidate = existing
            else:
                candidate = Candidate.objects.create(
                    full_name=full_name,
                    email=email,
                    phone=(parsed.get('phone') or '').strip(),
                    designation=(parsed.get('designation') or '').strip(),
                    current_employer=(parsed.get('current_company') or '').strip(),
                    total_experience_years=experience,
                    skills=parsed.get('skills') or [],
                    source='referral',
                    sub_source=(
                        f'Referred by {referral.employee_name} (ID: {referral.employee_id})'
                    ),
                    parsed_data=parsed,
                    parsing_status='done',
                    created_by=admin_user,
                )
                if referral.resume_file:
                    ResumeFile.objects.create(
                        candidate=candidate,
                        uploaded_by=admin_user,
                        file=referral.resume_file,
                        original_filename=referral.original_filename,
                        file_type=referral.file_type,
                        file_size_bytes=referral.file_size or 0,
                        raw_text=referral.raw_text,
                        is_latest=True,
                    )

            CandidateJobMapping.objects.get_or_create(
                candidate=candidate,
                job=referral.job,
                defaults={'macro_stage': 'APPLIED'},
            )

            referral.status = Referral.STATUS_APPROVED
            referral.candidate = candidate
            referral.reviewed_by = admin_user
            referral.reviewed_at = timezone.now()
            referral.save(update_fields=['status', 'candidate', 'reviewed_by', 'reviewed_at', 'updated_at'])

        # Notify recruiters attached to the job
        job = referral.job
        recruiter_ids = set()
        if job.created_by and job.created_by.role == 'recruiter' and job.created_by.is_active:
            recruiter_ids.add(job.created_by.id)
        recruiter_ids.update(
            job.collaborators.filter(user__role='recruiter', user__is_active=True)
            .values_list('user_id', flat=True)
        )
        if recruiter_ids:
            recruiters = User.objects.filter(id__in=recruiter_ids)
            notify_msg = (
                f'{candidate.full_name} has been approved and added to the pipeline for '
                f'"{job.title}" — referred by {referral.employee_name} (ID: {referral.employee_id}).'
            )
            InAppNotification.objects.bulk_create([
                InAppNotification(
                    recipient=u,
                    sender=admin_user,
                    notification_type='referral',
                    message=notify_msg,
                    candidate=candidate,
                )
                for u in recruiters
            ])
            from apps.notifications.utils import notify_referral_approved
            notify_referral_approved(referral, list(recruiters))

        logger.info(
            'Referral %s approved by %s — candidate %s created/linked',
            referral.id, admin_user.email, candidate.id,
        )
        return Response({
            'detail': 'Referral approved.',
            'candidate_id': str(candidate.id),
            'candidate_name': candidate.full_name,
        })


class ReferralDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone

        if request.user.role != 'admin':
            return Response({'detail': 'Forbidden.'}, status=403)

        referral = get_object_or_404(Referral, pk=pk, status=Referral.STATUS_PENDING)
        referral.status = Referral.STATUS_DECLINED
        referral.reviewed_by = request.user
        referral.reviewed_at = timezone.now()
        referral.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
        from apps.notifications.utils import notify_referral_declined
        notify_referral_declined(referral)

        logger.info('Referral %s declined by %s', referral.id, request.user.email)
        return Response({'detail': 'Referral declined.'})


def _referral_data(r, request=None):
    parsed = r.parsed_data or {}
    candidate_name = (
        f"{(parsed.get('first_name') or '').strip()} {(parsed.get('last_name') or '').strip()}".strip()
        or r.original_filename
    )

    resume_url = None
    if r.resume_file:
        try:
            url = r.resume_file.url
            if request and url.startswith('/'):
                resume_url = request.build_absolute_uri(url)
            else:
                resume_url = url
        except Exception:
            pass

    return {
        'id': str(r.id),
        'status': r.status,
        'employee_name': r.employee_name,
        'employee_id': r.employee_id,
        'job_id': str(r.job_id),
        'job_title': r.job.title,
        'job_code': r.job.job_code or '',
        'candidate_name': candidate_name,
        'candidate_email': parsed.get('email', ''),
        'candidate_phone': parsed.get('phone', ''),
        'candidate_designation': parsed.get('designation', ''),
        'candidate_experience': parsed.get('experience_years'),
        'candidate_skills': parsed.get('skills') or [],
        'resume_url': resume_url,
        'original_filename': r.original_filename,
        'candidate_id': str(r.candidate_id) if r.candidate_id else None,
        'reviewed_by': r.reviewed_by.full_name if r.reviewed_by else None,
        'reviewed_at': r.reviewed_at.isoformat() if r.reviewed_at else None,
        'created_at': r.created_at.isoformat(),
    }
