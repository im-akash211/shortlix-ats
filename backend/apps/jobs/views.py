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
from apps.core.permissions import IsAdmin


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
        qs = Job.objects.select_related('department', 'hiring_manager', 'requisition').annotate(
            applies_count=Count('candidate_mappings', distinct=True),
            shortlists_count=Count(
                'candidate_mappings',
                filter=Q(candidate_mappings__macro_stage__in=[
                    'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'JOINED'
                ]),
                distinct=True,
            ),
            offers_count=Count(
                'candidate_mappings',
                filter=Q(candidate_mappings__macro_stage__in=['OFFERED', 'JOINED']),
                distinct=True,
            ),
            joined_count=Count(
                'candidate_mappings',
                filter=Q(candidate_mappings__macro_stage='JOINED'),
                distinct=True,
            ),
        )
        tab = self.request.query_params.get('tab', 'all')
        user = self.request.user
        if tab == 'mine':
            qs = qs.filter(
                Q(created_by=user) | Q(collaborators__user=user) | Q(hiring_manager=user)
            ).distinct()
        return qs


class JobDetailView(generics.RetrieveUpdateAPIView):
    queryset = Job.objects.select_related(
        'department', 'hiring_manager', 'created_by', 'requisition', 'requisition__created_by'
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


class JobPipelineView(APIView):
    """
    GET /jobs/{pk}/pipeline/?stage=APPLIED&include_progressed=true

    Returns active candidates for the given stage first (sorted by priority DESC,
    stage_updated_at DESC), followed by dimmed candidates who have progressed past
    this stage (sorted by stage_updated_at DESC).

    Each record includes:
      - All CandidateJobMapping fields
      - is_current_stage: bool
      - can_move_next: bool
      - latest_round: {round_name, round_status, round_result} (if in INTERVIEW)
    """

    def get(self, request, pk):
        from apps.candidates.models import STAGE_ORDER, PipelineStageHistory
        from apps.candidates.serializers import CandidateJobMappingSerializer

        job = generics.get_object_or_404(Job, pk=pk)
        stage_param = request.query_params.get('stage', '').strip()
        include_progressed = request.query_params.get('include_progressed', 'false').lower() == 'true'

        base_qs = CandidateJobMapping.objects.filter(job=job).select_related(
            'candidate', 'job'
        ).prefetch_related('interviews')

        # Priority sort order helper
        PRIORITY_ORDER = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}

        def sort_key_active(m):
            return (PRIORITY_ORDER.get(m.priority, 1), -m.stage_updated_at.timestamp())

        if stage_param:
            active_qs = list(base_qs.filter(macro_stage=stage_param))
            active_qs.sort(key=sort_key_active)
        else:
            active_qs = list(base_qs.order_by('-stage_updated_at'))

        dimmed = []
        if include_progressed and stage_param:
            requested_order = STAGE_ORDER.get(stage_param, -1)
            # Candidates who passed through this stage but are now at a higher stage
            past_mapping_ids = set(
                PipelineStageHistory.objects.filter(
                    mapping__job=job,
                    from_macro_stage=stage_param,
                ).values_list('mapping_id', flat=True)
            )
            active_ids = {m.id for m in active_qs}
            dimmed = list(
                base_qs.filter(id__in=past_mapping_ids).exclude(
                    macro_stage=stage_param
                ).exclude(id__in=active_ids)
            )
            dimmed.sort(key=lambda m: -m.stage_updated_at.timestamp())

        results = []
        for mapping in active_qs:
            data = CandidateJobMappingSerializer(mapping).data
            data['is_current_stage'] = True
            data['can_move_next'] = mapping.macro_stage not in ('JOINED', 'DROPPED')
            data['latest_round'] = _get_latest_round(mapping)
            results.append(data)

        for mapping in dimmed:
            data = CandidateJobMappingSerializer(mapping).data
            data['is_current_stage'] = False
            data['can_move_next'] = False
            data['latest_round'] = _get_latest_round(mapping)
            results.append(data)

        return Response(results)


def _get_latest_round(mapping):
    interview = mapping.interviews.order_by('-created_at').first()
    if not interview:
        return None
    return {
        'round_name': interview.round_name,
        'round_status': interview.round_status,
        'round_result': interview.round_result,
        'scheduled_at': interview.scheduled_at.isoformat() if interview.scheduled_at else None,
    }


class JobPipelineStatsView(APIView):
    def get(self, request, pk):
        from apps.candidates.models import MACRO_STAGE_CHOICES
        job = generics.get_object_or_404(Job, pk=pk)
        stats = {}
        for stage_key, _label in MACRO_STAGE_CHOICES:
            stats[stage_key.lower()] = job.candidate_mappings.filter(macro_stage=stage_key).count()
        stats['total'] = job.candidate_mappings.count()
        return Response(stats)


class JobCollaboratorListCreateView(generics.ListCreateAPIView):
    serializer_class = JobCollaboratorSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

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
    permission_classes = [IsAuthenticated, IsAdmin]

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
