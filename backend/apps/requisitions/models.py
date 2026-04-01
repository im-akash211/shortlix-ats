import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class RequisitionPriority(models.TextChoices):
    LOW = 'low', 'Low'
    MEDIUM = 'medium', 'Medium'
    HIGH = 'high', 'High'
    CRITICAL = 'critical', 'Critical'


class EmploymentType(models.TextChoices):
    PERMANENT = 'permanent', 'Permanent'
    CONTRACT = 'contract', 'Contract'
    INTERNSHIP = 'internship', 'Internship'


class RequisitionType(models.TextChoices):
    NEW = 'new', 'New'
    BACKFILL = 'backfill', 'Backfill'


class RequisitionStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    PENDING_APPROVAL = 'pending_approval', 'Pending Approval'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'
    CLOSED = 'closed', 'Closed'


class Requisition(models.Model):
    """
    A formal hiring request created by a Recruiter and submitted for approval
    to the Hiring Manager / L1 Approver. Once approved, auto-creates a Job.

    Contains all 20+ fields from the product requisition form, including
    two sub-vertical foreign keys (sub_vertical_1 and sub_vertical_2).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Basic Info ────────────────────────────────────────────────────────────
    title = models.CharField(max_length=255)
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='requisitions',
    )
    sub_vertical_1 = models.ForeignKey(
        'departments.SubVertical',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='requisitions_sv1',
        help_text='Primary sub-vertical',
    )
    sub_vertical_2 = models.ForeignKey(
        'departments.SubVertical',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='requisitions_sv2',
        help_text='Secondary sub-vertical',
    )
    location = models.CharField(max_length=255)
    designation = models.CharField(max_length=255)

    # ── Type & Priority ───────────────────────────────────────────────────────
    priority = models.CharField(
        max_length=10,
        choices=RequisitionPriority.choices,
        default=RequisitionPriority.MEDIUM,
    )
    employment_type = models.CharField(
        max_length=15,
        choices=EmploymentType.choices,
        default=EmploymentType.PERMANENT,
    )
    requisition_type = models.CharField(
        max_length=10,
        choices=RequisitionType.choices,
        default=RequisitionType.NEW,
    )

    # ── Numbers ───────────────────────────────────────────────────────────────
    positions_count = models.PositiveIntegerField(default=1)
    experience_min = models.DecimalField(max_digits=4, decimal_places=1)
    experience_max = models.DecimalField(max_digits=4, decimal_places=1)
    ctc_min_lakhs = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Minimum CTC in INR Lakhs',
    )
    ctc_max_lakhs = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Maximum CTC in INR Lakhs',
    )

    # ── Content ───────────────────────────────────────────────────────────────
    job_description = models.TextField(
        help_text='Rich-text job description (can be AI-generated)',
    )
    roles_responsibilities = models.TextField(
        help_text='Rich-text roles & responsibilities (can be AI-generated)',
    )
    skills_required = ArrayField(
        models.CharField(max_length=100),
        default=list,
        help_text='Mandatory skills (multi-tag)',
    )
    skills_desirable = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text='Nice-to-have skills (multi-tag)',
    )

    # ── Optional Fields ───────────────────────────────────────────────────────
    client_name = models.CharField(max_length=255, blank=True)
    project_name = models.CharField(max_length=255, blank=True)
    min_qualification = models.CharField(max_length=100, blank=True)
    diversity_preference = models.BooleanField(default=False)
    institute_preference = ArrayField(
        models.CharField(max_length=255),
        default=list,
        blank=True,
        help_text='Preferred institutes (multi-select)',
    )
    expected_start_date = models.DateField(null=True, blank=True)

    # ── Relations ─────────────────────────────────────────────────────────────
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_requisitions',
        help_text='Recruiter who created this requisition',
    )
    hiring_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='hm_requisitions',
        help_text='Hiring Manager for this role',
    )
    l1_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='approval_requisitions',
        help_text='L1 Approver (receives approval request)',
    )

    # ── Status ────────────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=RequisitionStatus.choices,
        default=RequisitionStatus.DRAFT,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'requisitions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'department'], name='idx_req_status_dept'),
            models.Index(fields=['created_by'], name='idx_req_created_by'),
            models.Index(fields=['hiring_manager'], name='idx_req_hiring_mgr'),
            models.Index(fields=['l1_approver', 'status'], name='idx_req_approver_status'),
        ]

    def __str__(self):
        return f'Req#{self.id.hex[:8]} — {self.title}'


class ApprovalAction(models.TextChoices):
    SUBMITTED = 'submitted', 'Submitted'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class RequisitionApproval(models.Model):
    """
    Immutable audit trail of every approval status transition.
    A new row is created for each submit / approve / reject action.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(
        Requisition,
        on_delete=models.CASCADE,
        related_name='approvals',
    )
    action = models.CharField(max_length=10, choices=ApprovalAction.choices)
    acted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='approval_actions',
    )
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'requisition_approvals'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.requisition} — {self.action} by {self.acted_by}'
