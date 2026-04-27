from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
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


class DepartmentDetailView(generics.RetrieveUpdateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method in ('PATCH', 'PUT', 'DELETE'):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def delete(self, request, *args, **kwargs):
        dept = self.get_object()
        # Safety check: block delete if users are still assigned
        assigned_count = dept.user_set.filter(is_active=True).count()
        if assigned_count > 0:
            return Response(
                {'detail': f'Cannot remove department: {assigned_count} active user(s) are still assigned to it.'},
                status=status.HTTP_409_CONFLICT,
            )
        dept.is_active = False
        dept.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


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
