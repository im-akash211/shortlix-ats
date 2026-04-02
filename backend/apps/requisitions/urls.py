from django.urls import path
from .views import (
    RequisitionListCreateView, RequisitionDetailView,
    RequisitionSubmitView, RequisitionApproveView, RequisitionRejectView
)

urlpatterns = [
    path('', RequisitionListCreateView.as_view(), name='requisition-list'),
    path('<uuid:pk>/', RequisitionDetailView.as_view(), name='requisition-detail'),
    path('<uuid:pk>/submit/', RequisitionSubmitView.as_view(), name='requisition-submit'),
    path('<uuid:pk>/approve/', RequisitionApproveView.as_view(), name='requisition-approve'),
    path('<uuid:pk>/reject/', RequisitionRejectView.as_view(), name='requisition-reject'),
]
