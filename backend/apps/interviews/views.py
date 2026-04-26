from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _role_queryset(user, base_qs):
    """Return a queryset scoped to what the user is allowed to see."""
    role = getattr(user, 'role', None)
    if role == 'admin':
        return base_qs
    if role == 'recruiter':
        return base_qs.filter(
            Q(created_by=user) |
            Q(mapping__job__collaborators__user=user)
        ).distinct()
    if role == 'interviewer':
        return base_qs.filter(interviewer=user)
    if role == 'hiring_manager':
        return base_qs.filter(mapping__job__hiring_manager=user)
    # Fallback: nothing
    return base_qs.none()


def _assert_not_completed(interview, user):
    """Raise PermissionDenied if the interview is already completed."""
    if interview.computed_status == 'COMPLETED':
        raise PermissionDenied('This interview is already completed and cannot be modified.')


# ---------------------------------------------------------------------------
# Interview List / Create
# ---------------------------------------------------------------------------

class InterviewListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
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
            qs = qs.filter(interviewer=user)
        elif tab == 'scheduled_by_me':
            qs = qs.filter(created_by=user)
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
        role = getattr(user, 'role', None)
        if role not in ('admin', 'recruiter'):
            raise PermissionDenied('Only admins and recruiters can schedule interviews.')

        mapping = serializer.validated_data['mapping']
        round_name = serializer.validated_data.get('round_name')
        round_number = mapping.interviews.count() + 1
        round_label = self._ROUND_LABELS.get(round_name, round_name or 'Round')
        interview = serializer.save(
            created_by=user,
            round_number=round_number,
            round_label=round_label,
        )
        # Clear rejection flag on reschedule
        mapping = interview.mapping
        if (
            mapping.macro_stage == 'INTERVIEW'
            and mapping.interview_status == 'REJECTED'
            and interview.round_name
        ):
            mapping.interview_status = None
            mapping.current_interview_round = interview.round_name
            mapping.moved_by = user
            mapping.save(update_fields=['interview_status', 'current_interview_round', 'moved_by', 'stage_updated_at'])


# ---------------------------------------------------------------------------
# Interview Detail / Update
# ---------------------------------------------------------------------------

class InterviewDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InterviewCreateSerializer

    def get_queryset(self):
        return _role_queryset(
            self.request.user,
            Interview.objects.select_related('mapping__candidate', 'mapping__job', 'interviewer', 'created_by')
        )

    def update(self, request, *args, **kwargs):
        interview = self.get_object()
        role = getattr(request.user, 'role', None)

        # Block non-admins from editing completed interviews
        if interview.computed_status == 'COMPLETED' and role != 'admin':
            raise PermissionDenied('Completed interviews cannot be modified.')

        # Hiring managers are read-only
        if role == 'hiring_manager':
            raise PermissionDenied('Hiring managers have read-only access to interviews.')

        return super().update(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Cancel
# ---------------------------------------------------------------------------

class InterviewCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        role = getattr(request.user, 'role', None)
        if role not in ('admin', 'recruiter'):
            raise PermissionDenied('Only admins and recruiters can cancel interviews.')

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
    permission_classes = [IsAuthenticated]
    serializer_class = InterviewFeedbackSerializer

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, 'role', None)

        interview = generics.get_object_or_404(
            _role_queryset(user, Interview.objects.select_related('mapping__job')),
            pk=self.kwargs['pk']
        )

        # Only interviewers and admins can create feedback
        if role not in ('admin', 'interviewer'):
            raise PermissionDenied('Only interviewers and admins can submit feedback.')

        # Interviewers can only submit feedback for their own assigned interviews
        if role == 'interviewer' and interview.interviewer_id != user.id:
            raise PermissionDenied('You can only submit feedback for interviews assigned to you.')

        if InterviewFeedback.objects.filter(interview=interview).exists():
            raise ValidationError({'detail': 'Feedback has already been submitted for this interview.'})

        interview.status = 'completed'
        interview.round_status = 'COMPLETED'
        interview.save(update_fields=['status', 'round_status'])
        serializer.save(interview=interview, interviewer=user)


# ---------------------------------------------------------------------------
# Feedback Detail / Update
# ---------------------------------------------------------------------------

class InterviewFeedbackDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
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
        """Admin or the assigned interviewer can create/edit/delete feedback."""
        role = getattr(request.user, 'role', None)
        if role == 'admin':
            return
        if role == 'interviewer':
            feedback = self.get_object()
            if feedback.interviewer_id == request.user.id:
                return
            raise PermissionDenied('You can only modify feedback you submitted.')
        raise PermissionDenied('You have read-only access to feedback.')

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
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

    VALID_RESULTS = {'PASS', 'FAIL', 'ON_HOLD'}

    def patch(self, request, pk):
        role = getattr(request.user, 'role', None)
        if role not in ('admin', 'recruiter', 'interviewer'):
            raise PermissionDenied('You do not have permission to set round results.')

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
            elif round_result == 'PASS':
                response_data['suggest_move_to_offered'] = True

        return Response(response_data)


# ---------------------------------------------------------------------------
# Round Status
# ---------------------------------------------------------------------------

class SetRoundStatusView(APIView):
    permission_classes = [IsAuthenticated]

    VALID_STATUSES = {'SCHEDULED', 'ON_HOLD', 'COMPLETED'}

    def patch(self, request, pk):
        role = getattr(request.user, 'role', None)
        if role not in ('admin', 'recruiter', 'interviewer'):
            raise PermissionDenied('You do not have permission to update round status.')

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

        # Prevent reverting a completed interview
        if interview.computed_status == 'COMPLETED' and round_status != 'COMPLETED' and role != 'admin':
            raise PermissionDenied('Only admins can revert a completed interview status.')

        interview.round_status = round_status
        interview.save(update_fields=['round_status'])
        return Response(InterviewListSerializer(interview).data)
