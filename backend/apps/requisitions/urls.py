from django.urls import path
from .views import (
    RequisitionListCreateView, RequisitionDetailView, RequisitionDeleteView,
    RequisitionSubmitView, RequisitionApproveView, RequisitionRejectView,
    GenerateRequisitionContentView,
)

urlpatterns = [
    path('', RequisitionListCreateView.as_view(), name='requisition-list'),
    path('ai/generate/', GenerateRequisitionContentView.as_view(), name='requisition-ai-generate'),
    path('<uuid:pk>/', RequisitionDetailView.as_view(), name='requisition-detail'),
    path('<uuid:pk>/submit/', RequisitionSubmitView.as_view(), name='requisition-submit'),
    path('<uuid:pk>/approve/', RequisitionApproveView.as_view(), name='requisition-approve'),
    path('<uuid:pk>/reject/', RequisitionRejectView.as_view(), name='requisition-reject'),
    path('<uuid:pk>/delete/', RequisitionDeleteView.as_view(), name='requisition-delete'),
]
