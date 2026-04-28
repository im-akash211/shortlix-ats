"""
Candidate creation service: converts a reviewed staging record into
a production Candidate record and links the original resume file.
"""

import logging
import re

from django.db import transaction

from apps.candidates.models import Candidate, ResumeFile
from apps.resumes.models import ResumeIngestion

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

logger = logging.getLogger(__name__)


class CandidateCreationError(Exception):
    """Raised when staging → Candidate conversion cannot proceed."""


def create_candidate_from_ingestion(ingestion: ResumeIngestion, created_by) -> Candidate:
    """
    Convert a reviewed ResumeIngestion into a Candidate record.

    Uses reviewed_output when available; falls back to llm_output.
    Links the original uploaded file to the new Candidate via ResumeFile.
    Marks the ingestion as STATUS_CONVERTED with a reference to the candidate.

    Raises
    ------
    CandidateCreationError
        When required fields (email) are missing or violate DB constraints.
    """
    parsed = getattr(ingestion, 'parsed_data', None)
    if parsed is None:
        raise CandidateCreationError(
            "No parsed data found for this ingestion. "
            "Ensure the resume has been processed before converting."
        )

    data = parsed.effective_output  # reviewed_output if present, else llm_output

    first_name = (data.get('first_name') or '').strip()
    last_name  = (data.get('last_name')  or '').strip()
    full_name  = f"{first_name} {last_name}".strip()
    email      = (data.get('email') or '').strip()

    if not full_name:
        full_name = ingestion.original_filename  # last-resort fallback

    if not email:
        raise CandidateCreationError(
            "Email address is required to create a candidate. "
            "Please add an email in the review form."
        )

    if not _EMAIL_RE.match(email):
        raise CandidateCreationError(
            f"'{email}' is not a valid email address. "
            "Please correct the email in the review form before converting."
        )

    # Guard against duplicate email (should have been caught by dedup, but be safe)
    if Candidate.objects.filter(email__iexact=email).exists():
        raise CandidateCreationError(
            f"A candidate with email '{email}' already exists. "
            "Please merge with or discard the existing record."
        )

    def _safe_float(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    experience = _safe_float(data.get('experience_years'))
    expected_ctc = _safe_float(data.get('expected_ctc_lakhs'))

    with transaction.atomic():
        candidate = Candidate.objects.create(
            full_name=full_name,
            email=email,
            phone=(data.get('phone') or '').strip(),
            designation=(data.get('designation') or '').strip(),
            current_employer=(data.get('current_company') or '').strip(),
            total_experience_years=experience,
            expected_ctc_lakhs=expected_ctc,
            skills=data.get('skills') or [],
            source='recruiter_upload',
            sub_source=ingestion.original_filename,
            parsed_data=data,
            parsing_status='done',
            created_by=created_by,
        )

        # Link original resume file for full traceability
        ResumeFile.objects.create(
            candidate=candidate,
            uploaded_by=ingestion.uploaded_by,
            file=ingestion.file,
            original_filename=ingestion.original_filename,
            file_type=ingestion.file_type,
            file_size_bytes=ingestion.file_size,
            raw_text=parsed.raw_text,
            is_latest=True,
        )

        # Mark the staging record as converted
        ingestion.status = ResumeIngestion.STATUS_CONVERTED
        ingestion.converted_candidate = candidate
        ingestion.save(update_fields=["status", "converted_candidate", "updated_at"])

    logger.info(
        "Created candidate %s (%s) from ingestion %s",
        candidate.id, candidate.full_name, ingestion.id
    )
    return candidate
