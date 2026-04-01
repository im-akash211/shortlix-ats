import uuid

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Auto-populated audit trail for all mutating API operations.
    Created by the AuditMixin on DRF ViewSets.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
    )
    action = models.CharField(
        max_length=10,
        choices=[
            ('CREATE', 'Create'),
            ('UPDATE', 'Update'),
            ('DELETE', 'Delete'),
        ],
    )
    entity_type = models.CharField(
        max_length=100,
        help_text='Model class name, e.g., "Requisition", "Job"',
    )
    entity_id = models.CharField(
        max_length=100,
        help_text='Primary key of the affected record',
    )
    changes = models.JSONField(
        default=dict,
        blank=True,
        help_text='Dict of {field: [old_value, new_value]} for updates',
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id'], name='idx_audit_entity'),
            models.Index(fields=['user', 'created_at'], name='idx_audit_user_date'),
        ]

    def __str__(self):
        return f'{self.action} {self.entity_type}#{self.entity_id} by {self.user}'
