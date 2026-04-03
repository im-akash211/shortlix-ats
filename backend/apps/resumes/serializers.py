from django.conf import settings
from rest_framework import serializers

from .models import ResumeIngestion, ResumeParsedData

# Max file size derived from settings (default 10 MB)
_MAX_BYTES = getattr(settings, "RESUME_MAX_FILE_SIZE_MB", 10) * 1024 * 1024
_ALLOWED_EXTENSIONS = {"pdf", "docx"}


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
                f"Unsupported file format '{ext}'. Only PDF and DOCX are accepted."
            )

        if file.size > _MAX_BYTES:
            limit_mb = _MAX_BYTES // (1024 * 1024)
            raise serializers.ValidationError(
                f"File size {file.size / (1024*1024):.1f} MB exceeds the {limit_mb} MB limit."
            )

        return file


class ResumeParsedDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeParsedData
        fields = [
            "raw_text",
            "llm_output",
            "extraction_confidence",
            "parser_version",
            "created_at",
        ]


class ResumeIngestionSerializer(serializers.ModelSerializer):
    parsed_data = ResumeParsedDataSerializer(read_only=True)
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.full_name", read_only=True
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
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
            "updated_at",
            "parsed_data",
        ]
        read_only_fields = fields
