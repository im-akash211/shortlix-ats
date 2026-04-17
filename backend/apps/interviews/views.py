from rest_framework import generics, status
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


class InterviewListCreateView(generics.ListCreateAPIView):
    search_fields = ['mapping__candidate__full_name', 'mapping__job__title']
    filterset_fields = ['status', 'mode']
    ordering_fields = ['scheduled_at', 'created_at']

    def get_queryset(self):
        qs = Interview.objects.select_related(
            'mapping__candidate', 'mapping__job', 'interviewer', 'created_by'
        )
        tab = self.request.query_params.get('tab', 'all')
        user = self.request.user
        if tab == 'my':
            qs = qs.filter(interviewer=user)
        elif tab == 'scheduled_by_me':
            qs = qs.filter(created_by=user)
        elif tab == 'hm_interviews':
            qs = qs.filter(mapping__job__hiring_manager=user)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return InterviewCreateSerializer
        return InterviewListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InterviewDetailView(generics.RetrieveUpdateAPIView):
    queryset = Interview.objects.select_related(
        'mapping__candidate', 'mapping__job', 'interviewer', 'created_by'
    )
    serializer_class = InterviewCreateSerializer


class InterviewCancelView(APIView):
    def post(self, request, pk):
        interview = generics.get_object_or_404(Interview, pk=pk)
        if interview.status != 'scheduled':
            return Response({'error': 'Only scheduled interviews can be cancelled'},
                            status=status.HTTP_400_BAD_REQUEST)
        interview.status = 'cancelled'
        interview.save(update_fields=['status'])
        return Response(InterviewListSerializer(interview).data)


class InterviewFeedbackCreateView(generics.CreateAPIView):
    serializer_class = InterviewFeedbackSerializer

    def perform_create(self, serializer):
        interview = generics.get_object_or_404(Interview, pk=self.kwargs['pk'])
        if InterviewFeedback.objects.filter(interview=interview).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Feedback has already been submitted for this interview.'})
        interview.status = 'completed'
        interview.save(update_fields=['status'])
        serializer.save(interview=interview, interviewer=self.request.user)


class InterviewFeedbackDetailView(generics.RetrieveAPIView):
    serializer_class = InterviewFeedbackSerializer

    def get_object(self):
        return generics.get_object_or_404(
            InterviewFeedback.objects.prefetch_related('competency_ratings'),
            interview_id=self.kwargs['pk']
        )


class InterviewSummaryView(APIView):
    def get(self, request):
        user = request.user
        now = timezone.now()
        qs = Interview.objects.all()
        if user.role not in ('admin',):
            qs = qs.filter(Q(interviewer=user) | Q(created_by=user))
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


class SetRoundResultView(APIView):
    """
    PATCH /interviews/{pk}/round-result/

    Body: { "round_result": "PASS" | "FAIL" | "ON_HOLD" }

    - Sets round_result and marks round_status = COMPLETED.
    - FAIL  → auto-moves candidate to DROPPED (drop_reason=REJECTED).
    - PASS at MGMT → returns suggest_move_to_offered=true hint.
    """

    VALID_RESULTS = {'PASS', 'FAIL', 'ON_HOLD'}

    def patch(self, request, pk):
        round_result = request.data.get('round_result')
        if round_result not in self.VALID_RESULTS:
            return Response(
                {'error': f'round_result must be one of {sorted(self.VALID_RESULTS)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        interview = generics.get_object_or_404(
            Interview.objects.select_related('mapping'), pk=pk
        )

        with transaction.atomic():
            interview.round_result = round_result
            interview.round_status = 'COMPLETED'
            interview.status = 'completed'
            interview.save(update_fields=['round_result', 'round_status', 'status'])

            mapping = interview.mapping
            response_data = InterviewListSerializer(interview).data

            if round_result == 'FAIL':
                from apps.candidates.models import PipelineStageHistory, VALID_TRANSITIONS
                old_stage = mapping.macro_stage
                if 'DROPPED' in VALID_TRANSITIONS.get(old_stage, []):
                    mapping.macro_stage = 'DROPPED'
                    mapping.drop_reason = 'REJECTED'
                    mapping.moved_by = request.user
                    mapping.save(update_fields=['macro_stage', 'drop_reason', 'moved_by', 'stage_updated_at'])
                    PipelineStageHistory.objects.create(
                        mapping=mapping,
                        from_macro_stage=old_stage,
                        to_macro_stage='DROPPED',
                        moved_by=request.user,
                        remarks=f'Auto-dropped: failed {interview.round_name or interview.round_label}',
                    )
                response_data['auto_dropped'] = True

            elif round_result == 'PASS' and interview.round_name == 'MGMT':
                response_data['suggest_move_to_offered'] = True

        return Response(response_data)
