import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class JobStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    HIDDEN = 'hidden', 'Hidden'
    CLOSED = 'closed', 'Closed'


class Job(models.Model):
    """
    An active job opening, auto-created when a requisition is approved.
    Fields are denormalized from the parent requisition so they can be
    edited independently after creation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.OneToOneField(
        'requisitions.Requisition',
        on_delete=models.PROTECT,
        related_name='job',
    )
    job_code = models.CharField(
        max_length=20,
        unique=True,
        help_text='Auto-generated: JOB-2026-0001',
    )

    # ── Denormalized from requisition ─────────────────────────────────────────
    title = models.CharField(max_length=255)
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='jobs',
    )
    hiring_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='managed_jobs',
    )
    location = models.CharField(max_length=255)
    designation = models.CharField(max_length=255, blank=True)
    skills_required = ArrayField(
        models.CharField(max_length=100),
        default=list,
    )
    job_description = models.TextField()
    experience_min = models.DecimalField(max_digits=4, decimal_places=1)
    experience_max = models.DecimalField(max_digits=4, decimal_places=1)
    positions_count = models.PositiveIntegerField(default=1)

    # ── Status & Counters ─────────────────────────────────────────────────────
    status = models.CharField(
        max_length=10,
        choices=JobStatus.choices,
        default=JobStatus.OPEN,
        db_index=True,
    )
    view_count = models.PositiveIntegerField(default=0)
    positions_filled = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'jobs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'department'], name='idx_job_status_dept'),
        ]

    def __str__(self):
        return f'{self.job_code} — {self.title}'


class JobCollaborator(models.Model):
    """
    Recruiter or interviewer assigned to work on a job.
    Only collaborators (and admins) can access a job's candidate pipeline.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name='collaborators',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_collaborations',
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='collaborator_additions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'job_collaborators'
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'user'],
                name='unique_job_collaborator',
            ),
        ]

    def __str__(self):
        return f'{self.user.full_name} on {self.job.job_code}'
