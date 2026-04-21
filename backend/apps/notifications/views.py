from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import InAppNotification
from .serializers import InAppNotificationSerializer


def _fire_due_reminders(user):
    """Create InAppNotifications for any due, unnotified reminders belonging to user."""
    from apps.candidates.models import CandidateReminder
    due = CandidateReminder.objects.filter(
        created_by=user,
        remind_at__lte=timezone.now(),
        notified=False,
        is_done=False,
    ).select_related('candidate')
    if not due.exists():
        return
    notifications = []
    ids = []
    for reminder in due:
        msg = f'Reminder for {reminder.candidate.full_name}'
        if reminder.note:
            msg += f': {reminder.note}'
        notifications.append(InAppNotification(
            recipient=user,
            sender=None,
            notification_type='reminder',
            message=msg,
            candidate=reminder.candidate,
        ))
        ids.append(reminder.id)
    InAppNotification.objects.bulk_create(notifications)
    CandidateReminder.objects.filter(id__in=ids).update(notified=True)


class NotificationListView(generics.ListAPIView):
    serializer_class = InAppNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        _fire_due_reminders(self.request.user)
        return InAppNotification.objects.filter(
            recipient=self.request.user
        ).select_related('sender', 'candidate')


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = InAppNotification.objects.get(pk=pk, recipient=request.user)
        except InAppNotification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'status': 'ok'})


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        InAppNotification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})


class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            notif = InAppNotification.objects.get(pk=pk, recipient=request.user)
        except InAppNotification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notif.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationDeleteAllView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        InAppNotification.objects.filter(recipient=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
