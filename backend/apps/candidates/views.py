from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from .models import (
    Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote,
    VALID_TRANSITIONS, ROUND_PROGRESSION, ROUND_CHOICES, SCREENING_STATUS_CHOICES,
)
from .serializers import (
    CandidateListSerializer, CandidateDetailSerializer, CandidateCreateSerializer,
    CandidateJobMappingSerializer, CandidateNoteSerializer
)
from apps.accounts.models import User
from apps.notifications.models import InAppNotification


class CandidateListCreateView(generics.ListCreateAPIView):
    search_fields = ['full_name', 'email', 'phone', 'skills']
    ordering_fields = ['full_name', 'created_at', 'total_experience_years']

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

        if source_str:
            qs = qs.filter(source__in=[s for s in source_str.split(',') if s])
        if stage_str:
            qs = qs.filter(
                job_mappings__macro_stage__in=[s for s in stage_str.split(',') if s]
            ).distinct()
        if job_id:
            qs = qs.filter(job_mappings__job_id=job_id).distinct()
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

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return CandidateCreateSerializer
        return CandidateDetailSerializer


class CandidateDeleteView(APIView):
    def delete(self, request, pk):
        candidate = generics.get_object_or_404(Candidate, pk=pk)
        candidate.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CandidateNoteListCreateView(generics.ListCreateAPIView):
    serializer_class = CandidateNoteSerializer

    def get_queryset(self):
        return CandidateNote.objects.filter(candidate_id=self.kwargs['pk']).select_related('user')

    def perform_create(self, serializer):
        serializer.save(candidate_id=self.kwargs['pk'], user=self.request.user)


class CandidateAssignJobView(APIView):
    def post(self, request, pk):
        job_id = request.data.get('job_id')
        if not job_id:
            return Response({'error': 'job_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = generics.get_object_or_404(Candidate, pk=pk)
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

    def patch(self, request, pk, job_id):
        new_stage = request.data.get('macro_stage')
        if not new_stage:
            return Response({'error': 'macro_stage is required'}, status=status.HTTP_400_BAD_REQUEST)

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
                mapping.drop_reason = drop_reason
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

            # Optional fields
            if 'priority' in request.data:
                mapping.priority = request.data['priority']
            if 'next_interview_date' in request.data:
                mapping.next_interview_date = request.data['next_interview_date'] or None

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

        return Response(CandidateJobMappingSerializer(mapping).data)


class NextRoundView(APIView):
    """
    POST /candidates/{pk}/jobs/{job_id}/interview/next-round/

    Advances candidate to the next interview round in the default progression
    (R1 → R2 → CLIENT → CDO → MGMT). Creates an Interview record.
    """

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

        idx = ROUND_PROGRESSION.index(current_round)
        if idx >= len(ROUND_PROGRESSION) - 1:
            return Response(
                {'error': 'Final round (MGMT) already reached. Cannot advance further.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        next_round = ROUND_PROGRESSION[idx + 1]
        self._create_interview_and_advance(mapping, next_round, request)
        return Response(CandidateJobMappingSerializer(mapping).data)

    @staticmethod
    def _create_interview_and_advance(mapping, round_name, request):
        from apps.interviews.models import Interview
        # Determine next round_number (one more than the highest existing)
        last = mapping.interviews.order_by('-round_number').first()
        next_num = (last.round_number + 1) if last else 1

        Interview.objects.create(
            mapping=mapping,
            round_number=next_num,
            round_label=dict(Interview.ROUND_NAME_CHOICES).get(round_name, round_name),
            round_name=round_name,
            round_status='SCHEDULED',
            interviewer=request.user,
            scheduled_at=request.data.get('scheduled_at', _default_scheduled_at()),
            created_by=request.user,
        )
        mapping.current_interview_round = round_name
        mapping.moved_by = request.user
        mapping.save(update_fields=['current_interview_round', 'moved_by', 'stage_updated_at'])


def _default_scheduled_at():
    from django.utils import timezone
    from datetime import timedelta
    return timezone.now() + timedelta(days=1)


class JumpToRoundView(APIView):
    """
    POST /candidates/{pk}/jobs/{job_id}/interview/jump-round/

    Body: { "round_name": "CLIENT" }

    Jumps to any round regardless of progression order.
    """

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

        NextRoundView._create_interview_and_advance(mapping, round_name, request)
        return Response(CandidateJobMappingSerializer(mapping).data)


class CandidateMoveJobView(APIView):
    def post(self, request, pk):
        from_job_id = request.data.get('from_job_id')
        to_job_id = request.data.get('to_job_id')
        if not from_job_id or not to_job_id:
            return Response({'error': 'from_job_id and to_job_id are required'},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            old_mapping = generics.get_object_or_404(
                CandidateJobMapping, candidate_id=pk, job_id=from_job_id
            )
            old_mapping.delete()
            new_mapping = CandidateJobMapping.objects.create(
                candidate_id=pk, job_id=to_job_id,
                moved_by=request.user, macro_stage='APPLIED'
            )
            PipelineStageHistory.objects.create(
                mapping=new_mapping, from_macro_stage='', to_macro_stage='APPLIED',
                moved_by=request.user, remarks=f'Moved from job {from_job_id}'
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
