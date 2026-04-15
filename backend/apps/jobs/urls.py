from django.urls import path
from .views import (
    JobListView, JobDetailView, JobDeleteView, JobPipelineView,
    JobPipelineStatsView, JobCollaboratorListCreateView, JobCollaboratorDeleteView,
    JobHistoryListView,
)

urlpatterns = [
    path('', JobListView.as_view(), name='job-list'),
    path('<uuid:pk>/', JobDetailView.as_view(), name='job-detail'),
    path('<uuid:pk>/pipeline/', JobPipelineView.as_view(), name='job-pipeline'),
    path('<uuid:pk>/pipeline/stats/', JobPipelineStatsView.as_view(), name='job-pipeline-stats'),
    path('<uuid:pk>/collaborators/', JobCollaboratorListCreateView.as_view(), name='job-collaborator-list-create'),
    path('<uuid:pk>/collaborators/<uuid:user_id>/', JobCollaboratorDeleteView.as_view(), name='job-collaborator-delete'),
    path('<uuid:pk>/history/', JobHistoryListView.as_view(), name='job-history'),
    path('<uuid:pk>/delete/', JobDeleteView.as_view(), name='job-delete'),
]
