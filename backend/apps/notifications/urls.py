from django.urls import path
from .views import (
    NotificationListView, NotificationMarkReadView, NotificationMarkAllReadView,
    NotificationDeleteView, NotificationDeleteAllView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('delete-all/', NotificationDeleteAllView.as_view(), name='notification-delete-all'),
    path('<uuid:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('<uuid:pk>/delete/', NotificationDeleteView.as_view(), name='notification-delete'),
]
