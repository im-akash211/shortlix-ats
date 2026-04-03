from django.urls import path
from .views import DashboardSummaryView, DashboardFunnelView, DashboardPendingActionsView, DashboardFilterOptionsView

urlpatterns = [
    path('summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('funnel/', DashboardFunnelView.as_view(), name='dashboard-funnel'),
    path('pending-actions/', DashboardPendingActionsView.as_view(), name='dashboard-pending-actions'),
    path('filter-options/', DashboardFilterOptionsView.as_view(), name='dashboard-filter-options'),
]
