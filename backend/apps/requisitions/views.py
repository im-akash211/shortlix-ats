from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from apps.core.permissions import IsAdmin, IsAdminOrHM
from .models import Requisition, RequisitionApproval
from .serializers import (
    RequisitionListSerializer, RequisitionDetailSerializer,
    RequisitionCreateSerializer, RequisitionApprovalSerializer
)


class RequisitionListCreateView(generics.ListCreateAPIView):
    search_fields = ['title', 'location', 'designation']
    filterset_fields = ['status', 'department', 'hiring_manager', 'priority']
    ordering_fields = ['created_at', 'title']

    def get_queryset(self):
        qs = Requisition.objects.select_related('department', 'hiring_manager', 'created_by')
        tab = self.request.query_params.get('tab', 'all')
        user = self.request.user
        if tab == 'mine':
            qs = qs.filter(created_by=user)
        elif user.role == 'recruiter':
            qs = qs.filter(created_by=user)
        elif user.role == 'hiring_manager':
            qs = qs.filter(department=user.department)
        return qs

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

    def perform_update(self, serializer):
        if serializer.instance.status != 'draft':
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Only draft requisitions can be edited.')
        serializer.save()


class RequisitionSubmitView(APIView):
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
        return Response(RequisitionDetailSerializer(req).data)


class RequisitionApproveView(APIView):
    permission_classes = [IsAdminOrHM]

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
        return Response(RequisitionDetailSerializer(req).data)


class RequisitionRejectView(APIView):
    permission_classes = [IsAdminOrHM]

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
        return Response(RequisitionDetailSerializer(req).data)
