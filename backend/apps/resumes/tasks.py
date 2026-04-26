"""
Celery tasks for the resume ingestion pipeline.

Flow:
  STATUS_QUEUED → STATUS_PROCESSING → STATUS_PARSED
                                    → STATUS_REVIEW_PENDING  (empty/unreadable text)
                                    → STATUS_FAILED          (extraction / LLM error)
"""

import logging

from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def process_resume(self, ingestion_id: str):
    """
    Full resume processing pipeline for a single ResumeIngestion record.

    Steps:
      1. Mark as processing
      2. Extract raw text from file (PDF / DOCX)
      3. Send text to Gemini for structured parsing
      4. Persist ResumeParsedData and mark as parsed
    """
    from apps.resumes.models import ResumeIngestion, ResumeParsedData
    from apps.resumes.services.text_extractor import TextExtractionError, extract_text
    from apps.resumes.services.llm_parser import LLMParsingError, parse_resume_with_llm

    # ── Fetch record ───────────────────────────────────────────────────────────
    try:
        ingestion = ResumeIngestion.objects.get(pk=ingestion_id)
    except ResumeIngestion.DoesNotExist:
        logger.error("process_resume: ResumeIngestion %s not found", ingestion_id)
        return

    # ── Mark as processing ─────────────────────────────────────────────────────
    ingestion.status = ResumeIngestion.STATUS_PROCESSING
    ingestion.error_message = ""
    ingestion.save(update_fields=["status", "error_message", "updated_at"])

    # ── Step 1: Text extraction ────────────────────────────────────────────────
    try:
        source = ingestion.temp_file if ingestion.temp_file else ingestion.file
        source.open("rb")
        raw_text = extract_text(source, ingestion.file_type)
        source.close()
    except TextExtractionError as exc:
        logger.warning("Text extraction failed [%s]: %s", ingestion_id, exc)
        _fail(ingestion, str(exc))
        return
    except Exception as exc:
        logger.exception("Unexpected read error [%s]", ingestion_id)
        _fail(ingestion, f"File read error: {exc}")
        return

    # ── Scenario B: Empty text (scanned PDF / blank doc) ──────────────────────
    if not raw_text or len(raw_text.strip()) < 20:
        ingestion.status = ResumeIngestion.STATUS_REVIEW_PENDING
        ingestion.error_message = "OCR required or empty extracted text"
        ingestion.save(update_fields=["status", "error_message", "updated_at"])
        logger.info("Empty text for ingestion %s — marked review_pending", ingestion_id)
        return

    # ── Step 2: LLM parsing ────────────────────────────────────────────────────
    try:
        llm_output = parse_resume_with_llm(raw_text)
    except LLMParsingError as exc:
        logger.warning("LLM parsing failed [%s]: %s", ingestion_id, exc)
        error_str = str(exc)
        if "API failure" in error_str or "rate-limited" in error_str:
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                _fail(ingestion, f"LLM service unavailable after retries: {exc}")
        else:
            _fail(ingestion, error_str)
        return
    except Exception as exc:
        logger.exception("Unexpected LLM error [%s]", ingestion_id)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _fail(ingestion, f"Unexpected LLM error: {exc}")
        return

    # ── Step 3: Persist results atomically ─────────────────────────────────────
    with transaction.atomic():
        ResumeParsedData.objects.update_or_create(
            ingestion=ingestion,
            defaults={
                "raw_text": raw_text,
                "llm_output": llm_output,
                "parser_version": "v1",
            },
        )
        ingestion.status = ResumeIngestion.STATUS_PARSED
        ingestion.error_message = ""
        ingestion.save(update_fields=["status", "error_message", "updated_at"])

    logger.info("Resume %s parsed successfully", ingestion_id)


def _fail(ingestion, message: str) -> None:
    ingestion.status = ingestion.STATUS_FAILED
    ingestion.error_message = message
    ingestion.save(update_fields=["status", "error_message", "updated_at"])
