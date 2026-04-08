from django.urls import path

from .views import (
    ResumeDuplicateResolveView,
    ResumeConvertView,
    ResumeIngestionListView,
    ResumeIngestionStatusView,
    ResumeReviewView,
    ResumeUploadView,
)

urlpatterns = [
    # Phase 1
    path("upload/",              ResumeUploadView.as_view(),         name="resume-upload"),
    path("<uuid:pk>/status/",    ResumeIngestionStatusView.as_view(), name="resume-status"),
    path("",                     ResumeIngestionListView.as_view(),   name="resume-list"),

    # Phase 2
    path("<uuid:pk>/review/",              ResumeReviewView.as_view(),            name="resume-review"),
    path("<uuid:pk>/convert/",             ResumeConvertView.as_view(),           name="resume-convert"),
    path("<uuid:pk>/resolve-duplicate/",   ResumeDuplicateResolveView.as_view(),  name="resume-resolve-duplicate"),
]
