import uuid
from django.conf import settings
from django.db import models


class ResumeIngestion(models.Model):
    # ── Phase 1 statuses ──────────────────────────────────────────────────────
    STATUS_UPLOADED       = "uploaded"
    STATUS_QUEUED         = "queued"
    STATUS_PROCESSING     = "processing"
    STATUS_PARSED         = "parsed"          # LLM done; awaiting human review
    STATUS_FAILED         = "failed"
    STATUS_REVIEW_PENDING = "review_pending"  # OCR/empty — needs manual text entry

    # ── Phase 2 statuses ──────────────────────────────────────────────────────
    STATUS_REVIEWED       = "reviewed"        # Human reviewed & edited
    STATUS_DUPLICATE_FOUND = "duplicate_found"# Dedup hit; awaiting resolution
    STATUS_CONVERTED      = "converted"       # Candidate record created
    STATUS_DISCARDED      = "discarded"       # User chose not to import

    STATUS_CHOICES = [
        (STATUS_UPLOADED,        "Uploaded"),
        (STATUS_QUEUED,          "Queued"),
        (STATUS_PROCESSING,      "Processing"),
        (STATUS_PARSED,          "Parsed"),
        (STATUS_FAILED,          "Failed"),
        (STATUS_REVIEW_PENDING,  "Review Pending"),
        (STATUS_REVIEWED,        "Reviewed"),
        (STATUS_DUPLICATE_FOUND, "Duplicate Found"),
        (STATUS_CONVERTED,       "Converted"),
        (STATUS_DISCARDED,       "Discarded"),
    ]

    MERGE_DECISION_CHOICES = [
        ("merge",        "Merge with existing candidate"),
        ("force_create", "Force create new candidate"),
        ("discard",      "Discard this ingestion"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="resume_ingestions",
    )
    file = models.FileField(upload_to="ats/resumes/")
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    file_size = models.BigIntegerField(help_text="File size in bytes")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_UPLOADED, db_index=True
    )
    error_message = models.TextField(blank=True)

    # ── Phase 2: traceability & dedup ─────────────────────────────────────────
    converted_candidate = models.ForeignKey(
        'candidates.Candidate',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='source_ingestions',
        help_text="Candidate created from this ingestion",
    )
    duplicate_candidate = models.ForeignKey(
        'candidates.Candidate',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='duplicate_ingestions',
        help_text="Existing candidate found during dedup check",
    )
    merge_decision = models.CharField(
        max_length=20,
        choices=MERGE_DECISION_CHOICES,
        blank=True, default='',
        help_text="Decision taken when duplicate was found",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resume_ingestions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="idx_ingestion_status_date"),
            models.Index(fields=["uploaded_by", "created_at"], name="idx_ingestion_user_date"),
        ]

    def __str__(self):
        return f"{self.original_filename} [{self.status}]"


class ResumeParsedData(models.Model):
    ingestion = models.OneToOneField(
        ResumeIngestion,
        on_delete=models.CASCADE,
        related_name="parsed_data",
    )
    raw_text = models.TextField()

    # Original LLM output — NEVER overwritten after initial parse
    llm_output = models.JSONField(default=dict)

    # User-edited version stored separately to preserve original LLM output
    reviewed_output = models.JSONField(
        null=True, blank=True,
        help_text="Human-reviewed and edited version of llm_output",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_resumes',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    extraction_confidence = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    parser_version = models.CharField(max_length=20, default="v1")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "resume_parsed_data"

    def __str__(self):
        return f"ParsedData for ingestion {self.ingestion_id}"

    @property
    def effective_output(self) -> dict:
        """Returns reviewed_output if available, otherwise the raw llm_output."""
        return self.reviewed_output if self.reviewed_output else self.llm_output
