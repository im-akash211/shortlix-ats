from django.urls import path
from .views import DepartmentListCreateView, DepartmentDetailView, SubVerticalListCreateView

urlpatterns = [
    path('', DepartmentListCreateView.as_view(), name='department-list'),
    path('<uuid:pk>/', DepartmentDetailView.as_view(), name='department-detail'),
    path('<uuid:dept_id>/sub-verticals/', SubVerticalListCreateView.as_view(), name='subvertical-list'),
]
