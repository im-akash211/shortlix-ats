import uuid
from django.conf import settings
from django.db import models


class ResumeIngestion(models.Model):
    STATUS_UPLOADED = "uploaded"
    STATUS_QUEUED = "queued"
    STATUS_PROCESSING = "processing"
    STATUS_PARSED = "parsed"
    STATUS_FAILED = "failed"
    STATUS_REVIEW_PENDING = "review_pending"

    STATUS_CHOICES = [
        (STATUS_UPLOADED, "Uploaded"),
        (STATUS_QUEUED, "Queued"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_PARSED, "Parsed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_REVIEW_PENDING, "Review Pending"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="resume_ingestions",
    )
    file = models.FileField(upload_to="resumes/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    file_size = models.BigIntegerField(help_text="File size in bytes")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_UPLOADED, db_index=True
    )
    error_message = models.TextField(blank=True)
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
    llm_output = models.JSONField(default=dict)
    extraction_confidence = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    parser_version = models.CharField(max_length=20, default="v1")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "resume_parsed_data"

    def __str__(self):
        return f"ParsedData for ingestion {self.ingestion_id}"
