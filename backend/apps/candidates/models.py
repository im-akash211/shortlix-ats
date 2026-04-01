import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class CandidateSource(models.TextChoices):
    MANUAL = 'manual', 'Manual Upload'
    BULK = 'bulk', 'Bulk Excel Upload'
    QUICK = 'quick', 'Quick Upload'


class ParsingStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    DONE = 'done', 'Done'
    FAILED = 'failed', 'Failed'
    SKIPPED = 'skipped', 'Skipped'


class Candidate(models.Model):
    """
    Master candidate record. A candidate exists once in the system
    and can be linked to multiple jobs via CandidateJobMapping.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    designation = models.CharField(max_length=255, blank=True)
    current_employer = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    total_experience_years = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True,
    )
    skills = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
    )
    current_ctc_lakhs = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
    )
    expected_ctc_lakhs = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
    )
    notice_period_days = models.PositiveIntegerField(null=True, blank=True)

    source = models.CharField(
        max_length=10,
        choices=CandidateSource.choices,
        default=CandidateSource.MANUAL,
    )
    parsed_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Full structured extraction from Claude API',
    )
    parsing_status = models.CharField(
        max_length=10,
        choices=ParsingStatus.choices,
        default=ParsingStatus.SKIPPED,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='uploaded_candidates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidates'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['full_name'], name='idx_candidate_name'),
            models.Index(fields=['parsing_status'], name='idx_candidate_parse_status'),
        ]

    def __str__(self):
        return f'{self.full_name} ({self.email})'


class ResumeFile(models.Model):
    """
    Uploaded resume file (PDF / DOCX). A candidate may have multiple
    resume files over time; `is_latest` marks the current one.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='resume_files',
    )
    file = models.FileField(upload_to='resumes/%Y/%m/')
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(
        max_length=4,
        choices=[('pdf', 'PDF'), ('docx', 'DOCX')],
    )
    file_size_bytes = models.PositiveIntegerField()
    raw_text = models.TextField(
        blank=True,
        help_text='Extracted text from resume (before AI parsing)',
    )
    is_latest = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='uploaded_resumes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'resume_files'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.original_filename} ({self.candidate.full_name})'


class PipelineStage(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SHORTLISTED = 'shortlisted', 'Shortlisted'
    INTERVIEW = 'interview', 'Interview'
    ON_HOLD = 'on_hold', 'On Hold'
    SELECTED = 'selected', 'Selected'
    REJECTED = 'rejected', 'Rejected'
    OFFERED = 'offered', 'Offered'
    JOINED = 'joined', 'Joined'


class CandidateJobMapping(models.Model):
    """
    Core pipeline record: tracks one candidate's journey through one job.
    A candidate can exist in multiple job pipelines simultaneously.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='job_mappings',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.CASCADE,
        related_name='candidate_mappings',
    )
    stage = models.CharField(
        max_length=15,
        choices=PipelineStage.choices,
        default=PipelineStage.PENDING,
        db_index=True,
    )
    moved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='pipeline_moves',
    )
    stage_updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'candidate_job_mappings'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'job'],
                name='unique_candidate_per_job',
            ),
        ]
        indexes = [
            models.Index(fields=['job', 'stage'], name='idx_mapping_job_stage'),
        ]

    def __str__(self):
        return f'{self.candidate.full_name} → {self.job.job_code} [{self.stage}]'


class PipelineStageLog(models.Model):
    """Immutable audit trail of every pipeline stage change."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        CandidateJobMapping,
        on_delete=models.CASCADE,
        related_name='stage_logs',
    )
    from_stage = models.CharField(max_length=15, blank=True)
    to_stage = models.CharField(max_length=15)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='stage_changes',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pipeline_stage_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.mapping} : {self.from_stage} → {self.to_stage}'


class CandidateNote(models.Model):
    """Freeform notes on a candidate (CTC feedback, observations, etc.)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='notes',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='candidate_notes',
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'candidate_notes'
        ordering = ['-created_at']

    def __str__(self):
        return f'Note on {self.candidate.full_name} by {self.user.full_name}'
