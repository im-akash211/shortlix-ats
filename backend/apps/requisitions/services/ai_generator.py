import json
import logging
from typing import List, Optional, Union
from decimal import Decimal

import google.generativeai as genai
from google.api_core import exceptions
from django.conf import settings
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


# ── Pydantic output schema ─────────────────────────────────────────────────────

class GeneratedRequisitionContent(BaseModel):
    job_description: str
    roles_and_responsibilities: str
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)


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
        "roles_and_responsibilities": {
            "type": "string",
            "description": (
                "HTML-formatted day-to-day duties using <p>, <ul>, <li> tags. "
                "List 6-8 specific, actionable responsibilities for this role."
            ),
        },
        "required_skills": {
            "type": "array",
            "items": {"type": "string"},
            "description": "6-10 mandatory technical and soft skills (short phrases, no HTML).",
        },
        "preferred_skills": {
            "type": "array",
            "items": {"type": "string"},
            "description": "4-6 nice-to-have or bonus skills (short phrases, no HTML).",
        },
    },
    "required": [
        "job_description",
        "roles_and_responsibilities",
        "required_skills",
        "preferred_skills",
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
    sub_vertical_2: str = "",
    experience_min: Optional[Union[Decimal, float, int]] = 0,
    experience_max: Optional[Union[Decimal, float, int]] = 0,
) -> dict:
    """
    Generate job description, roles & responsibilities, required skills, and
    preferred skills in a SINGLE Gemini API call, considering experience range.
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
    if sub_vertical_1:
        context_lines.append(f"Sub-vertical / Practice Area 1: {sub_vertical_1}")
    if sub_vertical_2:
        context_lines.append(f"Sub-vertical / Practice Area 2: {sub_vertical_2}")
    
    context_str = "\n".join(context_lines)

    # Updated PROMPT with specific instructions for the experience range
    PROMPT = f"""You are an expert HR and Talent Acquisition Lead at a premier Generative AI and Data Engineering firm. 
        Your goal is to generate an enterprise-grade job requisition that attracts top-tier talent by balancing technical depth with high-impact narrative.

        ### COMPANY CONTEXT:
        We are an end-to-end GenAI and Data Engineering solution provider. We build enterprise-grade tools ranging from Data Pre-processing and Data Lakes to production-ready Machine Learning and LLM pipelines.

        ### INPUT DATA:
        - Role Context: {context_str}


        ### ROLE-SPECIFIC LOGIC ENGINE:
        1. **Engineering (AI/Data/Software):** Focus on scalability, technical debt management, system architecture, and "production-grade" reliability.
        2. **HR/People:** Focus on organizational design, culture-building in a high-growth tech environment, and talent strategy.
        3. **Sales/Growth:** Focus on technical solution selling, pipeline velocity, and enterprise client partnerships.
        4. **Seniority Calibration:** 
        - **Junior (0-3 yrs):** Emphasize execution, "learning from senior mentors," and "contributing to" systems.
        - **Mid-Senior (4-7 yrs):** Emphasize "ownership," "designing components," and "cross-functional collaboration."
        - **Lead/Staff (8+ yrs):** Emphasize "driving vision," "architecting systems," "mentoring," and "organizational impact."

        ### WRITING STYLE GUIDELINES (Reverse-Engineered from Industry Leaders):
        - **The Hook:** Start with an engaging mission statement. Mention the {exp_min}-{exp_max} years requirement naturally within the context of impact.
        - **Responsibilities:** Use the "Action + Purpose" formula (e.g., "Drive technology innovations to remain ahead of the curve" vs "Write code"). Include 6-8 bullets covering design, execution, testing, and collaboration.
        - **Tone:** Professional, ambitious, and intellectually curious.

        ### OUTPUT REQUIREMENTS:
        Generate a valid JSON object with these keys:
        1. `job_description`: (HTML string) A 3-4 sentence high-impact summary.
        2. `roles_and_responsibilities`: (HTML string) 6-8 bullet points using active verbs (Own, Drive, Build, Mentor).
        3. `required_skills`: (List) 5-7 core technical/hard skills aligned with {sub_vertical_1}.
        4. `preferred_skills`: (List) 3-5 "Nice to have" skills (e.g., Cloud Certifications, specific AI frameworks, or soft skills like "Product Thinking").

        ### JSON STRUCTURE:
        {{
            "job_description": "string",
            "roles_and_responsibilities": "string",
            "required_skills": [],
            "preferred_skills": []
        }}

        Return ONLY the JSON object.
    """

    last_exc: Exception | None = None

    for key in keys:
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=(
                    "You are an expert technical recruiter and job description writer. "
                    "Return structured, professional recruitment content as valid JSON."
                ),
            )
            
            response = model.generate_content(
                PROMPT,
                generation_config=genai.GenerationConfig(
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