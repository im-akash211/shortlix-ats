from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from apps.core.permissions import rbac_perm
from .models import (
    Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote, CandidateNoteHistory,
    CandidateReminder, VALID_TRANSITIONS, ROUND_PROGRESSION, ROUND_CHOICES, SCREENING_STATUS_CHOICES,
    CandidateJobComment,
)
from .serializers import (
    CandidateListSerializer, CandidateDetailSerializer, CandidateCreateSerializer,
    CandidateJobMappingSerializer, CandidateNoteSerializer,
    CandidateJobCommentSerializer, CandidateReminderSerializer,
)
from apps.accounts.models import User
from apps.notifications.models import InAppNotification


class CandidateListCreateView(generics.ListCreateAPIView):
    search_fields = ['full_name', 'email', 'phone', 'skills', 'tags']
    ordering_fields = ['full_name', 'created_at', 'total_experience_years']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [rbac_perm('MANAGE_CANDIDATES')()]
        return [rbac_perm('VIEW_CANDIDATES')()]

    def get_queryset(self):
        qs = Candidate.objects.prefetch_related('job_mappings__job').all()
        params = self.request.query_params

        source_str = params.get('source', '')
        stage_str  = params.get('stage', '')
        job_id     = params.get('job', '')
        exp_min    = params.get('exp_min', '')
        exp_max    = params.get('exp_max', '')
        date_from  = params.get('date_from', '')
        date_to    = params.get('date_to', '')
        tags_str   = params.get('tags', '')

        if source_str:
            qs = qs.filter(source__in=[s for s in source_str.split(',') if s])
        if stage_str:
            qs = qs.filter(
                job_mappings__macro_stage__in=[s for s in stage_str.split(',') if s]
            ).distinct()
        if job_id:
            qs = qs.filter(job_mappings__job_id=job_id).distinct()
        if tags_str:
            # Overlap search: matches if any of the requested tags are present in the candidate's tags array
            qs = qs.filter(tags__overlap=[t for t in tags_str.split(',') if t])
        if exp_min:
            try:
                qs = qs.filter(total_experience_years__gte=float(exp_min))
            except ValueError:
                pass
        if exp_max:
            try:
                qs = qs.filter(total_experience_years__lte=float(exp_max))
            except ValueError:
                pass
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CandidateCreateSerializer
        return CandidateListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CandidateDetailView(generics.RetrieveUpdateAPIView):
    queryset = Candidate.objects.prefetch_related('job_mappings__job', 'notes__user', 'resume_files').all()

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [rbac_perm('MANAGE_CANDIDATES')()]
        return [rbac_perm('VIEW_CANDIDATES')()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return CandidateCreateSerializer
        return CandidateDetailSerializer


class CandidateDeleteView(APIView):
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]

    def delete(self, request, pk):
        candidate = generics.get_object_or_404(Candidate, pk=pk)
        candidate.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CandidateNoteListCreateView(generics.ListCreateAPIView):
    serializer_class = CandidateNoteSerializer
    permission_classes = [rbac_perm('VIEW_CANDIDATES')]

    def get_queryset(self):
        return CandidateNote.objects.filter(candidate_id=self.kwargs['pk']).select_related('user').prefetch_related('history')

    def perform_create(self, serializer):
        serializer.save(candidate_id=self.kwargs['pk'], user=self.request.user)


class CandidateNoteDetailView(APIView):
    def patch(self, request, pk, note_id):
        note = generics.get_object_or_404(CandidateNote, pk=note_id, candidate_id=pk)
        if note.user_id != request.user.id:
            return Response({'detail': 'You can only edit your own notes.'}, status=status.HTTP_403_FORBIDDEN)
        new_content = request.data.get('content', '').strip()
        if not new_content:
            return Response({'detail': 'Content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
        CandidateNoteHistory.objects.create(note=note, content=note.content)
        note.content = new_content
        note.is_edited = True
        note.save()
        return Response(CandidateNoteSerializer(note).data)

    def delete(self, request, pk, note_id):
        if request.user.role not in ('admin', 'hiring_manager'):
            return Response({'detail': 'Only admins and hiring managers can delete notes.'}, status=status.HTTP_403_FORBIDDEN)
        note = generics.get_object_or_404(CandidateNote, pk=note_id, candidate_id=pk)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CandidateJobCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CandidateJobCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CandidateJobComment.objects.filter(
            mapping__candidate_id=self.kwargs['pk'],
            mapping__job_id=self.kwargs['job_id'],
        ).select_related('user')

    def perform_create(self, serializer):
        mapping = generics.get_object_or_404(
            CandidateJobMapping,
            candidate_id=self.kwargs['pk'],
            job_id=self.kwargs['job_id'],
        )
        serializer.save(mapping=mapping, user=self.request.user)


class CandidateAssignJobView(APIView):
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]

    def post(self, request, pk):
        job_id = request.data.get('job_id')
        if not job_id:
            return Response({'error': 'job_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = generics.get_object_or_404(Candidate, pk=pk)

        # Enforce one-job-per-candidate
        existing = (
            CandidateJobMapping.objects
            .filter(candidate=candidate)
            .select_related('job')
            .exclude(job_id=job_id)
            .first()
        )
        if existing:
            return Response({
                'error': 'Candidate is already applied to another job',
                'conflict': True,
                'current_job': {
                    'id': str(existing.job.id),
                    'title': existing.job.title,
                    'job_code': existing.job.job_code,
                },
            }, status=status.HTTP_409_CONFLICT)

        mapping, created = CandidateJobMapping.objects.get_or_create(
            candidate=candidate, job_id=job_id,
            defaults={'moved_by': request.user, 'macro_stage': 'APPLIED'}
        )
        if not created:
            return Response({'error': 'Candidate already assigned to this job'},
                            status=status.HTTP_400_BAD_REQUEST)
        PipelineStageHistory.objects.create(
            mapping=mapping, from_macro_stage='', to_macro_stage='APPLIED',
            moved_by=request.user, remarks='Assigned to job'
        )
        from apps.notifications.utils import notify_candidate_applied
        notify_candidate_applied(candidate, mapping.job, request.user)
        return Response(CandidateJobMappingSerializer(mapping).data, status=status.HTTP_201_CREATED)


class CandidateChangeStageView(APIView):
    """
    PATCH /candidates/{pk}/jobs/{job_id}/stage/

    Body:
      macro_stage  (required)
      drop_reason  (required when macro_stage=DROPPED)
      offer_status (optional when macro_stage=OFFERED, defaults to OFFER_SENT)
      remarks      (optional free-text note)
      priority     (optional LOW/MEDIUM/HIGH)
      next_interview_date (optional ISO datetime)
    """
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]

    def patch(self, request, pk, job_id):
        new_stage = request.data.get('macro_stage')
        if not new_stage:
            # Handle updates to auxiliary fields if macro_stage is not provided
            if 'priority' in request.data or 'next_interview_date' in request.data or 'interview_status' in request.data or 'offer_status' in request.data:
                with transaction.atomic():
                    mapping = CandidateJobMapping.objects.select_for_update().get(
                        candidate_id=pk, job_id=job_id
                    )
                    if 'priority' in request.data:
                        mapping.priority = request.data['priority']
                    if 'next_interview_date' in request.data:
                        mapping.next_interview_date = request.data['next_interview_date'] or None
                    if 'interview_status' in request.data:
                        val = request.data['interview_status']
                        mapping.interview_status = 'REJECTED' if val == 'REJECTED' else None
                    if 'offer_status' in request.data:
                        if mapping.macro_stage != 'OFFERED':
                            return Response(
                                {'error': 'offer_status can only be updated when candidate is in OFFERED stage.'},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        mapping.offer_status = request.data['offer_status']
                    mapping.save()
                interview_status_val = request.data.get('interview_status')
                if interview_status_val == 'REJECTED':
                    from apps.notifications.utils import notify_candidate_rejected
                    notify_candidate_rejected(mapping.candidate, mapping.job)
                elif interview_status_val is None or interview_status_val == '':
                    # Rejection cleared — candidate back in Interview stage
                    from apps.notifications.utils import notify_rejection_reversed
                    notify_rejection_reversed(mapping.candidate, mapping.job, 'INTERVIEW')
                return Response(CandidateJobMappingSerializer(mapping).data)
            return Response({'error': 'No updates provided'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            mapping = CandidateJobMapping.objects.select_for_update().get(
                candidate_id=pk, job_id=job_id
            )
            old_stage = mapping.macro_stage

            # Validate transition
            allowed = VALID_TRANSITIONS.get(old_stage, [])
            if new_stage not in allowed:
                return Response(
                    {'error': f'Cannot move from {old_stage} to {new_stage}. '
                              f'Allowed: {allowed}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Stage-specific validations
            if new_stage == 'DROPPED':
                drop_reason = request.data.get('drop_reason')
                if not drop_reason:
                    return Response(
                        {'error': 'drop_reason is required when moving to DROPPED'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # After an offer is made, only the candidate can drop — recruiter rejection is not allowed
                if old_stage == 'OFFERED' and drop_reason == 'REJECTED':
                    return Response(
                        {'error': 'Cannot use REJECTED reason after an offer has been made. Use CANDIDATE_DROP or NO_SHOW.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                mapping.drop_reason = drop_reason
                if drop_reason == 'REJECTED':
                    mapping.rejected_from_stage = old_stage
                    mapping.offer_status = None
                else:
                    # Preserve offer_status when dropping from OFFERED so we can show
                    # "dropped before/after accepting" in the UI
                    mapping.rejected_from_stage = ''
                    if old_stage != 'OFFERED':
                        mapping.offer_status = None

            elif new_stage == 'OFFERED':
                mapping.offer_status = request.data.get('offer_status', 'OFFER_SENT')
                mapping.drop_reason = None

            elif new_stage == 'INTERVIEW':
                # Only set R1 if not already in interview (prevent overwriting current round)
                if mapping.current_interview_round is None:
                    mapping.current_interview_round = 'R1'
                mapping.drop_reason = None
                mapping.offer_status = None

            else:
                mapping.drop_reason = None
                mapping.offer_status = None
                mapping.rejected_from_stage = ''

            # Optional fields
            if 'priority' in request.data:
                mapping.priority = request.data['priority']
            if 'next_interview_date' in request.data:
                mapping.next_interview_date = request.data['next_interview_date'] or None
            if 'action_reason' in request.data:
                mapping.action_reason = request.data['action_reason'] or ''

            mapping.macro_stage = new_stage
            mapping.moved_by = request.user
            mapping.save()

            PipelineStageHistory.objects.create(
                mapping=mapping,
                from_macro_stage=old_stage,
                to_macro_stage=new_stage,
                moved_by=request.user,
                remarks=request.data.get('remarks', ''),
            )

        from apps.notifications.utils import (
            notify_candidate_shortlisted, notify_candidate_offered,
            notify_candidate_interview_stage, notify_rejection_reversed,
        )
        candidate = mapping.candidate
        job = mapping.job
        if new_stage == 'SHORTLISTED':
            if old_stage == 'DROPPED':
                notify_rejection_reversed(candidate, job, 'SHORTLISTED')
            else:
                notify_candidate_shortlisted(candidate, job)
        elif new_stage == 'INTERVIEW':
            notify_candidate_interview_stage(candidate, job)
        elif new_stage == 'OFFERED':
            notify_candidate_offered(candidate, job)

        return Response(CandidateJobMappingSerializer(mapping).data)


class NextRoundView(APIView):
    """
    POST /candidates/{pk}/jobs/{job_id}/interview/next-round/

    Advances current_interview_round to the next in ROUND_PROGRESSION.
    Does NOT create an Interview record — scheduling is a separate step.
    Guard: the latest Interview for the current round must be COMPLETED.
    """
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]

    def post(self, request, pk, job_id):
        mapping = generics.get_object_or_404(
            CandidateJobMapping, candidate_id=pk, job_id=job_id
        )
        if mapping.macro_stage != 'INTERVIEW':
            return Response(
                {'error': 'Candidate must be in INTERVIEW stage'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_round = mapping.current_interview_round or 'R1'
        if current_round not in ROUND_PROGRESSION:
            return Response(
                {'error': f'Invalid current round: {current_round}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard: current round must be completed before advancing
        from apps.interviews.models import Interview
        latest = mapping.interviews.filter(round_name=current_round).order_by('-created_at').first()
        if not latest or latest.round_status != 'COMPLETED':
            return Response(
                {'error': f'Round {current_round} must be completed before advancing to the next round'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        idx = ROUND_PROGRESSION.index(current_round)
        if idx >= len(ROUND_PROGRESSION) - 1:
            return Response(
                {'error': 'Final round (MGMT) already reached. Cannot advance further.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        next_round = ROUND_PROGRESSION[idx + 1]
        mapping.current_interview_round = next_round
        mapping.moved_by = request.user
        mapping.save(update_fields=['current_interview_round', 'moved_by', 'stage_updated_at'])
        return Response(CandidateJobMappingSerializer(mapping).data)


class JumpToRoundView(APIView):
    """
    POST /candidates/{pk}/jobs/{job_id}/interview/jump-round/

    Body: { "round_name": "R3" | "CLIENT" | ... }

    Jumps to any round without completion guard (explicit skip intent).
    Does NOT create an Interview record — scheduling is a separate step.
    """
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]

    def post(self, request, pk, job_id):
        round_name = request.data.get('round_name')
        valid_rounds = [r[0] for r in ROUND_CHOICES]

        if not round_name:
            return Response({'error': 'round_name is required'}, status=status.HTTP_400_BAD_REQUEST)
        if round_name not in valid_rounds:
            return Response(
                {'error': f'round_name must be one of {valid_rounds}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mapping = generics.get_object_or_404(
            CandidateJobMapping, candidate_id=pk, job_id=job_id
        )
        if mapping.macro_stage != 'INTERVIEW':
            return Response(
                {'error': 'Candidate must be in INTERVIEW stage'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if mapping.current_interview_round == round_name:
            return Response(
                {'error': f'Candidate is already in round {round_name}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mapping.current_interview_round = round_name
        mapping.moved_by = request.user
        mapping.save(update_fields=['current_interview_round', 'moved_by', 'stage_updated_at'])
        return Response(CandidateJobMappingSerializer(mapping).data)


class CandidateMoveJobView(APIView):
    permission_classes = [rbac_perm('MANAGE_USERS')]  # admin-only: moving a candidate across jobs

    def post(self, request, pk):
        from django.utils import timezone
        from_job_id = request.data.get('from_job_id')
        to_job_id = request.data.get('to_job_id')
        if not to_job_id:
            return Response({'error': 'to_job_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            if from_job_id:
                old_mapping = generics.get_object_or_404(
                    CandidateJobMapping, candidate_id=pk, job_id=from_job_id, is_archived=False
                )
            else:
                old_mapping = CandidateJobMapping.objects.filter(
                    candidate_id=pk, is_archived=False
                ).first()

            # Archive the old mapping — preserve all stage history (stage_logs)
            if old_mapping:
                old_mapping.is_archived = True
                old_mapping.archived_at = timezone.now()
                old_mapping.save(update_fields=['is_archived', 'archived_at'])

            new_mapping = CandidateJobMapping.objects.create(
                candidate_id=pk, job_id=to_job_id,
                moved_by=request.user, macro_stage='APPLIED',
                previous_mapping=old_mapping,
            )
            PipelineStageHistory.objects.create(
                mapping=new_mapping, from_macro_stage='', to_macro_stage='APPLIED',
                moved_by=request.user,
                remarks=f'Moved from job {old_mapping.job.job_code if old_mapping else "unknown"}',
            )
        return Response(CandidateJobMappingSerializer(new_mapping).data, status=status.HTTP_201_CREATED)


class CandidateShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        candidate = generics.get_object_or_404(Candidate, pk=pk)
        user_ids = request.data.get('user_ids', [])
        if not user_ids:
            return Response({'error': 'user_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

        recipients = User.objects.filter(id__in=user_ids)
        sender = request.user
        notifications = [
            InAppNotification(
                recipient=recipient,
                sender=sender,
                notification_type='candidate_shared',
                message=f'{sender.full_name} shared the profile of {candidate.full_name} with you.',
                candidate=candidate,
            )
            for recipient in recipients
        ]
        InAppNotification.objects.bulk_create(notifications)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        candidate_url = f"{frontend_url}/candidates/{candidate.id}"
        for recipient in recipients:
            subject = f"{sender.full_name} shared a candidate profile with you"
            text_body = (
                f"Hi {recipient.full_name},\n\n"
                f"{sender.full_name} has shared the profile of {candidate.full_name} with you on the ATS platform.\n\n"
                f"View profile: {candidate_url}\n\n"
                f"— Shorthills AI ATS"
            )
            html_body = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
              <h2 style="color:#1e293b;margin-bottom:8px;">Candidate Profile Shared</h2>
              <p style="color:#475569;">Hi <strong>{recipient.full_name}</strong>,</p>
              <p style="color:#475569;">
                <strong>{sender.full_name}</strong> has shared the profile of
                <strong>{candidate.full_name}</strong> with you on the ATS platform.
              </p>
              <a href="{candidate_url}"
                 style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
                View Candidate Profile
              </a>
              <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Shorthills AI ATS</p>
            </div>
            """
            try:
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=text_body,
                    from_email=f"{sender.full_name} via ATS <{settings.EMAIL_HOST_USER}>",
                    to=[recipient.email],
                    reply_to=[sender.email],
                )
                msg.attach_alternative(html_body, "text/html")
                msg.send()
            except Exception as e:
                import logging
                logging.getLogger(__name__).error("Failed to send share email to %s: %s", recipient.email, e)

        return Response({'shared_with': len(notifications)}, status=status.HTTP_201_CREATED)


class SetScreeningStatusView(APIView):
    """
    PATCH /candidates/{pk}/jobs/{job_id}/screening-status/

    Body: { "screening_status": "SCREENED" | "MAYBE" | "REJECTED" | null }

    Only allowed when macro_stage == "APPLIED". Returns 400 otherwise.
    """
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, job_id):
        mapping = generics.get_object_or_404(
            CandidateJobMapping, candidate_id=pk, job_id=job_id
        )

        if mapping.macro_stage != 'APPLIED':
            return Response(
                {'error': 'screening_status can only be set on Applied candidates'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if 'screening_status' not in request.data:
            return Response(
                {'error': 'screening_status is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_status = request.data['screening_status']

        choice_keys = [key for key, _ in SCREENING_STATUS_CHOICES]
        valid_values = choice_keys + [None]
        if new_status not in valid_values:
            return Response(
                {'error': f'Invalid screening_status. Must be one of: {", ".join(choice_keys)}, or null'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mapping.screening_status = new_status
        mapping.save(update_fields=['screening_status'])

        return Response(CandidateJobMappingSerializer(mapping, context={'request': request}).data)


class CandidateReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = CandidateReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CandidateReminder.objects.filter(
            candidate_id=self.kwargs['pk'],
            created_by=self.request.user,
        )

    def perform_create(self, serializer):
        candidate = generics.get_object_or_404(Candidate, pk=self.kwargs['pk'])
        serializer.save(candidate=candidate, created_by=self.request.user)


class CandidateReminderUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CandidateReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return generics.get_object_or_404(
            CandidateReminder,
            pk=self.kwargs['reminder_id'],
            candidate_id=self.kwargs['pk'],
            created_by=self.request.user,
        )


class CandidateResumeUploadView(APIView):
    """
    POST /api/candidates/<pk>/resume/
    Upload a new resume file for a candidate without re-parsing any details.
    Marks previous files as is_latest=False.
    Returns 409 if the exact same file (by SHA-256) was already uploaded.
    """
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]
    parser_classes = [__import__('rest_framework.parsers', fromlist=['MultiPartParser']).MultiPartParser]

    def post(self, request, pk):
        import hashlib
        from .models import ResumeFile
        candidate = generics.get_object_or_404(Candidate, pk=pk)
        resume_file = request.FILES.get('file')
        if not resume_file:
            return Response({'detail': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        fname = resume_file.name.lower()
        if fname.endswith('.pdf'):
            file_type = 'pdf'
        elif fname.endswith('.docx'):
            file_type = 'docx'
        else:
            return Response({'detail': 'Only PDF and DOCX files are accepted.'}, status=status.HTTP_400_BAD_REQUEST)

        # Compute SHA-256 hash to detect duplicates
        resume_file.seek(0)
        sha256 = hashlib.sha256(resume_file.read()).hexdigest()
        resume_file.seek(0)

        existing = ResumeFile.objects.filter(candidate=candidate, file_hash=sha256).first()
        if existing:
            return Response(
                {
                    'detail': 'This resume has already been uploaded for this candidate.',
                    'duplicate': True,
                    'existing_filename': existing.original_filename,
                },
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            ResumeFile.objects.filter(candidate=candidate, is_latest=True).update(is_latest=False)
            rf = ResumeFile.objects.create(
                candidate=candidate,
                uploaded_by=request.user,
                file=resume_file,
                original_filename=resume_file.name,
                file_type=file_type,
                file_size_bytes=resume_file.size,
                file_hash=sha256,
                is_latest=True,
            )

        from .serializers import ResumeFileSerializer
        return Response(ResumeFileSerializer(rf, context={'request': request}).data, status=status.HTTP_201_CREATED)


class CandidateResumeDownloadView(APIView):
    """
    GET /api/candidates/<pk>/resume/download/
    Proxies the latest resume file through the backend so the browser
    receives it as same-origin — avoids S3 CORS restrictions on fetch().
    """
    permission_classes = [rbac_perm('VIEW_CANDIDATES')]

    def get(self, request, pk):
        import urllib.request
        from django.http import HttpResponse
        from .models import ResumeFile

        candidate = generics.get_object_or_404(Candidate, pk=pk)
        rf = (
            ResumeFile.objects.filter(candidate=candidate, is_latest=True).first()
            or ResumeFile.objects.filter(candidate=candidate).order_by('-created_at').first()
        )
        if not rf or not rf.file:
            return Response({'detail': 'No resume file found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            url = rf.file.url
            with urllib.request.urlopen(url) as resp:
                data = resp.read()
        except Exception as exc:
            return Response({'detail': f'Could not fetch file: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        content_type = 'application/pdf' if rf.file_type == 'pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        response = HttpResponse(data, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{rf.original_filename}"'
        return response


class CandidateAIMatchView(APIView):
    """
    GET  /api/candidates/<pk>/ai-match/  — return cached scores (no LLM call)
    POST /api/candidates/<pk>/ai-match/  — recompute scores via LLM and return
    """
    permission_classes = [rbac_perm('MANAGE_CANDIDATES')]

    def _serialise(self, mappings_qs):
        return [
            {
                'mapping_id': str(m.id),
                'job_id': str(m.job_id),
                'job_title': m.job.title if m.job else '',
                'score': m.ai_match_score,
                'reason': m.ai_match_reason,
                'macro_stage': m.macro_stage,
            }
            for m in mappings_qs if m.ai_match_score is not None
        ]

    def get(self, request, pk):
        candidate = generics.get_object_or_404(Candidate, pk=pk)
        cached = (
            CandidateJobMapping.objects.filter(candidate=candidate)
            .select_related('job')
            .order_by('-ai_match_score')
        )
        return Response(self._serialise(cached), status=status.HTTP_200_OK)

    def post(self, request, pk):
        candidate = generics.get_object_or_404(
            Candidate.objects.prefetch_related('resume_files', 'job_mappings__job'),
            pk=pk,
        )
        mappings = list(candidate.job_mappings.select_related('job').all())
        if not mappings:
            return Response([], status=status.HTTP_200_OK)

        from .services.ai_match import compute_and_save_match
        import threading

        def _compute_all():
            for mapping in mappings:
                compute_and_save_match(mapping)

        thread = threading.Thread(target=_compute_all, daemon=True)
        thread.start()
        thread.join(timeout=60)

        updated = (
            CandidateJobMapping.objects.filter(candidate=candidate)
            .select_related('job')
            .order_by('-ai_match_score')
        )
        return Response(self._serialise(updated), status=status.HTTP_200_OK)
