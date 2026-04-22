from django.urls import path
from .views import (
    CandidateListCreateView, CandidateDetailView, CandidateDeleteView,
    CandidateNoteListCreateView, CandidateNoteDetailView, CandidateAssignJobView,
    CandidateChangeStageView, CandidateMoveJobView, CandidateShareView,
    NextRoundView, JumpToRoundView, SetScreeningStatusView,
    CandidateJobCommentListCreateView,
    CandidateReminderListCreateView, CandidateReminderUpdateDeleteView,
)

urlpatterns = [
    path('', CandidateListCreateView.as_view(), name='candidate-list'),
    path('<uuid:pk>/', CandidateDetailView.as_view(), name='candidate-detail'),
    path('<uuid:pk>/notes/', CandidateNoteListCreateView.as_view(), name='candidate-notes'),
    path('<uuid:pk>/notes/<uuid:note_id>/', CandidateNoteDetailView.as_view(), name='candidate-note-detail'),
    path('<uuid:pk>/assign-job/', CandidateAssignJobView.as_view(), name='candidate-assign-job'),
    path('<uuid:pk>/jobs/<uuid:job_id>/stage/', CandidateChangeStageView.as_view(), name='candidate-change-stage'),
    path('<uuid:pk>/jobs/<uuid:job_id>/screening-status/', SetScreeningStatusView.as_view(), name='candidate-screening-status'),
    path('<uuid:pk>/jobs/<uuid:job_id>/interview/next-round/', NextRoundView.as_view(), name='candidate-next-round'),
    path('<uuid:pk>/jobs/<uuid:job_id>/interview/jump-round/', JumpToRoundView.as_view(), name='candidate-jump-round'),
    path('<uuid:pk>/move-job/', CandidateMoveJobView.as_view(), name='candidate-move-job'),
    path('<uuid:pk>/delete/', CandidateDeleteView.as_view(), name='candidate-delete'),
    path('<uuid:pk>/share/', CandidateShareView.as_view(), name='candidate-share'),
    path('<uuid:pk>/jobs/<uuid:job_id>/comments/', CandidateJobCommentListCreateView.as_view(), name='candidate-job-comments'),
    path('<uuid:pk>/reminders/', CandidateReminderListCreateView.as_view(), name='candidate-reminders'),
    path('<uuid:pk>/reminders/<uuid:reminder_id>/', CandidateReminderUpdateDeleteView.as_view(), name='candidate-reminder-detail'),
]
