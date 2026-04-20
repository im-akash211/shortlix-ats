import uuid
from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


# ---------------------------------------------------------------------------
# Macro stage choices (replaces the old flat PIPELINE_STAGES)
# ---------------------------------------------------------------------------
MACRO_STAGE_CHOICES = [
    ('APPLIED', 'Applied'),
    ('SHORTLISTED', 'Shortlisted'),
    ('INTERVIEW', 'Interview'),
    ('OFFERED', 'Offered'),
    ('JOINED', 'Joined'),
    ('DROPPED', 'Dropped'),
]

OFFER_STATUS_CHOICES = [
    ('OFFER_SENT', 'Offer Sent'),
    ('OFFER_ACCEPTED', 'Offer Accepted'),
    ('OFFER_DECLINED', 'Offer Declined'),
]

DROP_REASON_CHOICES = [
    ('REJECTED', 'Rejected'),
    ('CANDIDATE_DROP', 'Candidate Drop'),
    ('NO_SHOW', 'No Show'),
]

PRIORITY_CHOICES = [
    ('LOW', 'Low'),
    ('MEDIUM', 'Medium'),
    ('HIGH', 'High'),
]

SCREENING_STATUS_CHOICES = [
    ('SCREENED', 'Screened'),
    ('MAYBE', 'Maybe'),
    ('REJECTED', 'Rejected'),
]

ROUND_CHOICES = [
    ('R1', 'Round 1'),
    ('R2', 'Round 2'),
    ('CLIENT', 'Client Round'),
    ('CDO', 'CDO Round'),
    ('MGMT', 'Management Round'),
]

# Ordered progression for guided next-round flow
ROUND_PROGRESSION = ['R1', 'R2', 'CLIENT', 'CDO', 'MGMT']

# Numeric order for comparing stages (used for dimmed-card queries)
STAGE_ORDER = {
    'APPLIED': 0,
    'SHORTLISTED': 1,
    'INTERVIEW': 2,
    'OFFERED': 3,
    'JOINED': 4,
    'DROPPED': 5,
}

# Valid macro-stage transitions
VALID_TRANSITIONS = {
    'APPLIED':     ['SHORTLISTED', 'DROPPED'],
    'SHORTLISTED': ['INTERVIEW', 'DROPPED'],
    # INTERVIEW → INTERVIEW is valid (round progression within interview stage)
    'INTERVIEW':   ['INTERVIEW', 'OFFERED', 'DROPPED'],
    'OFFERED':     ['JOINED', 'DROPPED'],
    'JOINED':      [],
    'DROPPED':     [],
}


class Candidate(models.Model):
    SOURCE_CHOICES = [
        ('recruiter_upload', 'Recruiter Upload'),
        ('naukri', 'Naukri'),
        ('linkedin', 'LinkedIn'),
        ('referral', 'Referral'),
        ('manual', 'Manual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    designation = models.CharField(max_length=255, blank=True)
    current_employer = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    total_experience_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    skills = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    current_ctc_lakhs = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    notice_period_days = models.PositiveIntegerField(null=True, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual', db_index=True)
    sub_source = models.CharField(max_length=255, blank=True)
    parsed_data = models.JSONField(blank=True, default=dict, help_text='Full structured extraction from Claude API')
    parsing_status = models.CharField(
        max_length=10,
        choices=[('pending', 'Pending'), ('done', 'Done'), ('failed', 'Failed'), ('skipped', 'Skipped')],
        default='skipped'
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.full_name


class ResumeFile(models.Model):
    FILE_TYPE_CHOICES = [('pdf', 'PDF'), ('docx', 'DOCX')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='resume_files')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='uploaded_resumes'
    )
    file = models.FileField(upload_to='ats/resumes/')
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=4, choices=FILE_TYPE_CHOICES)
    file_size_bytes = models.PositiveIntegerField()
    raw_text = models.TextField(blank=True, help_text='Extracted text from resume (before AI parsing)')
    is_latest = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'resume_files'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.candidate.full_name} - {self.original_filename}"


class CandidateJobMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='job_mappings')
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='candidate_mappings')

    # Core pipeline stage
    macro_stage = models.CharField(
        max_length=15, choices=MACRO_STAGE_CHOICES, default='APPLIED', db_index=True
    )

    # Micro-status fields — only populated when relevant macro_stage is active
    offer_status = models.CharField(
        max_length=20, choices=OFFER_STATUS_CHOICES, null=True, blank=True
    )
    drop_reason = models.CharField(
        max_length=20, choices=DROP_REASON_CHOICES, null=True, blank=True
    )

    # Interview tracking
    current_interview_round = models.CharField(
        max_length=10, choices=ROUND_CHOICES, null=True, blank=True
    )
    next_interview_date = models.DateTimeField(null=True, blank=True)

    # Priority for sorting and display
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')

    # Screening status for APPLIED stage classification
    screening_status = models.CharField(
        max_length=20,
        choices=SCREENING_STATUS_CHOICES,
        null=True,
        blank=True,
    )

    moved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    stage_updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'job'], name='unique_candidate_job'),
        ]
        indexes = [
            # Composite index for pipeline column queries filtering on (job_id, macro_stage)
            models.Index(fields=['job', 'macro_stage'], name='cjm_job_macro_stage_idx'),
        ]
        ordering = ['-created_at']


class PipelineStageHistory(models.Model):
    """Append-only audit log of every macro-stage transition for a candidate-job mapping."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        CandidateJobMapping, on_delete=models.CASCADE, related_name='stage_logs'
    )
    from_macro_stage = models.CharField(max_length=15, blank=True)
    to_macro_stage = models.CharField(max_length=15)
    moved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class CandidateNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='notes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
