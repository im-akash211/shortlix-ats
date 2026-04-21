"""
Public employee-portal views — no authentication required.
"""

import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.candidates.models import Candidate, CandidateJobMapping, ResumeFile
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

        # Employees are not in the User table — use first admin as system owner
        admin_user = User.objects.filter(role='admin', is_active=True).first()
        if not admin_user:
            return Response(
                {'detail': 'System not configured. Please contact an administrator.'},
                status=500,
            )

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

        # Build candidate fields
        first_name = (parsed.get('first_name') or '').strip()
        last_name  = (parsed.get('last_name')  or '').strip()
        full_name  = f'{first_name} {last_name}'.strip() or resume_file.name
        email      = (parsed.get('email') or '').strip()

        if not email:
            return Response(
                {'detail': 'Could not extract an email address from the resume. '
                           'Please ensure the resume contains a valid email.'},
                status=400,
            )

        experience = parsed.get('experience_years')
        try:
            experience = float(experience) if experience else None
        except (ValueError, TypeError):
            experience = None

        with transaction.atomic():
            # Re-use existing candidate if email matches
            existing = Candidate.objects.filter(email__iexact=email).first()
            if existing:
                candidate = existing
                created = False
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
                    sub_source=f'Referred by {employee_name} (ID: {employee_id})',
                    parsed_data=parsed,
                    parsing_status='done',
                    created_by=admin_user,
                )
                resume_file.seek(0)
                ResumeFile.objects.create(
                    candidate=candidate,
                    uploaded_by=admin_user,
                    file=resume_file,
                    original_filename=resume_file.name,
                    file_type=file_type,
                    file_size_bytes=resume_file.size,
                    raw_text=raw_text,
                    is_latest=True,
                )
                created = True

            # Assign to job at APPLIED stage (idempotent)
            CandidateJobMapping.objects.get_or_create(
                candidate=candidate,
                job=job,
                defaults={'macro_stage': 'APPLIED'},
            )

        # Notify all recruiters, hiring managers and admins
        recipients = User.objects.filter(
            role__in=['recruiter', 'hiring_manager', 'admin'],
            is_active=True,
        )
        msg = (
            f'{candidate.full_name} has been referred for "{job.title}" '
            f'by {employee_name} (Employee ID: {employee_id})'
        )
        InAppNotification.objects.bulk_create([
            InAppNotification(
                recipient=u,
                sender=None,
                notification_type='referral',
                message=msg,
                candidate=candidate,
            )
            for u in recipients
        ])

        logger.info(
            'Employee referral: %s referred %s for job %s (new=%s)',
            employee_name, candidate.full_name, job.title, created,
        )

        return Response({
            'candidate_id': str(candidate.id),
            'candidate_name': candidate.full_name,
            'job_title': job.title,
            'is_new': created,
        }, status=201)
