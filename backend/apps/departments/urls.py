from django.urls import path
from .views import DepartmentListCreateView, SubVerticalListCreateView

urlpatterns = [
    path('', DepartmentListCreateView.as_view(), name='department-list'),
    path('<uuid:dept_id>/sub-verticals/', SubVerticalListCreateView.as_view(), name='subvertical-list'),
]
