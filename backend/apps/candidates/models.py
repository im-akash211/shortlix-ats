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
    ('R3', 'Round 3'),
    ('CLIENT', 'Client Round'),
    ('CDO', 'CDO Round'),
    ('MGMT', 'Management Round'),
]

# Ordered progression for guided next-round flow
ROUND_PROGRESSION = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT']

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
    'DROPPED':     ['SHORTLISTED'],
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
    tags   = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    # Education — 10th
    tenth_board = models.CharField(max_length=255, blank=True)
    tenth_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    # Education — 12th
    twelfth_board = models.CharField(max_length=255, blank=True)
    twelfth_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    # Education — Graduation
    graduation_course = models.CharField(max_length=255, blank=True)
    graduation_college = models.CharField(max_length=255, blank=True)
    graduation_year = models.PositiveIntegerField(null=True, blank=True)
    graduation_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    qualifying_exam = models.CharField(max_length=255, blank=True)
    qualifying_rank = models.CharField(max_length=255, blank=True)
    # Education — Post Graduation (optional)
    post_graduation_course = models.CharField(max_length=255, blank=True)
    post_graduation_college = models.CharField(max_length=255, blank=True)
    post_graduation_year = models.PositiveIntegerField(null=True, blank=True)
    post_graduation_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    post_qualifying_exam = models.CharField(max_length=255, blank=True)
    post_qualifying_rank = models.CharField(max_length=255, blank=True)
    # Compensation
    ctc_fixed_lakhs = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    ctc_variable_lakhs = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    current_ctc_lakhs = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    expected_ctc_lakhs = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    offers_in_hand = models.TextField(blank=True)
    # Notice period
    notice_period_days = models.PositiveIntegerField(null=True, blank=True)
    notice_period_status = models.CharField(
        max_length=10,
        choices=[('serving', 'Serving'), ('lwd', 'LWD'), ('notice', 'In Notice')],
        blank=True,
    )
    # Other HR fields
    reason_for_change = models.TextField(blank=True)
    native_location = models.CharField(max_length=255, blank=True)
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
    file_hash = models.CharField(max_length=64, blank=True, db_index=True, help_text='SHA-256 of uploaded bytes for duplicate detection')
    is_latest = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'resume_files'
        ordering = ['-created_at']

    def delete(self, *args, **kwargs):
        # Delete the actual S3 file before removing the DB record
        if self.file:
            self.file.delete(save=False)
        super().delete(*args, **kwargs)

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

    # AI match score
    ai_match_score = models.FloatField(null=True, blank=True)
    ai_match_reason = models.TextField(blank=True)
    ai_match_computed_at = models.DateTimeField(null=True, blank=True)

    # Screening status for APPLIED stage classification
    screening_status = models.CharField(
        max_length=20,
        choices=SCREENING_STATUS_CHOICES,
        null=True,
        blank=True,
    )

    # Interview rejection status — null means active, REJECTED means failed a round (stays in Interview tab)
    interview_status = models.CharField(
        max_length=20,
        choices=[('REJECTED', 'Rejected')],
        null=True,
        blank=True,
    )

    action_reason = models.CharField(max_length=255, blank=True)

    # Tracks which stage a recruiter rejection came from (APPLIED / SHORTLISTED); used
    # to show the rejected card only in that stage's tab, not every tab.
    rejected_from_stage = models.CharField(max_length=15, blank=True)

    # Cross-job move history — when a candidate is moved to a new job, the old mapping
    # is archived (is_archived=True) and the new mapping links back to it via previous_mapping.
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    previous_mapping = models.OneToOneField(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='next_mapping',
    )

    moved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    stage_updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Only one active (non-archived) mapping per candidate-job pair
            models.UniqueConstraint(
                fields=['candidate', 'job'],
                condition=models.Q(is_archived=False),
                name='unique_active_candidate_job',
            ),
        ]
        indexes = [
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


class CandidateJobComment(models.Model):
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        CandidateJobMapping, on_delete=models.CASCADE, related_name='comments'
    )
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class CandidateNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='notes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    content = models.TextField()
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class CandidateNoteHistory(models.Model):
    """Stores each previous version of a note whenever it is edited."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    note = models.ForeignKey(CandidateNote, on_delete=models.CASCADE, related_name='history')
    content = models.TextField()
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-edited_at']


class Referral(models.Model):
    STATUS_PENDING  = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_DECLINED = 'declined'

    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
    ]

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job           = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='referrals')
    employee_name = models.CharField(max_length=255)
    employee_id   = models.CharField(max_length=100)
    parsed_data   = models.JSONField(default=dict)
    raw_text      = models.TextField(blank=True)
    resume_file   = models.FileField(upload_to='ats/referrals/', null=True, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    file_type     = models.CharField(max_length=4, blank=True)
    file_size     = models.PositiveIntegerField(null=True, blank=True)
    status        = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    candidate     = models.ForeignKey(
        Candidate, on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals'
    )
    reviewed_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_referrals',
    )
    reviewed_at   = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Referral by {self.employee_name} for {self.job.title} [{self.status}]"


class CandidateReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='reminders')
    mapping = models.ForeignKey(
        CandidateJobMapping, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reminders',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='candidate_reminders'
    )
    remind_at = models.DateTimeField()
    note = models.TextField(blank=True)
    is_done = models.BooleanField(default=False)
    notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['remind_at']
