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
    PRIORITY_CHOICES = [
        ('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical'),
    ]
    EMPLOYMENT_TYPE_CHOICES = [
        ('permanent', 'Permanent'), ('contract', 'Contract'), ('internship', 'Internship'),
    ]
    REQUISITION_TYPE_CHOICES = [
        ('new', 'New'), ('backfill', 'Backfill'),
    ]
    WORK_MODE_CHOICES = [
        ('hybrid', 'Hybrid'), ('remote', 'Remote'), ('office', 'Office'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.OneToOneField(
        'requisitions.Requisition', on_delete=models.PROTECT, related_name='job'
    )
    job_code = models.CharField(max_length=15, unique=True)
    title = models.CharField(max_length=255)
    department = models.ForeignKey('departments.Department', on_delete=models.PROTECT)
    sub_vertical_1 = models.ForeignKey(
        'departments.SubVertical', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='jobs_sv1'
    )
    sub_vertical_2 = models.ForeignKey(
        'departments.SubVertical', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='jobs_sv2'
    )
    hiring_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='managed_jobs'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_jobs'
    )
    location = models.CharField(max_length=255)
    designation = models.CharField(max_length=255, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    employment_type = models.CharField(max_length=15, choices=EMPLOYMENT_TYPE_CHOICES, default='permanent')
    requisition_type = models.CharField(max_length=10, choices=REQUISITION_TYPE_CHOICES, default='new')
    work_mode = models.CharField(max_length=10, choices=WORK_MODE_CHOICES, blank=True, default='')
    positions_count = models.PositiveIntegerField(default=1)
    skills_required = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    skills_desirable = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    min_qualification = models.CharField(max_length=100, blank=True)
    job_description = models.TextField(blank=True)
    experience_min = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    experience_max = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    project_name = models.CharField(max_length=255, blank=True)
    client_name = models.CharField(max_length=255, blank=True)
    expected_start_date = models.DateField(null=True, blank=True)
    tat_days = models.PositiveIntegerField(null=True, blank=True)
    budget_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # Candidate signals — Educational
    iit_grad = models.BooleanField(default=False)
    nit_grad = models.BooleanField(default=False)
    iim_grad = models.BooleanField(default=False)
    top_institute = models.BooleanField(default=False)
    # Candidate signals — Company
    unicorn_exp = models.BooleanField(default=False)
    top_internet_product = models.BooleanField(default=False)
    top_software_product = models.BooleanField(default=False)
    top_it_services_mnc = models.BooleanField(default=False)
    top_consulting_mnc = models.BooleanField(default=False)
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
        try:
            from apps.activity.utils import log_activity
            _actor = instance.created_by
            _actor_name = (_actor.full_name or _actor.email) if _actor else 'System'
            _dept = instance.department.name if instance.department_id else ''
            _hm = instance.hiring_manager
            _hm_name = (_hm.full_name or _hm.email) if _hm else ''
            log_activity(
                actor=_actor,
                action='job_created',
                entity_type='job',
                entity_id=instance.id,
                sentence=f'{_actor_name} created job {instance.title} ({instance.job_code or ""})',
                metadata={
                    'job_id': str(instance.id),
                    'job_title': instance.title,
                    'job_code': instance.job_code or '',
                    'department': _dept,
                    'hiring_manager_name': _hm_name,
                },
            )
        except Exception:
            pass
