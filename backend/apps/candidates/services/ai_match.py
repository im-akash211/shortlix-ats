"""
AI match scoring service.

Given a candidate and a job, asks Gemini to rate the candidate's suitability
for that job on a scale of 0–100. Returns (score: float, reason: str).
"""
import json
import logging

import google.generativeai as genai
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _build_candidate_profile(candidate) -> str:
    parts = [f"Name: {candidate.full_name}"]
    if candidate.designation:
        parts.append(f"Current Role: {candidate.designation}")
    if candidate.current_employer:
        parts.append(f"Current Company: {candidate.current_employer}")
    if candidate.total_experience_years is not None:
        parts.append(f"Total Experience: {candidate.total_experience_years} years")
    if candidate.skills:
        parts.append(f"Skills: {', '.join(candidate.skills)}")
    edu_parts = []
    if candidate.graduation_course:
        edu_parts.append(f"{candidate.graduation_course} from {candidate.graduation_college or 'unknown'} ({candidate.graduation_year or ''})")
    if candidate.post_graduation_course:
        edu_parts.append(f"{candidate.post_graduation_course} from {candidate.post_graduation_college or 'unknown'} ({candidate.post_graduation_year or ''})")
    if edu_parts:
        parts.append("Education: " + "; ".join(edu_parts))
    return "\n".join(parts)


def compute_match_score(candidate, job) -> tuple[float, str]:
    """
    Returns (score, reason). Score is 0.0–100.0.
    Raises on failure — caller should catch and handle.
    """
    # Build resume text: prefer raw_text from latest resume file
    resume_text = ""
    try:
        latest_resume = candidate.resume_files.filter(is_latest=True).first() \
            or candidate.resume_files.first()
        if latest_resume and latest_resume.raw_text:
            resume_text = latest_resume.raw_text[:8000]
    except Exception:
        pass

    candidate_profile = _build_candidate_profile(candidate)
    jd = (job.job_description or "").strip()[:5000]
    job_title = job.title or "Unknown Position"

    if resume_text:
        candidate_section = f"CANDIDATE PROFILE:\n{candidate_profile}\n\nRESUME TEXT:\n{resume_text}"
    else:
        candidate_section = f"CANDIDATE PROFILE (no resume uploaded):\n{candidate_profile}"

    prompt = f"""You are an expert ATS recruiter. Evaluate how well the candidate matches the job requirements.

JOB TITLE: {job_title}

JOB DESCRIPTION:
{jd if jd else "No job description provided."}

{candidate_section}

Rate the candidate's fit for this job on a scale of 0 to 100, where:
- 0–30: Poor fit
- 31–60: Partial fit
- 61–80: Good fit
- 81–100: Excellent fit

Respond with ONLY valid JSON in this exact format:
{{"score": <integer 0-100>, "reason": "<one concise sentence explaining the score>"}}"""

    api_keys = getattr(settings, "GEMINI_API_KEYS", [])
    if not api_keys:
        raise ValueError("GEMINI_API_KEYS not configured")

    model_name = getattr(settings, "GEMINI_MODEL_NAME", "gemini-2.0-flash")

    for key in api_keys:
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )
            text = response.text.strip()
            data = json.loads(text)
            score = float(data.get("score", 0))
            score = max(0.0, min(100.0, score))
            reason = str(data.get("reason", "")).strip()
            return score, reason
        except Exception as exc:
            logger.warning("AI match scoring failed with key %s: %s", key[:8], exc)
            continue

    raise RuntimeError("All Gemini API keys failed for AI match scoring")


def compute_and_save_match(mapping) -> None:
    """
    Compute AI match score for a CandidateJobMapping and save it.
    """
    try:
        score, reason = compute_match_score(mapping.candidate, mapping.job)
        mapping.ai_match_score = score
        mapping.ai_match_reason = reason
        mapping.ai_match_computed_at = timezone.now()
        mapping.save(update_fields=["ai_match_score", "ai_match_reason", "ai_match_computed_at"])
        logger.info(
            "AI match score %.1f computed for candidate %s / job %s",
            score, mapping.candidate_id, mapping.job_id,
        )
    except Exception as exc:
        logger.error(
            "Failed to compute AI match for mapping %s: %s", mapping.id, exc
        )
