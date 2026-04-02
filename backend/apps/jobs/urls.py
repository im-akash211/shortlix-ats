from django.urls import path
from .views import (
    JobListView, JobDetailView, JobPipelineView,
    JobPipelineStatsView, JobCollaboratorCreateView, JobCollaboratorDeleteView
)

urlpatterns = [
    path('', JobListView.as_view(), name='job-list'),
    path('<uuid:pk>/', JobDetailView.as_view(), name='job-detail'),
    path('<uuid:pk>/pipeline/', JobPipelineView.as_view(), name='job-pipeline'),
    path('<uuid:pk>/pipeline/stats/', JobPipelineStatsView.as_view(), name='job-pipeline-stats'),
    path('<uuid:pk>/collaborators/', JobCollaboratorCreateView.as_view(), name='job-collaborator-create'),
    path('<uuid:pk>/collaborators/<uuid:user_id>/', JobCollaboratorDeleteView.as_view(), name='job-collaborator-delete'),
]
