from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from apps.jobs.models import Job
from apps.candidates.models import CandidateJobMapping, PIPELINE_STAGES
from apps.requisitions.models import Requisition
from apps.interviews.models import Interview


class DashboardSummaryView(APIView):
    def get(self, request):
        department = request.query_params.get('department')
        job_status = request.query_params.get('status', 'open')

        jobs_qs = Job.objects.all()
        if department:
            jobs_qs = jobs_qs.filter(department_id=department)
        if job_status and job_status != 'all':
            jobs_qs = jobs_qs.filter(status=job_status)

        job_ids = jobs_qs.values_list('id', flat=True)
        mappings = CandidateJobMapping.objects.filter(job_id__in=job_ids)

        stage_counts = {}
        for key, label in PIPELINE_STAGES:
            stage_counts[key] = mappings.filter(stage=key).count()

        total_applies = mappings.count()
        total_views = sum(jobs_qs.values_list('view_count', flat=True))

        now = timezone.now()
        week_ago = now - timedelta(days=7)
        last_week_applies = mappings.filter(created_at__gte=week_ago).count()

        interviews_count = Interview.objects.filter(
            mapping__job_id__in=job_ids
        ).count()

        metrics = [
            {'title': 'Jobs', 'value': jobs_qs.count()},
            {'title': 'Views', 'value': total_views},
            {'title': 'Applies', 'value': total_applies},
            {'title': 'Pending', 'value': stage_counts.get('pending', 0)},
            {'title': 'Shortlists', 'value': stage_counts.get('shortlisted', 0)},
            {'title': 'Interviews', 'value': interviews_count},
            {'title': 'Final Selects', 'value': stage_counts.get('selected', 0)},
            {'title': 'Offers', 'value': stage_counts.get('offered', 0)},
            {'title': 'Joined', 'value': stage_counts.get('joined', 0)},
            {'title': 'On Hold', 'value': stage_counts.get('on_hold', 0)},
            {'title': 'Rejects', 'value': stage_counts.get('rejected', 0)},
            {'title': 'Not Joined', 'value': 0},
        ]

        all_candidates = total_applies
        progressed = total_applies - stage_counts.get('pending', 0) - stage_counts.get('rejected', 0)

        return Response({
            'metrics': metrics,
            'recruitment_progress': {
                'all_candidates': all_candidates,
                'progressed_candidates': progressed,
            },
        })


class DashboardFunnelView(APIView):
    def get(self, request):
        department = request.query_params.get('department')
        jobs_qs = Job.objects.filter(status='open')
        if department:
            jobs_qs = jobs_qs.filter(department_id=department)
        job_ids = jobs_qs.values_list('id', flat=True)
        mappings = CandidateJobMapping.objects.filter(job_id__in=job_ids)

        funnel = []
        for key, label in PIPELINE_STAGES:
            funnel.append({'stage': key, 'label': label, 'count': mappings.filter(stage=key).count()})
        return Response(funnel)


class DashboardPendingActionsView(APIView):
    def get(self, request):
        user = request.user
        pending_approvals = Requisition.objects.filter(
            status='pending_approval', l1_approver=user
        ).count()

        now = timezone.now()
        pending_feedback = Interview.objects.filter(
            interviewer=user, status='scheduled', scheduled_at__lt=now
        ).count()

        return Response({
            'pending_approvals': pending_approvals,
            'pending_feedback': pending_feedback,
        })
