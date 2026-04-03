from django.urls import path

from .views import ResumeIngestionListView, ResumeIngestionStatusView, ResumeUploadView

urlpatterns = [
    path("upload/", ResumeUploadView.as_view(), name="resume-upload"),
    path("<uuid:pk>/status/", ResumeIngestionStatusView.as_view(), name="resume-status"),
    path("", ResumeIngestionListView.as_view(), name="resume-list"),
]
