import uuid
from django.db import models
from django.conf import settings


class ActivityLog(models.Model):
    ENTITY_TYPE_CHOICES = [
        ('candidate', 'Candidate'),
        ('job', 'Job'),
        ('interview', 'Interview'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
    )
    action      = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES)
    entity_id   = models.CharField(max_length=64)
    sentence    = models.CharField(max_length=500)
    metadata    = models.JSONField(default=dict)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['actor']),
            models.Index(fields=['action']),
            models.Index(fields=['entity_type']),
        ]

    def __str__(self):
        return f'{self.action} by {self.actor_id} at {self.created_at}'
