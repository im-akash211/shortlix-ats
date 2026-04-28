from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from apps.core.permissions import rbac_perm
from apps.core.rbac import has_permission
from .models import Requisition, RequisitionApproval
from .serializers import (
    RequisitionListSerializer, RequisitionDetailSerializer,
    RequisitionCreateSerializer, RequisitionApprovalSerializer
)


class GenerateRequisitionContentView(APIView):
    """
    POST /api/v1/requisitions/ai/generate/

    Body:
      {
        "department":        "<department name>",
        "requisition_title": "<role title>",
        "sub_vertical_1":    "<optional>",
        "sub_vertical_2":    "<optional>"
        "experience_min":    "<optional>"
        "experience_max":    "<optional>"
      }

    Returns: { job_description, required_skills, preferred_skills }
    One Gemini call generates all three fields simultaneously.
    """

    permission_classes = [rbac_perm('MANAGE_REQUISITIONS')]

    def post(self, request):
        department     = (request.data.get("department") or "").strip()
        req_title      = (request.data.get("requisition_title") or "").strip()
        sub_vertical_1 = (request.data.get("sub_vertical_1") or "").strip()
        designation    = (request.data.get("designation") or "").strip()
        experience_min = request.data.get("experience_min", None)
        experience_max = request.data.get("experience_max", None)

        if not department or not req_title:
            return Response(
                {"detail": "department and requisition_title are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .services.ai_generator import AIGenerationError, generate_requisition_content  # noqa: PLC0415

        try:
            result = generate_requisition_content(
                department=department,
                requisition_title=req_title,
                sub_vertical_1=sub_vertical_1,
                designation=designation,
                experience_min=experience_min,
                experience_max=experience_max,
            )
        except AIGenerationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(result, status=status.HTTP_200_OK)


class RequisitionListCreateView(generics.ListCreateAPIView):
    search_fields = ['title', 'location', 'designation']
    filterset_fields = ['status', 'department', 'hiring_manager', 'priority']
    ordering_fields = ['created_at', 'title']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [rbac_perm('MANAGE_REQUISITIONS')()]
        return [rbac_perm('MANAGE_REQUISITIONS')()]

    def get_queryset(self):
        qs = Requisition.objects.select_related('department', 'hiring_manager', 'created_by')
        tab = self.request.query_params.get('tab', 'all')
        user = self.request.user
        if tab == 'mine':
            return qs.filter(created_by=user)
        if has_permission(user, 'MANAGE_USERS'):
            return qs
        if has_permission(user, 'APPROVE_REQUISITIONS') and not has_permission(user, 'MANAGE_REQUISITIONS'):
            return qs.filter(department=user.department)
        return qs.filter(created_by=user)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RequisitionCreateSerializer
        return RequisitionListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status='draft')


class RequisitionDetailView(generics.RetrieveUpdateAPIView):
    queryset = Requisition.objects.select_related(
        'department', 'hiring_manager', 'l1_approver', 'created_by'
    ).prefetch_related('approval_logs')
    serializer_class = RequisitionDetailSerializer

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [rbac_perm('MANAGE_REQUISITIONS')()]
        return [rbac_perm('MANAGE_REQUISITIONS')()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return RequisitionCreateSerializer
        return RequisitionDetailSerializer

    def perform_update(self, serializer):
        serializer.save()


class RequisitionDeleteView(APIView):
    permission_classes = [rbac_perm('MANAGE_REQUISITIONS')]

    def delete(self, request, pk):
        req = generics.get_object_or_404(Requisition, pk=pk)
        req.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RequisitionSubmitView(APIView):
    permission_classes = [rbac_perm('MANAGE_REQUISITIONS')]

    def post(self, request, pk):
        req = generics.get_object_or_404(Requisition, pk=pk)
        if req.status != 'draft':
            return Response({'error': 'Only draft requisitions can be submitted.'},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            req.status = 'pending_approval'
            req.save(update_fields=['status', 'updated_at'])
            RequisitionApproval.objects.create(
                requisition=req, action='submitted', acted_by=request.user,
                comments=request.data.get('comments', '')
            )
        from apps.notifications.utils import notify_requisition_submitted
        notify_requisition_submitted(req, request.user)
        return Response(RequisitionDetailSerializer(req).data)


class RequisitionApproveView(APIView):
    permission_classes = [rbac_perm('APPROVE_REQUISITIONS')]

    def post(self, request, pk):
        req = generics.get_object_or_404(Requisition, pk=pk)
        if req.status != 'pending_approval':
            return Response({'error': 'Only pending requisitions can be approved.'},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            req.status = 'approved'
            req.save(update_fields=['status', 'updated_at'])
            RequisitionApproval.objects.create(
                requisition=req, action='approved', acted_by=request.user,
                comments=request.data.get('comments', '')
            )
        from apps.notifications.utils import notify_requisition_approved
        notify_requisition_approved(req, request.user)
        return Response(RequisitionDetailSerializer(req).data)


class RequisitionRejectView(APIView):
    permission_classes = [rbac_perm('APPROVE_REQUISITIONS')]

    def post(self, request, pk):
        req = generics.get_object_or_404(Requisition, pk=pk)
        if req.status != 'pending_approval':
            return Response({'error': 'Only pending requisitions can be rejected.'},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            req.status = 'rejected'
            req.save(update_fields=['status', 'updated_at'])
            RequisitionApproval.objects.create(
                requisition=req, action='rejected', acted_by=request.user,
                comments=request.data.get('comments', '')
            )
        from apps.notifications.utils import notify_requisition_rejected
        notify_requisition_rejected(req, request.user)
        return Response(RequisitionDetailSerializer(req).data)
