from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import IsAdmin
from .models import Department, SubVertical
from .serializers import DepartmentSerializer, SubVerticalSerializer


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.prefetch_related('sub_verticals').all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]


class SubVerticalListCreateView(generics.ListCreateAPIView):
    serializer_class = SubVerticalSerializer

    def get_queryset(self):
        qs = SubVertical.objects.filter(department_id=self.kwargs['dept_id'], is_active=True)
        parent = self.request.query_params.get('parent', None)
        if parent == 'null':
            qs = qs.filter(parent__isnull=True)
        elif parent:
            qs = qs.filter(parent_id=parent)
        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(department_id=self.kwargs['dept_id'])
