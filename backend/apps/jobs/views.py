from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import Job, JobCollaborator, JobHistory
from .serializers import (
    JobListSerializer, JobDetailSerializer,
    JobCollaboratorSerializer, JobHistorySerializer,
)
from apps.candidates.models import CandidateJobMapping
from apps.candidates.serializers import CandidateJobMappingSerializer


def log_job_history(job, event_type, changed_by, description, previous_value=None, new_value=None):
    JobHistory.objects.create(
        job=job,
        event_type=event_type,
        changed_by=changed_by,
        description=description,
        previous_value=previous_value,
        new_value=new_value,
    )


class JobListView(generics.ListAPIView):
    serializer_class = JobListSerializer
    search_fields = ['title', 'job_code', 'location']
    filterset_fields = ['status', 'department', 'hiring_manager', 'location']
    ordering_fields = ['created_at', 'title']

    def get_queryset(self):
        # All four counts are computed as conditional COUNTs in one SQL query — no per-row queries.
        qs = Job.objects.select_related('department', 'hiring_manager').annotate(
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
    queryset = Job.objects.select_related(
        'department', 'hiring_manager', 'created_by', 'requisition'
    ).prefetch_related('collaborators__user', 'history__changed_by')
    serializer_class = JobDetailSerializer

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        old_title = instance.title
        old_dept_id = str(instance.department_id)
        old_hm_id = str(instance.hiring_manager_id)
        old_jd = instance.job_description

        updated = serializer.save()
        user = self.request.user

        if old_status != updated.status:
            log_job_history(
                updated, 'status_changed', user,
                f'Status changed: {old_status.capitalize()} → {updated.status.capitalize()}',
                previous_value={'status': old_status},
                new_value={'status': updated.status},
            )

        if old_title != updated.title:
            log_job_history(
                updated, 'title_updated', user,
                f'Title updated: "{old_title}" → "{updated.title}"',
                previous_value={'title': old_title},
                new_value={'title': updated.title},
            )

        if old_dept_id != str(updated.department_id):
            log_job_history(
                updated, 'department_changed', user,
                'Department changed',
                previous_value={'department': old_dept_id},
                new_value={'department': str(updated.department_id)},
            )

        if old_hm_id != str(updated.hiring_manager_id):
            log_job_history(
                updated, 'hiring_manager_changed', user,
                'Hiring Manager changed',
                previous_value={'hiring_manager': old_hm_id},
                new_value={'hiring_manager': str(updated.hiring_manager_id)},
            )

        if old_jd != updated.job_description:
            log_job_history(updated, 'jd_updated', user, 'Job description updated')


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
        collab = serializer.save(
            job_id=self.kwargs['pk'],
            added_by=self.request.user,
        )
        log_job_history(
            collab.job, 'collaborator_added', self.request.user,
            f'Collaborator added: {collab.user.full_name}',
            new_value={'user_id': str(collab.user.id), 'name': collab.user.full_name},
        )


class JobCollaboratorDeleteView(APIView):
    def delete(self, request, pk, user_id):
        try:
            collab = JobCollaborator.objects.select_related('user', 'job').get(
                job_id=pk, user_id=user_id
            )
            job = collab.job
            user_name = collab.user.full_name
            collab.delete()
            log_job_history(
                job, 'collaborator_removed', request.user,
                f'Collaborator removed: {user_name}',
                previous_value={'user_id': str(user_id), 'name': user_name},
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except JobCollaborator.DoesNotExist:
            return Response({'error': 'Collaborator not found'}, status=status.HTTP_404_NOT_FOUND)


class JobHistoryListView(generics.ListAPIView):
    serializer_class = JobHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return JobHistory.objects.filter(
            job_id=self.kwargs['pk']
        ).select_related('changed_by').order_by('-created_at')
