import uuid
from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


PIPELINE_STAGES = [
    ('pending', 'Pending'),
    ('shortlisted', 'Shortlisted'),
    ('interview', 'Interview'),
    ('on_hold', 'On Hold'),
    ('selected', 'Selected'),
    ('rejected', 'Rejected'),
    ('offered', 'Offered'),
    ('joined', 'Joined'),
]


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
    expected_ctc_lakhs = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    notice_period_days = models.PositiveIntegerField(null=True, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
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
    file = models.FileField(upload_to='resumes/%Y/%m/')
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
    stage = models.CharField(max_length=20, choices=PIPELINE_STAGES, default='pending')
    moved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    stage_updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'job'], name='unique_candidate_job'),
        ]
        ordering = ['-created_at']


class PipelineStageLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(CandidateJobMapping, on_delete=models.CASCADE, related_name='stage_logs')
    from_stage = models.CharField(max_length=30, blank=True)
    to_stage = models.CharField(max_length=30)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    notes = models.TextField(blank=True)
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
