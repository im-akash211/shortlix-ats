import uuid
from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


ALLOWED_TRANSITIONS = {
    'open':      ['closed', 'abandoned'],
    'abandoned': ['open', 'closed'],
    'closed':    [],
}


class Job(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'), ('abandoned', 'Abandoned'), ('closed', 'Closed'),
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


class JobHistory(models.Model):
    EVENT_CHOICES = [
        ('job_created',            'Job Created'),
        ('status_changed',         'Status Changed'),
        ('collaborator_added',     'Collaborator Added'),
        ('collaborator_removed',   'Collaborator Removed'),
        ('tat_updated',            'TAT Updated'),
        ('budget_updated',         'Budget Updated'),
        ('department_changed',     'Department Changed'),
        ('hiring_manager_changed', 'Hiring Manager Changed'),
        ('jd_updated',             'JD Updated'),
        ('title_updated',          'Title Updated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='history')
    event_type = models.CharField(max_length=30, choices=EVENT_CHOICES)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    description = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} — {self.job_id}"


@receiver(post_save, sender=Job)
def log_job_created(sender, instance, created, **kwargs):
    if created:
        JobHistory.objects.create(
            job=instance,
            event_type='job_created',
            changed_by=instance.created_by,
            description='Job created',
        )
