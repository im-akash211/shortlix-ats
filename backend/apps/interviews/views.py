from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
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
