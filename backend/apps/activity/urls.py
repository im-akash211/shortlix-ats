from django.urls import path
from apps.activity.views import ActivityLogListView

urlpatterns = [
    path('', ActivityLogListView.as_view(), name='activity-log-list'),
]
