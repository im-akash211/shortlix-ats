import datetime
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination

from apps.activity.models import ActivityLog
from apps.activity.serializers import ActivityLogSerializer
from apps.core.permissions import IsAdmin


class ActivityLogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ActivityLogListView(generics.ListAPIView):
    serializer_class   = ActivityLogSerializer
    permission_classes = [IsAdmin]
    pagination_class   = ActivityLogPagination

    def get_queryset(self):
        qs = ActivityLog.objects.select_related('actor').all()
        params = self.request.query_params

        date_from = params.get('date_from')
        date_to   = params.get('date_to')
        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(
                    created_at__gte=timezone.make_aware(datetime.datetime.combine(d, datetime.time.min))
                )
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(
                    created_at__lte=timezone.make_aware(datetime.datetime.combine(d, datetime.time.max))
                )

        actor = params.get('actor')
        if actor:
            qs = qs.filter(actor_id=actor)

        action = params.get('action')
        if action:
            qs = qs.filter(action=action)

        entity_type = params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)

        return qs
