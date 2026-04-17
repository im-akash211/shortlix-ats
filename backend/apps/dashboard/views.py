from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncWeek
from django.utils import timezone
from datetime import timedelta
from apps.jobs.models import Job
from apps.candidates.models import CandidateJobMapping, MACRO_STAGE_CHOICES
from apps.requisitions.models import Requisition
from apps.interviews.models import Interview


def _weekly_history(queryset, date_field='created_at'):
    """Return list of {name, value} dicts bucketed by ISO week start."""
    rows = (
        queryset
        .annotate(week=TruncWeek(date_field))
        .values('week')
        .annotate(c=Count('id'))
        .order_by('week')
    )
    return [{'name': f"{row['week'].day}-{row['week'].strftime('%b-%Y')}", 'value': row['c']} for row in rows]


def _calc_trend(queryset, now, date_field='created_at'):
    """Return (pct, trend_up) comparing this 7-day window vs previous 7-day window."""
    week_start = now - timedelta(days=7)
    prev_start = now - timedelta(days=14)
    this_week = queryset.filter(**{f'{date_field}__gte': week_start}).count()
    last_week = queryset.filter(**{f'{date_field}__gte': prev_start, f'{date_field}__lt': week_start}).count()
    if last_week == 0:
        pct = 100 if this_week > 0 else 0
        trend_up = True if this_week > 0 else None
    else:
        pct = round(abs((this_week - last_week) / last_week * 100))
        trend_up = this_week >= last_week
    return pct, trend_up


class DashboardSummaryView(APIView):
    def get(self, request):
        department = request.query_params.get('department')
        job_status = request.query_params.get('status', 'open')

        jobs_qs = Job.objects.all()
        if department:
            jobs_qs = jobs_qs.filter(department_id=department)
        if job_status and job_status != 'all':
            jobs_qs = jobs_qs.filter(status=job_status)

        departments_param    = request.query_params.get('departments', '')
        hiring_managers_param = request.query_params.get('hiring_managers', '')
        locations_param      = request.query_params.get('locations', '')
        designations_param   = request.query_params.get('designations', '')

        if departments_param:
            jobs_qs = jobs_qs.filter(department_id__in=[v for v in departments_param.split(',') if v])
        if hiring_managers_param:
            jobs_qs = jobs_qs.filter(hiring_manager_id__in=[v for v in hiring_managers_param.split(',') if v])
        if locations_param:
            jobs_qs = jobs_qs.filter(location__in=[v for v in locations_param.split(',') if v])
        if designations_param:
            jobs_qs = jobs_qs.filter(title__in=[v for v in designations_param.split(',') if v])

        job_ids = list(jobs_qs.values_list('id', flat=True))
        mappings = CandidateJobMapping.objects.filter(job_id__in=job_ids)

        # One GROUP BY query instead of one COUNT per stage (was 8+ queries).
        stage_counts = dict(
            mappings.values('macro_stage').annotate(c=Count('id')).values_list('macro_stage', 'c')
        )
        total_applies = sum(stage_counts.values())

        # SQL SUM instead of fetching all rows and summing in Python.
        total_views = jobs_qs.aggregate(total=Sum('view_count'))['total'] or 0

        now = timezone.now()

        interviews_qs = Interview.objects.filter(mapping__job_id__in=job_ids)
        interviews_count = interviews_qs.count()

        # Weekly history + trend per metric
        applies_history = _weekly_history(mappings)
        applies_trend = _calc_trend(mappings, now)

        jobs_history = _weekly_history(jobs_qs)
        jobs_trend = _calc_trend(jobs_qs, now)

        interviews_history = _weekly_history(interviews_qs, date_field='scheduled_at')
        interviews_trend = _calc_trend(interviews_qs, now, date_field='scheduled_at')

        stage_history = {}
        stage_trend = {}
        for key, _ in MACRO_STAGE_CHOICES:
            qs = mappings.filter(macro_stage=key)
            stage_history[key] = _weekly_history(qs)
            stage_trend[key] = _calc_trend(qs, now)

        def make_metric(title, value, history, trend_tuple):
            pct, up = trend_tuple
            return {'title': title, 'value': value, 'history': history, 'trend_pct': pct, 'trend_up': up}

        metrics = [
            make_metric('Jobs',        jobs_qs.count(),                         jobs_history,                      jobs_trend),
            make_metric('Views',       total_views,                             applies_history,                   applies_trend),
            make_metric('Applies',     total_applies,                           applies_history,                   applies_trend),
            make_metric('Applied',     stage_counts.get('APPLIED', 0),         stage_history['APPLIED'],          stage_trend['APPLIED']),
            make_metric('Shortlisted', stage_counts.get('SHORTLISTED', 0),     stage_history['SHORTLISTED'],      stage_trend['SHORTLISTED']),
            make_metric('Interviews',  interviews_count,                        interviews_history,                interviews_trend),
            make_metric('Interview',   stage_counts.get('INTERVIEW', 0),       stage_history['INTERVIEW'],        stage_trend['INTERVIEW']),
            make_metric('Offered',     stage_counts.get('OFFERED', 0),         stage_history['OFFERED'],          stage_trend['OFFERED']),
            make_metric('Joined',      stage_counts.get('JOINED', 0),          stage_history['JOINED'],           stage_trend['JOINED']),
            make_metric('Dropped',     stage_counts.get('DROPPED', 0),         stage_history['DROPPED'],          stage_trend['DROPPED']),
        ]

        all_candidates = total_applies
        progressed = total_applies - stage_counts.get('APPLIED', 0) - stage_counts.get('DROPPED', 0)

        def source_breakdown(qs):
            # One aggregate query instead of 4 separate COUNT queries per call.
            agg = qs.aggregate(
                referral=Count('id', filter=Q(candidate__source__in=['referral'])),
                recruiter_sourced=Count('id', filter=Q(candidate__source__in=['recruiter_upload'])),
                inbound=Count('id', filter=Q(candidate__source__in=['linkedin', 'naukri'])),
                partner=Count('id', filter=Q(candidate__source__in=['manual'])),
            )
            return {
                'Referral': agg['referral'],
                'Recruiter Sourced': agg['recruiter_sourced'],
                'Inbound': agg['inbound'],
                'Partner': agg['partner'],
            }

        return Response({
            'metrics': metrics,
            'recruitment_progress': {
                'all_candidates': all_candidates,
                'progressed_candidates': progressed,
                'all_breakdown': source_breakdown(mappings),
                'progressed_breakdown': source_breakdown(mappings.exclude(macro_stage__in=['APPLIED', 'DROPPED'])),
                'offered_breakdown': source_breakdown(mappings.filter(macro_stage='OFFERED')),
                'joined_breakdown': source_breakdown(mappings.filter(macro_stage='JOINED')),
                'pipeline_stages': [
                    {'label': 'Shortlisted', 'value': stage_counts.get('SHORTLISTED', 0)},
                    {'label': 'Interview',   'value': stage_counts.get('INTERVIEW', 0)},
                    {'label': 'Applied',     'value': stage_counts.get('APPLIED', 0)},
                ],
            },
        })


class DashboardFilterOptionsView(APIView):
    def get(self, request):
        from apps.departments.models import Department
        from apps.accounts.models import User

        departments = list(Department.objects.values('id', 'name').order_by('name'))
        hiring_managers = list(
            User.objects.filter(is_active=True)
            .values('id', 'full_name', 'role')
            .order_by('full_name')
        )
        locations = list(
            Job.objects.exclude(location='')
            .values_list('location', flat=True)
            .distinct()
            .order_by('location')
        )
        designations = list(
            Job.objects.values_list('title', flat=True)
            .distinct()
            .order_by('title')
        )
        return Response({
            'departments': departments,
            'hiring_managers': hiring_managers,
            'locations': locations,
            'designations': designations,
        })


class DashboardFunnelView(APIView):
    def get(self, request):
        department = request.query_params.get('department')
        jobs_qs = Job.objects.filter(status='open')
        if department:
            jobs_qs = jobs_qs.filter(department_id=department)
        job_ids = jobs_qs.values_list('id', flat=True)
        mappings = CandidateJobMapping.objects.filter(job_id__in=job_ids)

        # One GROUP BY query instead of one COUNT per stage.
        stage_counts = dict(
            mappings.values('macro_stage').annotate(c=Count('id')).values_list('macro_stage', 'c')
        )
        funnel = [
            {'stage': key, 'label': label, 'count': stage_counts.get(key, 0)}
            for key, label in MACRO_STAGE_CHOICES
        ]
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
