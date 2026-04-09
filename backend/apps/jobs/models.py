import uuid
from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Job(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'), ('hidden', 'Hidden'), ('closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.OneToOneField(
        'requisitions.Requisition', on_delete=models.PROTECT, related_name='job'
    )
    job_code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=255)
    department = models.ForeignKey('departments.Department', on_delete=models.PROTECT)
    hiring_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='managed_jobs'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_jobs'
    )
    location = models.CharField(max_length=255)
    skills_required = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    job_description = models.TextField(blank=True)
    experience_min = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    experience_max = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open', db_index=True)
    view_count = models.PositiveIntegerField(default=0)
    positions_filled = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.job_code} - {self.title}"


class JobCollaborator(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='collaborators')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='collaborator_additions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['job', 'user'], name='unique_job_collaborator'),
        ]
