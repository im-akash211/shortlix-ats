from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import ResumeIngestion, ResumeParsedData

_MAX_BYTES = getattr(settings, "RESUME_MAX_FILE_SIZE_MB", 10) * 1024 * 1024
_ALLOWED_EXTENSIONS = {"pdf", "docx"}


# ── Upload (Phase 1) ──────────────────────────────────────────────────────────

class ResumeUploadSerializer(serializers.Serializer):
    """Validates an incoming resume file upload."""

    file = serializers.FileField()

    def validate_file(self, file):
        name = file.name or ""
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""

        if not ext:
            raise serializers.ValidationError("File has no extension.")

        if ext not in _ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Unsupported format '{ext}'. Only PDF and DOCX are accepted."
            )

        if file.size > _MAX_BYTES:
            limit_mb = _MAX_BYTES // (1024 * 1024)
            raise serializers.ValidationError(
                f"File size {file.size / (1024*1024):.1f} MB exceeds the {limit_mb} MB limit."
            )

        return file


# ── Parsed data read serializer ───────────────────────────────────────────────

class ResumeParsedDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeParsedData
        fields = [
            "raw_text",
            "llm_output",
            "reviewed_output",
            "extraction_confidence",
            "parser_version",
            "reviewed_at",
            "created_at",
        ]


# ── Ingestion read serializer ─────────────────────────────────────────────────

class ResumeIngestionSerializer(serializers.ModelSerializer):
    parsed_data = ResumeParsedDataSerializer(read_only=True)
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.full_name", read_only=True
    )
    converted_candidate_id = serializers.UUIDField(
        source="converted_candidate.id", read_only=True, default=None
    )
    duplicate_candidate_id = serializers.UUIDField(
        source="duplicate_candidate.id", read_only=True, default=None
    )

    class Meta:
        model = ResumeIngestion
        fields = [
            "id",
            "original_filename",
            "file_type",
            "file_size",
            "status",
            "error_message",
            "merge_decision",
            "uploaded_by",
            "uploaded_by_name",
            "converted_candidate_id",
            "duplicate_candidate_id",
            "created_at",
            "updated_at",
            "parsed_data",
        ]
        read_only_fields = fields


# ── Phase 2: Review / edit ────────────────────────────────────────────────────

class EducationEntrySerializer(serializers.Serializer):
    degree      = serializers.CharField(allow_blank=True, default="")
    institution = serializers.CharField(allow_blank=True, default="")
    year        = serializers.CharField(allow_blank=True, default="")


class ResumeReviewSerializer(serializers.Serializer):
    """
    Receives user-edited fields from the review form.
    Saves them to ResumeParsedData.reviewed_output and advances
    the ingestion status to STATUS_REVIEWED.
    """

    first_name       = serializers.CharField(allow_blank=True, default="")
    last_name        = serializers.CharField(allow_blank=True, default="")
    email            = serializers.EmailField(allow_blank=True, required=False, default="")
    phone            = serializers.CharField(allow_blank=True, default="")
    designation      = serializers.CharField(allow_blank=True, default="")
    current_company  = serializers.CharField(allow_blank=True, default="")
    experience_years    = serializers.FloatField(allow_null=True, required=False, default=None)
    expected_ctc_lakhs  = serializers.FloatField(allow_null=True, required=False, default=None)
    skills              = serializers.ListField(
        child=serializers.CharField(), allow_empty=True, default=list
    )
    education           = EducationEntrySerializer(many=True, required=False, default=list)

    def save_review(self, ingestion: ResumeIngestion, reviewer) -> ResumeIngestion:
        reviewed_data = self.validated_data

        parsed = ingestion.parsed_data
        parsed.reviewed_output = reviewed_data
        parsed.reviewed_by = reviewer
        parsed.reviewed_at = timezone.now()
        parsed.save(update_fields=["reviewed_output", "reviewed_by", "reviewed_at"])

        ingestion.status = ResumeIngestion.STATUS_REVIEWED
        ingestion.error_message = ""
        ingestion.save(update_fields=["status", "error_message", "updated_at"])

        return ingestion


# ── Phase 2: Duplicate resolution ─────────────────────────────────────────────

class DuplicateResolutionSerializer(serializers.Serializer):
    DECISIONS = [("merge", "Merge"), ("force_create", "Force Create"), ("discard", "Discard")]

    decision = serializers.ChoiceField(choices=[d[0] for d in DECISIONS])


# ── Minimal candidate snapshot (used in dedup response) ───────────────────────

class CandidateSnapshotSerializer(serializers.Serializer):
    """Lightweight read-only snapshot of a Candidate for dedup display."""

    id               = serializers.UUIDField()
    full_name        = serializers.CharField()
    email            = serializers.EmailField()
    phone            = serializers.CharField()
    designation      = serializers.CharField()
    current_employer = serializers.CharField()
    source           = serializers.CharField()
    created_at       = serializers.DateTimeField()
