import logging
from rest_framework import generics, status

logger = logging.getLogger(__name__)
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from .models import Interview, InterviewFeedback, FeedbackTemplate
from .serializers import (
    InterviewListSerializer, InterviewCreateSerializer,
    InterviewFeedbackSerializer, FeedbackTemplateSerializer
)
from apps.core.permissions import rbac_perm
from apps.core.rbac import has_permission


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _role_queryset(user, base_qs):
    """Return a queryset scoped to what the user is allowed to see."""
    if has_permission(user, 'MANAGE_USERS'):
        return base_qs
    if has_permission(user, 'SCHEDULE_INTERVIEW'):
        return base_qs.filter(
            Q(created_by=user) |
            Q(mapping__job__collaborators__user=user) |
            Q(mapping__job__hiring_manager=user)
        ).distinct()
    if has_permission(user, 'APPROVE_REQUISITIONS'):
        return base_qs.filter(mapping__job__hiring_manager=user)
    if has_permission(user, 'GIVE_FEEDBACK'):
        return base_qs.filter(interviewer=user)
    return base_qs.none()


def _assert_not_completed(interview, user):
    """Raise PermissionDenied if the interview is already completed."""
    if interview.computed_status == 'COMPLETED':
        raise PermissionDenied('This interview is already completed and cannot be modified.')


# ---------------------------------------------------------------------------
# Interview List / Create
# ---------------------------------------------------------------------------

class InterviewListCreateView(generics.ListCreateAPIView):
    search_fields = ['mapping__candidate__full_name', 'mapping__job__title']
    ordering_fields = ['scheduled_at', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Interview.objects.select_related(
            'mapping__candidate', 'mapping__job', 'interviewer', 'created_by'
        ).prefetch_related('feedback')

        tab = self.request.query_params.get('tab', '')

        # "All Schedules" tab: every authenticated user can see all interviews.
        # Mutations (update/cancel/feedback) are still individually role-gated.
        if tab != 'all':
            qs = _role_queryset(user, qs)

        # Tab-specific overlay
        if tab == 'my':
            qs = qs.filter(Q(interviewer=user) | Q(mapping__job__hiring_manager=user)).distinct()
        elif tab == 'scheduled_by_me':
            qs = qs.filter(
                Q(created_by=user) | Q(mapping__job__collaborators__user=user)
            ).distinct()
        elif tab == 'hm_interviews':
            qs = qs.filter(mapping__job__hiring_manager=user)

        # Backend-driven filters
        job_title = self.request.query_params.get('job_title')
        if job_title:
            qs = qs.filter(mapping__job__title__icontains=job_title)

        interviewer_id = self.request.query_params.get('interviewer')
        if interviewer_id:
            qs = qs.filter(interviewer_id=interviewer_id)

        stage = self.request.query_params.get('stage')
        if stage:
            qs = qs.filter(round_name=stage)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(scheduled_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(scheduled_at__date__lte=date_to)

        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [rbac_perm('SCHEDULE_INTERVIEW')()]
        return [rbac_perm('VIEW_JOBS')()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return InterviewCreateSerializer
        return InterviewListSerializer

    _ROUND_LABELS = {
        'R1': 'Round 1', 'R2': 'Round 2', 'R3': 'Round 3',
        'CLIENT': 'Client Round', 'CDO': 'CDO Round', 'MGMT': 'Management Round',
    }

    def perform_create(self, serializer):
        user = self.request.user
        mapping = serializer.validated_data['mapping']
        round_name = serializer.validated_data.get('round_name')
        round_number = mapping.interviews.count() + 1
        round_label = self._ROUND_LABELS.get(round_name, round_name or 'Round')
        is_reschedule = (
            mapping.macro_stage == 'INTERVIEW'
            and mapping.interview_status == 'REJECTED'
            and round_name
        )
        interview = serializer.save(
            created_by=user,
            round_number=round_number,
            round_label=round_label,
        )
        if is_reschedule:
            mapping.interview_status = None
            mapping.current_interview_round = interview.round_name
            mapping.moved_by = user
            mapping.save(update_fields=['interview_status', 'current_interview_round', 'moved_by', 'stage_updated_at'])
        try:
            from apps.notifications.utils import notify_interview_scheduled
            notify_interview_scheduled(interview, is_reschedule=is_reschedule)
        except Exception as exc:
            logger.warning('Interview notification failed (non-fatal): %s', exc)

        try:
            from apps.activity.utils import log_activity
            _mapping = interview.mapping
            _candidate = _mapping.candidate
            _job = _mapping.job
            _actor_name = user.full_name or user.email
            _c_name = _candidate.full_name or _candidate.email
            _action = 'interview_rescheduled' if is_reschedule else 'interview_scheduled'
            _verb = 'rescheduled' if is_reschedule else 'scheduled'
            _interviewer = interview.interviewer
            log_activity(
                actor=user,
                action=_action,
                entity_type='interview',
                entity_id=interview.id,
                sentence=f'{_actor_name} {_verb} {interview.round_label} for {_c_name} ({_job.title})',
                metadata={
                    'candidate_id': str(_candidate.id),
                    'candidate_name': _c_name,
                    'job_id': str(_job.id),
                    'job_title': _job.title,
                    'interview_id': str(interview.id),
                    'round_name': interview.round_name or '',
                    'round_label': interview.round_label or '',
                    'scheduled_at': interview.scheduled_at.isoformat() if interview.scheduled_at else '',
                    'interviewer_name': (_interviewer.full_name or _interviewer.email) if _interviewer else '',
                },
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Interview Detail / Update
# ---------------------------------------------------------------------------

class InterviewDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = InterviewCreateSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [rbac_perm('SCHEDULE_INTERVIEW')()]
        return [rbac_perm('VIEW_JOBS')()]

    def get_queryset(self):
        return _role_queryset(
            self.request.user,
            Interview.objects.select_related('mapping__candidate', 'mapping__job', 'interviewer', 'created_by')
        )

    def update(self, request, *args, **kwargs):
        interview = self.get_object()

        if interview.computed_status == 'COMPLETED' and not has_permission(request.user, 'MANAGE_USERS'):
            raise PermissionDenied('Completed interviews cannot be modified.')

        # Capture old scheduled_at before update for dedup check
        _old_scheduled_at = interview.scheduled_at

        response = super().update(request, *args, **kwargs)
        # Notify as reschedule if scheduled_at changed
        if 'scheduled_at' in request.data:
            interview.refresh_from_db()
            from apps.notifications.utils import notify_interview_scheduled
            notify_interview_scheduled(interview, is_reschedule=True)

            # Activity log only when the time actually changed
            if interview.scheduled_at != _old_scheduled_at:
                try:
                    from apps.activity.utils import log_activity
                    _mapping = interview.mapping
                    _candidate = _mapping.candidate
                    _job = _mapping.job
                    _actor_name = request.user.full_name or request.user.email
                    _c_name = _candidate.full_name or _candidate.email
                    _interviewer = interview.interviewer
                    log_activity(
                        actor=request.user,
                        action='interview_rescheduled',
                        entity_type='interview',
                        entity_id=interview.id,
                        sentence=f'{_actor_name} rescheduled {interview.round_label} for {_c_name} ({_job.title})',
                        metadata={
                            'candidate_id': str(_candidate.id),
                            'candidate_name': _c_name,
                            'job_id': str(_job.id),
                            'job_title': _job.title,
                            'interview_id': str(interview.id),
                            'round_name': interview.round_name or '',
                            'round_label': interview.round_label or '',
                            'scheduled_at': interview.scheduled_at.isoformat() if interview.scheduled_at else '',
                            'interviewer_name': (_interviewer.full_name or _interviewer.email) if _interviewer else '',
                        },
                    )
                except Exception:
                    pass

        return response


# ---------------------------------------------------------------------------
# Cancel
# ---------------------------------------------------------------------------

class InterviewCancelView(APIView):
    permission_classes = [rbac_perm('SCHEDULE_INTERVIEW')]

    def post(self, request, pk):

        interview = generics.get_object_or_404(
            _role_queryset(request.user, Interview.objects.all()), pk=pk
        )
        if interview.status != 'scheduled':
            return Response({'error': 'Only scheduled interviews can be cancelled'},
                            status=status.HTTP_400_BAD_REQUEST)
        interview.status = 'cancelled'
        interview.save(update_fields=['status'])
        return Response(InterviewListSerializer(interview).data)


# ---------------------------------------------------------------------------
# Feedback Create
# ---------------------------------------------------------------------------

class InterviewFeedbackCreateView(generics.CreateAPIView):
    permission_classes = [rbac_perm('GIVE_FEEDBACK')]
    serializer_class = InterviewFeedbackSerializer

    def perform_create(self, serializer):
        user = self.request.user

        interview = generics.get_object_or_404(
            _role_queryset(user, Interview.objects.select_related('mapping__job')),
            pk=self.kwargs['pk']
        )

        # Non-admin users can only submit feedback for interviews assigned to them
        if not has_permission(user, 'MANAGE_USERS') and interview.interviewer_id != user.id:
            raise PermissionDenied('You can only submit feedback for interviews assigned to you.')

        if InterviewFeedback.objects.filter(interview=interview).exists():
            raise ValidationError({'detail': 'Feedback has already been submitted for this interview.'})

        interview.status = 'completed'
        interview.round_status = 'COMPLETED'
        interview.save(update_fields=['status', 'round_status'])
        feedback = serializer.save(interview=interview, interviewer=user)

        try:
            from apps.activity.utils import log_activity, DECISION_DISPLAY
            _mapping = interview.mapping
            _candidate = _mapping.candidate
            _job = _mapping.job
            _actor_name = user.full_name or user.email
            _c_name = _candidate.full_name or _candidate.email
            _decision = feedback.decision or ''
            _decision_display = DECISION_DISPLAY.get(_decision, _decision)
            log_activity(
                actor=user,
                action='interview_feedback_submitted',
                entity_type='interview',
                entity_id=interview.id,
                sentence=f"{_actor_name} submitted feedback for {_c_name}'s {interview.round_label} — {_decision_display}",
                metadata={
                    'candidate_id': str(_candidate.id),
                    'candidate_name': _c_name,
                    'job_id': str(_job.id),
                    'job_title': _job.title,
                    'interview_id': str(interview.id),
                    'round_label': interview.round_label or '',
                    'decision': _decision,
                    'overall_rating': feedback.overall_rating,
                },
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Feedback Detail / Update
# ---------------------------------------------------------------------------

class InterviewFeedbackDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [rbac_perm('GIVE_FEEDBACK')]
    serializer_class = InterviewFeedbackSerializer

    def get_object(self):
        user = self.request.user
        # All roles that can see this interview may read feedback;
        # use the full queryset so "all" tab viewers can also retrieve.
        qs = Interview.objects.all()
        interview = generics.get_object_or_404(qs, pk=self.kwargs['pk'])
        return generics.get_object_or_404(
            InterviewFeedback.objects.prefetch_related('competency_ratings'),
            interview=interview
        )

    def _assert_can_mutate(self, request):
        if has_permission(request.user, 'MANAGE_USERS'):
            return
        feedback = self.get_object()
        if feedback.interviewer_id == request.user.id:
            return
        raise PermissionDenied('You can only modify feedback you submitted.')

    def update(self, request, *args, **kwargs):
        self._assert_can_mutate(request)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_can_mutate(request)
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

class InterviewSummaryView(APIView):
    permission_classes = [rbac_perm('VIEW_JOBS')]

    def get(self, request):
        user = request.user
        now = timezone.now()
        qs = _role_queryset(user, Interview.objects.all())
        upcoming = qs.filter(status='scheduled', scheduled_at__gte=now).count()
        pending_feedback = qs.filter(status='scheduled', scheduled_at__lt=now).count()
        completed = qs.filter(status='completed').count()
        return Response({
            'upcoming': upcoming,
            'pending_feedback': pending_feedback,
            'completed': completed,
            'pending_confirmation': 0,
            'archived': qs.filter(status='cancelled').count(),
        })


# ---------------------------------------------------------------------------
# Round Result
# ---------------------------------------------------------------------------

class SetRoundResultView(APIView):
    permission_classes = [rbac_perm('GIVE_FEEDBACK')]

    VALID_RESULTS = {'PASS', 'FAIL', 'ON_HOLD'}

    def patch(self, request, pk):

        round_result = request.data.get('round_result')
        if round_result not in self.VALID_RESULTS:
            return Response(
                {'error': f'round_result must be one of {sorted(self.VALID_RESULTS)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        interview = generics.get_object_or_404(
            _role_queryset(request.user, Interview.objects.select_related('mapping')),
            pk=pk
        )

        with transaction.atomic():
            interview.round_result = round_result
            interview.round_status = 'COMPLETED'
            interview.status = 'completed'
            interview.save(update_fields=['round_result', 'round_status', 'status'])

            mapping = interview.mapping
            response_data = InterviewListSerializer(interview).data

            if round_result == 'FAIL':
                mapping.interview_status = 'REJECTED'
                mapping.save(update_fields=['interview_status'])
                response_data['auto_rejected'] = True
                from apps.notifications.utils import notify_candidate_interview_rejected
                notify_candidate_interview_rejected(mapping.candidate, mapping.job)
            elif round_result == 'PASS':
                response_data['suggest_move_to_offered'] = True
                from apps.notifications.utils import notify_candidate_round_passed
                notify_candidate_round_passed(mapping.candidate, mapping.job, interview)

        try:
            from apps.activity.utils import log_activity, RESULT_DISPLAY
            _candidate = mapping.candidate
            _job = mapping.job
            _actor_name = request.user.full_name or request.user.email
            _c_name = _candidate.full_name or _candidate.email
            _result_display = RESULT_DISPLAY.get(round_result, round_result)
            log_activity(
                actor=request.user,
                action='round_result_set',
                entity_type='interview',
                entity_id=interview.id,
                sentence=f"{_actor_name} marked {_c_name}'s {interview.round_label} as {_result_display}",
                metadata={
                    'candidate_id': str(_candidate.id),
                    'candidate_name': _c_name,
                    'job_id': str(_job.id),
                    'job_title': _job.title,
                    'interview_id': str(interview.id),
                    'round_label': interview.round_label or '',
                    'round_result': round_result,
                },
            )
        except Exception:
            pass

        return Response(response_data)


# ---------------------------------------------------------------------------
# Round Status
# ---------------------------------------------------------------------------

class SetRoundStatusView(APIView):
    permission_classes = [rbac_perm('GIVE_FEEDBACK')]

    VALID_STATUSES = {'SCHEDULED', 'ON_HOLD', 'COMPLETED'}

    def patch(self, request, pk):

        round_status = request.data.get('round_status')
        if round_status not in self.VALID_STATUSES:
            return Response(
                {'error': f'round_status must be one of {sorted(self.VALID_STATUSES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        interview = generics.get_object_or_404(
            _role_queryset(request.user, Interview.objects.all()),
            pk=pk
        )

        if interview.computed_status == 'COMPLETED' and round_status != 'COMPLETED' and not has_permission(request.user, 'MANAGE_USERS'):
            raise PermissionDenied('Only admins can revert a completed interview status.')

        interview.round_status = round_status
        interview.save(update_fields=['round_status'])
        return Response(InterviewListSerializer(interview).data)
