from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import Job, JobCollaborator
from .serializers import JobListSerializer, JobDetailSerializer, JobCollaboratorSerializer
from apps.candidates.models import CandidateJobMapping
from apps.candidates.serializers import CandidateJobMappingSerializer


class JobListView(generics.ListAPIView):
    serializer_class = JobListSerializer
    search_fields = ['title', 'job_code', 'location']
    filterset_fields = ['status', 'department', 'hiring_manager', 'location']
    ordering_fields = ['created_at', 'title']

    def get_queryset(self):
        # All four counts are computed as conditional COUNTs in one SQL query — no per-row queries.
        qs = Job.objects.select_related('department', 'hiring_manager', 'requisition').annotate(
            applies_count=Count('candidate_mappings', distinct=True),
            shortlists_count=Count(
                'candidate_mappings',
                filter=Q(candidate_mappings__stage__in=['shortlisted', 'interview', 'selected', 'offered', 'joined']),
                distinct=True,
            ),
            offers_count=Count(
                'candidate_mappings',
                filter=Q(candidate_mappings__stage__in=['offered', 'joined']),
                distinct=True,
            ),
            joined_count=Count(
                'candidate_mappings',
                filter=Q(candidate_mappings__stage='joined'),
                distinct=True,
            ),
        )
        tab = self.request.query_params.get('tab', 'all')
        user = self.request.user
        if tab == 'mine':
            qs = qs.filter(created_by=user)
        return qs


class JobDetailView(generics.RetrieveUpdateAPIView):
    queryset = Job.objects.select_related('department', 'hiring_manager').prefetch_related('collaborators__user')
    serializer_class = JobDetailSerializer


class JobDeleteView(APIView):
    def delete(self, request, pk):
        job = generics.get_object_or_404(Job, pk=pk)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobPipelineView(generics.ListAPIView):
    serializer_class = CandidateJobMappingSerializer

    def get_queryset(self):
        qs = CandidateJobMapping.objects.filter(
            job_id=self.kwargs['pk']
        ).select_related('candidate', 'job')
        stage = self.request.query_params.get('stage')
        if stage:
            stages = [s.strip() for s in stage.split(',') if s.strip()]
            qs = qs.filter(stage__in=stages)
        return qs


class JobPipelineStatsView(APIView):
    def get(self, request, pk):
        from apps.candidates.models import PIPELINE_STAGES
        job = generics.get_object_or_404(Job, pk=pk)
        stats = {}
        for stage_key, stage_label in PIPELINE_STAGES:
            stats[stage_key] = job.candidate_mappings.filter(stage=stage_key).count()
        stats['total'] = job.candidate_mappings.count()
        return Response(stats)


class JobCollaboratorListCreateView(generics.ListCreateAPIView):
    serializer_class = JobCollaboratorSerializer

    def get_queryset(self):
        return JobCollaborator.objects.filter(
            job_id=self.kwargs['pk']
        ).select_related('user')

    def perform_create(self, serializer):
        serializer.save(
            job_id=self.kwargs['pk'],
            added_by=self.request.user
        )


class JobCollaboratorDeleteView(APIView):
    def delete(self, request, pk, user_id):
        deleted, _ = JobCollaborator.objects.filter(
            job_id=pk, user_id=user_id
        ).delete()
        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response({'error': 'Collaborator not found'}, status=status.HTTP_404_NOT_FOUND)
