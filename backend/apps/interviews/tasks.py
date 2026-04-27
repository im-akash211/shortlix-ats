from celery import shared_task
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta


@shared_task(name='interviews.send_feedback_reminders')
def send_feedback_reminders():
    """
    Runs every hour via Celery Beat.
    For every interview whose end time has passed and whose feedback is still
    missing, send an in-app + email reminder to the interviewer — but no more
    than once every 24 hours per interview.
    """
    from apps.interviews.models import Interview
    from apps.notifications.utils import notify_feedback_pending_reminder

    now = timezone.now()
    reminder_cutoff = now - timedelta(hours=24)

    pending = Interview.objects.filter(
        # Interview end time has passed (scheduled_at + duration <= now)
        scheduled_at__lte=now,
        # No feedback submitted
        feedback__isnull=True,
    ).exclude(
        # Exclude interviews already marked COMPLETED
        round_status='COMPLETED',
    ).filter(
        # Either never reminded, or last reminder was 24h+ ago
        Q(last_feedback_reminder_sent__isnull=True) |
        Q(last_feedback_reminder_sent__lte=reminder_cutoff)
    ).select_related(
        'interviewer', 'mapping__candidate', 'mapping__job'
    )

    updated_ids = []
    for interview in pending:
        try:
            notify_feedback_pending_reminder(interview)
            updated_ids.append(interview.pk)
        except Exception:
            pass

    if updated_ids:
        Interview.objects.filter(pk__in=updated_ids).update(
            last_feedback_reminder_sent=now
        )

    return f'Feedback reminders sent: {len(updated_ids)}'
