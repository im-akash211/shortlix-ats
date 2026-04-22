from django.urls import path
from .employee_views import EmployeeJobListView, EmployeeReferralView

urlpatterns = [
    path('jobs/', EmployeeJobListView.as_view(), name='employee-jobs'),
    path('refer/', EmployeeReferralView.as_view(), name='employee-refer'),
]
