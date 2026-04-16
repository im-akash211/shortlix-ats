import uuid
from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Requisition(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('closed', 'Closed'),
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
    PURPOSE_CHOICES = [
        ('internal', 'Internal'), ('client', 'Client'),
    ]
    WORK_MODE_CHOICES = [
        ('hybrid', 'Hybrid'), ('remote', 'Remote'), ('office', 'Office'),
    ]
    LOCATION_CHOICES = [
        ('Gurgaon', 'Gurgaon'),
        ('Noida', 'Noida'),
        ('Remote', 'Remote'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    department = models.ForeignKey('departments.Department', on_delete=models.PROTECT)
    sub_vertical_1 = models.ForeignKey(
        'departments.SubVertical', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='requisitions_sv1'
    )
    sub_vertical_2 = models.ForeignKey(
        'departments.SubVertical', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='requisitions_sv2'
    )
    location = models.CharField(max_length=50, choices=LOCATION_CHOICES)
    designation = models.CharField(max_length=255, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    employment_type = models.CharField(max_length=15, choices=EMPLOYMENT_TYPE_CHOICES, default='permanent')
    requisition_type = models.CharField(max_length=10, choices=REQUISITION_TYPE_CHOICES, default='new')
    purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES, default='internal')
    purpose_code = models.CharField(max_length=20, blank=True, unique=True, null=True)
    positions_count = models.PositiveIntegerField(default=1)
    experience_min = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    experience_max = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    job_description = models.TextField(blank=True)
    roles_responsibilities = models.TextField(blank=True)
    skills_required = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    skills_desirable = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    skills_to_evaluate = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    tags = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    client_name = models.CharField(max_length=255, blank=True)
    project_name = models.CharField(max_length=255, blank=True)
    min_qualification = models.CharField(max_length=100, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    expected_start_date = models.DateField(null=True, blank=True)
    tat_days = models.PositiveIntegerField(null=True, blank=True, help_text='Target Turn Around Time in calendar days')
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Allocated budget in INR Lakhs')
    salary_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    work_mode = models.CharField(max_length=10, choices=WORK_MODE_CHOICES, blank=True, default='')
    # Candidate signals — Educational
    iit_grad = models.BooleanField(default=False)
    nit_grad = models.BooleanField(default=False)
    iim_grad = models.BooleanField(default=False)
    top_institute = models.BooleanField(default=False)
    # Candidate signals — Diversity
    female_diversity = models.BooleanField(default=False)
    # Candidate signals — Company
    unicorn_exp = models.BooleanField(default=False)
    top_internet_product = models.BooleanField(default=False)
    top_software_product = models.BooleanField(default=False)
    top_it_services_mnc = models.BooleanField(default=False)
    top_consulting_mnc = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_requisitions'
    )
    hiring_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='hm_requisitions'
    )
    l1_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='approval_requisitions'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Req#{self.id} - {self.title}"


class RequisitionApproval(models.Model):
    ACTION_CHOICES = [
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='approval_logs')
    action = models.CharField(max_length=15, choices=ACTION_CHOICES)
    acted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
