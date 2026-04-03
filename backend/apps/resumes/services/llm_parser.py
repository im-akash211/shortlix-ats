import json
import logging
import time
from typing import List, Optional

import google.generativeai as genai
from google.api_core import exceptions
from django.conf import settings
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


# ── Pydantic output schema (for final validation only) ─────────────────────────

class EducationEntry(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""


class ParsedResumeSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = None
    designation: Optional[str] = None
    current_company: Optional[str] = None
    education: List[EducationEntry] = Field(default_factory=list)


# ── Gemini-compatible response schema dict ─────────────────────────────────────
# Manually crafted to use only fields supported by protos.Schema in
# google-generativeai 0.8.x (no "default", no "anyOf", no "$ref").

_GEMINI_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "full_name": {
            "type": "string",
            "nullable": True,
            "description": "Candidate's full name",
        },
        "email": {
            "type": "string",
            "nullable": True,
            "description": "Candidate's email address",
        },
        "phone": {
            "type": "string",
            "nullable": True,
            "description": "Candidate's contact phone number",
        },
        "skills": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Flat list of individual skills (not categories)",
        },
        "experience_years": {
            "type": "number",
            "nullable": True,
            "description": "Total years of professional experience as a numeric value",
        },
        "designation": {
            "type": "string",
            "nullable": True,
            "description": "Most recent job title",
        },
        "current_company": {
            "type": "string",
            "nullable": True,
            "description": "Most recent employer name",
        },
        "education": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "degree":      {"type": "string", "description": "Degree or certification name"},
                    "institution": {"type": "string", "description": "School or university name"},
                    "year":        {"type": "string", "description": "Graduation year or date range"},
                },
                "required": ["degree", "institution", "year"],
            },
            "description": "List of educational qualifications",
        },
    },
    "required": ["skills", "education"],
}


# ── API Key Rotation ───────────────────────────────────────────────────────────

class APIKeyRotator:
    """Rotates through multiple API keys to handle rate limits."""

    def __init__(self, keys: List[str]):
        if not keys:
            raise ValueError("No API keys provided for Gemini API.")
        self.keys = keys
        self.index = 0

    def get_next_key(self) -> str:
        key = self.keys[self.index]
        self.index = (self.index + 1) % len(self.keys)
        return key

    @property
    def key_count(self):
        return len(self.keys)


# Initialized lazily to avoid module-load issues when settings aren't ready
_rotator: Optional["APIKeyRotator"] = None


def _get_rotator() -> "APIKeyRotator":
    global _rotator
    if _rotator is None:
        keys = getattr(settings, "GEMINI_API_KEYS", [])
        if not keys:
            raise LLMParsingError("GEMINI_API_KEYS is not configured in settings")
        _rotator = APIKeyRotator(keys)
    return _rotator


# ── Error type ─────────────────────────────────────────────────────────────────

class LLMParsingError(Exception):
    """Raised when LLM parsing fails for any reason."""


# ── Public function ────────────────────────────────────────────────────────────

def parse_resume_with_llm(raw_text: str, max_retries: int = 3) -> dict:
    """
    Send resume text to Gemini and return a validated structured dict.
    Uses API key rotation and native structured output (response_mime_type + schema dict).
    """
    if not raw_text or not raw_text.strip():
        raise LLMParsingError("Empty text provided — nothing to parse")

    rotator = _get_rotator()
    model_name = getattr(settings, "GEMINI_MODEL_NAME", "gemini-2.0-flash")
    truncated_text = raw_text[:20_000]

    total_allowed_attempts = max(max_retries, rotator.key_count)
    attempts = 0

    while attempts < total_allowed_attempts:
        current_key = rotator.get_next_key()
        attempts += 1

        try:
            genai.configure(api_key=current_key)

            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=(
                    "You are an expert resume parser. "
                    "Extract structured information from the provided resume text."
                ),
            )

            response = model.generate_content(
                f"Extract all data from this resume:\n\n{truncated_text}",
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=_GEMINI_RESPONSE_SCHEMA,
                ),
            )

            parsed_dict = json.loads(response.text)

            # Validate and normalise with Pydantic
            validated = ParsedResumeSchema(**parsed_dict)
            return validated.model_dump()

        except exceptions.ResourceExhausted:
            logger.warning("Rate limit hit (attempt %d/%d). Rotating key…", attempts, total_allowed_attempts)
            if attempts >= total_allowed_attempts:
                raise LLMParsingError("All API keys exhausted or rate-limited.")
            time.sleep(1)
            continue

        except (json.JSONDecodeError, ValidationError) as exc:
            logger.error("Schema validation failed: %s", exc)
            raise LLMParsingError(f"LLM returned data that didn't match the schema: {exc}")

        except LLMParsingError:
            raise

        except Exception as exc:
            logger.exception("Unexpected error during Gemini call: %s", exc)
            if attempts >= total_allowed_attempts:
                raise LLMParsingError(f"Gemini API failure after {attempts} attempts: {exc}")
            continue

    raise LLMParsingError("Failed to parse resume after multiple attempts.")
