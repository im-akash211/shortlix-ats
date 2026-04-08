"""
Deduplication service for resume-to-candidate conversion.

Checks in order:
  1. Primary   — email exact match (case-insensitive)
  2. Secondary — phone exact match (normalised digits)
  3. Tertiary  — fuzzy full_name + current_employer OR designation similarity
"""

import re
from difflib import SequenceMatcher
from typing import Optional, Tuple

from apps.candidates.models import Candidate

# Similarity thresholds
_NAME_THRESHOLD    = 0.85   # SequenceMatcher ratio for full name
_COMPANY_THRESHOLD = 0.70   # ratio for company name
_DESIG_THRESHOLD   = 0.70   # ratio for designation


def _clean_phone(phone: str) -> str:
    """Strip all non-digit characters; return last 10 digits if longer."""
    digits = re.sub(r'\D', '', phone)
    return digits[-10:] if len(digits) >= 10 else digits


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def find_duplicate(reviewed_data: dict) -> Tuple[Optional[Candidate], Optional[str]]:
    """
    Search for an existing Candidate that matches the reviewed resume data.

    Parameters
    ----------
    reviewed_data : dict
        The reviewed/edited resume fields (first_name, last_name, email,
        phone, current_company, designation, …).

    Returns
    -------
    (candidate, match_type) where match_type is one of:
        'email', 'phone', 'fuzzy_name_company', 'fuzzy_name_designation'
    or (None, None) if no duplicate found.
    """
    email        = (reviewed_data.get('email') or '').strip().lower()
    phone        = (reviewed_data.get('phone') or '').strip()
    first_name   = (reviewed_data.get('first_name') or '').strip()
    last_name    = (reviewed_data.get('last_name') or '').strip()
    full_name    = f"{first_name} {last_name}".strip()
    company      = (reviewed_data.get('current_company') or '').strip()
    designation  = (reviewed_data.get('designation') or '').strip()

    # 1. Primary: email exact match ────────────────────────────────────────────
    if email:
        candidate = Candidate.objects.filter(email__iexact=email).first()
        if candidate:
            return candidate, 'email'

    # 2. Secondary: normalised phone match ────────────────────────────────────
    if phone:
        clean = _clean_phone(phone)
        if len(clean) >= 10:
            for candidate in Candidate.objects.exclude(phone='').only('id', 'phone'):
                if _clean_phone(candidate.phone) == clean:
                    return Candidate.objects.get(pk=candidate.pk), 'phone'

    # 3. Tertiary: fuzzy name + secondary signal ───────────────────────────────
    if full_name and len(full_name) >= 3 and first_name:
        qs = Candidate.objects.filter(
            full_name__icontains=first_name
        ).only('id', 'full_name', 'current_employer', 'designation')

        for candidate in qs:
            name_score = _similarity(full_name, candidate.full_name)
            if name_score < _NAME_THRESHOLD:
                continue

            if company and candidate.current_employer:
                if _similarity(company, candidate.current_employer) >= _COMPANY_THRESHOLD:
                    return Candidate.objects.get(pk=candidate.pk), 'fuzzy_name_company'

            if designation and candidate.designation:
                if _similarity(designation, candidate.designation) >= _DESIG_THRESHOLD:
                    return Candidate.objects.get(pk=candidate.pk), 'fuzzy_name_designation'

    return None, None
