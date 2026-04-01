import uuid

from django.db import models


class EmailTemplate(models.Model):
    """
    Admin-managed email templates used by the notification system.
    Uses Django template syntax for subject and body.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_key = models.CharField(
        max_length=100,
        unique=True,
        help_text='Unique key, e.g., "requisition_submitted", "interview_invite"',
    )
    subject_template = models.CharField(max_length=500)
    body_template = models.TextField(
        help_text='Django template syntax. Available context varies by event.',
    )
    description = models.CharField(
        max_length=255,
        help_text='Human-readable description of when this template is used',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'email_templates'
        ordering = ['template_key']

    def __str__(self):
        return f'{self.template_key}: {self.description}'


class NotificationSetting(models.Model):
    """
    Toggle for each notification event type.
    Admin can enable/disable specific notification types system-wide.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_key = models.CharField(
        max_length=100,
        unique=True,
        help_text='Matches EmailTemplate.template_key',
    )
    label = models.CharField(
        max_length=255,
        help_text='Display label, e.g., "Requisition submitted notification"',
    )
    is_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_settings'
        ordering = ['event_key']

    def __str__(self):
        status = 'ON' if self.is_enabled else 'OFF'
        return f'{self.label} [{status}]'


class EmailStatus(models.TextChoices):
    QUEUED = 'queued', 'Queued'
    SENT = 'sent', 'Sent'
    FAILED = 'failed', 'Failed'


class EmailLog(models.Model):
    """Audit log of every email sent (or attempted) by the system."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_key = models.CharField(max_length=100)
    to_email = models.EmailField()
    subject = models.CharField(max_length=500)
    status = models.CharField(
        max_length=10,
        choices=EmailStatus.choices,
        default=EmailStatus.QUEUED,
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.template_key} → {self.to_email} [{self.status}]'
