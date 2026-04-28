import json
import logging
from typing import List, Optional, Union
from decimal import Decimal

from google import genai
from google.genai import types
from google.api_core import exceptions
from django.conf import settings
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


# ── Pydantic output schema ─────────────────────────────────────────────────────

class GeneratedRequisitionContent(BaseModel):
    job_description: str
    skills_required: List[str] = Field(default_factory=list)
    skills_desirable: List[str] = Field(default_factory=list)


# ── Gemini-compatible response schema dict ─────────────────────────────────────

_GEMINI_SCHEMA = {
    "type": "object",
    "properties": {
        "job_description": {
            "type": "string",
            "description": (
                "Compelling HTML-formatted job description using <p>, <strong>, <ul>, <li> tags. "
                "Include: role summary, why join, and key qualifications / expectations."
            ),
        },
        "skills_required": {
            "type": "array",
            "items": {"type": "string"},
            "description": "6-10 mandatory technical and soft skills (short phrases, no HTML).",
        },
        "skills_desirable": {
            "type": "array",
            "items": {"type": "string"},
            "description": "4-6 nice-to-have or bonus skills (short phrases, no HTML).",
        },
    },
    "required": [
        "job_description",
        "skills_required",
        "skills_desirable",
    ],
}


# ── Error type ─────────────────────────────────────────────────────────────────

class AIGenerationError(Exception):
    """Raised when AI content generation fails for any reason."""


# ── Public function ────────────────────────────────────────────────────────────

def generate_requisition_content(
    *,
    department: str,
    requisition_title: str,
    sub_vertical_1: str = "",
    designation: str = "",
    experience_min: Optional[Union[Decimal, float, int]] = 0,
    experience_max: Optional[Union[Decimal, float, int]] = 0,
) -> dict:
    """
    Generate job description, required skills, and preferred skills in a
    SINGLE Gemini API call, considering experience range.
    """
    keys = getattr(settings, "GEMINI_API_KEYS", [])
    if not keys:
        raise AIGenerationError("GEMINI_API_KEYS is not configured in settings.")

    model_name = getattr(settings, "GEMINI_MODEL_NAME", "gemini-2.0-flash")

    # ── Experience Logic & Defaulting ──
    # Convert Decimal/None to float
    exp_min = float(experience_min) if experience_min is not None else 0.0
    exp_max = float(experience_max) if experience_max is not None else 0.0

    # If both are 0 (Django default), we apply your business logic default of 0-3 years
    if exp_min == 0 and exp_max == 0:
        exp_min = 0.0
        exp_max = 2.0
    
    # Ensure min isn't higher than max by mistake
    if exp_min > exp_max and exp_max != 0:
        exp_min, exp_max = exp_max, exp_min

    # Prepare Context
    context_lines = [
        f"Department: {department}",
        f"Role Title: {requisition_title}",
        f"Target Experience Level: {exp_min} to {exp_max} years",
    ]
    if designation:
        context_lines.append(f"Designation: {designation}")
    if sub_vertical_1:
        context_lines.append(f"Sub-vertical / Practice Area 1: {sub_vertical_1}")
    context_str = "\n".join(context_lines)

    # Updated PROMPT with specific instructions for the experience range
    PROMPT = f"""You are an expert HR and Talent Acquisition Lead at a premier Generative AI and Data Engineering firm. Your goal is to generate an enterprise-grade job requisition that attracts top-tier talent by balancing technical depth with high-impact narrative.

    ### COMPANY CONTEXT:
    We are an end-to-end GenAI and Data Engineering solution provider building enterprise-grade systems including:
    - Data pipelines & Data Lakes
    - Machine Learning systems
    - LLM-powered applications
    Assume a high-growth, performance-driven environment.

    ### INPUT DATA:
    - Role Context: {context_str}
    - Experience Range: {exp_min}–{exp_max} years
    - Sub-Vertical / Domain: {sub_vertical_1}

    *If any input is missing: Make reasonable assumptions and clearly state them briefly before the JSON output.*

    ### ROLE-SPECIFIC LOGIC ENGINE:
    1. **Engineering (AI/Data/Software):** Emphasize scalability, system design, performance, and production reliability.
    2. **HR/People Roles:** Focus on culture, org design, and hiring strategy.
    3. **Sales/Growth Roles:** Focus on solution selling, pipeline, and enterprise clients.
    4. **Seniority Calibration:**
        - **Junior (0–3 yrs):** Execution, learning, and support.
        - **Mid (4–7 yrs):** Ownership, design, and collaboration.
        - **Senior/Lead (8+ yrs):** Vision, architecture, and mentoring.

    ### WRITING STYLE GUIDELINES:
    - **The Hook:** Start with a strong mission-driven hook. Naturally integrate the {exp_min}–{exp_max} years experience range within the context.
    - **Responsibilities:** Use the "Action + Purpose" format (e.g., “Drive scalable ML systems to power enterprise use cases”).
    - **Tone:** Professional, ambitious, and intellectually engaging. Avoid vague buzzwords or generic filler.

    ### CONTENT SPECIFICATIONS:
    - **job_description (HTML string):** 
        - 180–250 words total.
        - 3–4 paragraphs including: Role overview, Business impact, and Culture/value proposition.
        - Include 6–8 bullet points for responsibilities using active verbs (Own, Drive, Build, Mentor).
        - Include a clear, role-aligned qualifications section.
    - **skills_required (List):** 5–7 must-have skills aligned with {sub_vertical_1}. Avoid generic skills.
    - **skills_desirable (List):** 3–5 good-to-have skills (certifications, tools, or soft skills like product thinking).

    ### QUALITY & SAFETY GUIDELINES:
    - Do NOT fabricate company claims or unrealistic benefits.
    - Avoid biased or exclusionary language; ensure an inclusive and neutral hiring tone.
    - Keep content grounded in provided inputs.

    ### OUTPUT REQUIREMENTS:
    Return ONLY a valid JSON object with the following structure:

    ```json
    {{
    "job_description": "HTML string",
    "skills_required": [],
    "skills_desirable": []
    }}
    ```

    ### FINAL VALIDATION CHECK:
    Before output, verify:
    - JSON is valid and properly formatted.
    - Word limits (180-250) are respected.
    - Skills align perfectly with the role domain.
    - Tone is professional and compelling.
    - No placeholders remain in the final text.
    """

    last_exc: Exception | None = None

    for key in keys:
        try:
            client = genai.Client(api_key=key)
            response = client.models.generate_content(
                model=model_name,
                contents=PROMPT,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are an expert technical recruiter and job description writer. "
                        "Return structured, professional recruitment content as valid JSON."
                    ),
                    temperature=0.35,
                    response_mime_type="application/json",
                    response_schema=_GEMINI_SCHEMA,
                ),
            )

            if not response.candidates or not response.candidates[0].content.parts:
                 logger.error("Gemini returned an empty response.")
                 continue

            parsed = json.loads(response.text)
            validated = GeneratedRequisitionContent(**parsed)
            
            logger.info(
                "AI requisition generated for '%s' (%s-%s yrs).",
                requisition_title, exp_min, exp_max
            )
            return validated.model_dump()

        except exceptions.ResourceExhausted as exc:
            logger.warning("Gemini rate limit on key %s…", key[:8])
            last_exc = exc
            continue
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.error("Schema validation failed: %s", exc)
            last_exc = exc
            continue
        except Exception as exc:
            logger.exception("Unexpected Gemini error: %s", exc)
            last_exc = exc
            continue

    raise AIGenerationError(
        f"All Gemini API keys exhausted or failed. Last error: {last_exc}"
    )