from django.urls import path
from .views import (
    InterviewListCreateView, InterviewDetailView, InterviewCancelView,
    InterviewFeedbackCreateView, InterviewFeedbackDetailView, InterviewSummaryView,
    SetRoundResultView,
)

urlpatterns = [
    path('', InterviewListCreateView.as_view(), name='interview-list'),
    path('summary/', InterviewSummaryView.as_view(), name='interview-summary'),
    path('<uuid:pk>/', InterviewDetailView.as_view(), name='interview-detail'),
    path('<uuid:pk>/cancel/', InterviewCancelView.as_view(), name='interview-cancel'),
    path('<uuid:pk>/feedback/', InterviewFeedbackCreateView.as_view(), name='interview-feedback-create'),
    path('<uuid:pk>/feedback/detail/', InterviewFeedbackDetailView.as_view(), name='interview-feedback-detail'),
    path('<uuid:pk>/round-result/', SetRoundResultView.as_view(), name='interview-round-result'),
]
