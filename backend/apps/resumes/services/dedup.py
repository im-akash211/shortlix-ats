"""
Deduplication service for resume-to-candidate conversion.

Checks in order:
  1. Email exact match (case-insensitive)
  2. Phone exact match (normalised digits)
  3. Fuzzy full_name + current_employer OR designation similarity

Returns a list of all potential duplicates ordered by confidence.
"""

import logging
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from apps.candidates.models import Candidate

logger = logging.getLogger(__name__)

_NAME_THRESHOLD    = 0.85
_COMPANY_THRESHOLD = 0.70
_DESIG_THRESHOLD   = 0.70


def _clean_phone(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    return digits[-10:] if len(digits) >= 10 else digits


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def find_duplicates(reviewed_data: dict, raw_text: str = None) -> List[Dict[str, Any]]:
    """
    Search for existing Candidates that match the reviewed resume data.

    Returns list of dicts:
        {'candidate': Candidate, 'match_type': str, 'confidence': float}
    ordered by confidence descending.
    """
    results = []
    seen_ids = set()

    email       = (reviewed_data.get('email') or '').strip().lower()
    phone       = (reviewed_data.get('phone') or '').strip()
    first_name  = (reviewed_data.get('first_name') or '').strip()
    last_name   = (reviewed_data.get('last_name') or '').strip()
    full_name   = f"{first_name} {last_name}".strip()
    company     = (reviewed_data.get('current_company') or '').strip()
    designation = (reviewed_data.get('designation') or '').strip()

    def _add(candidate, match_type, confidence=1.0):
        if candidate.id not in seen_ids:
            seen_ids.add(candidate.id)
            results.append({
                'candidate': candidate,
                'match_type': match_type,
                'confidence': confidence,
            })

    # 1. Email exact match
    if email:
        c = Candidate.objects.filter(email__iexact=email).first()
        if c:
            _add(c, 'email', 1.0)

    # 2. Phone exact match
    if phone:
        clean = _clean_phone(phone)
        if len(clean) >= 10:
            for c in Candidate.objects.exclude(phone='').only('id', 'phone'):
                if _clean_phone(c.phone or '') == clean:
                    _add(Candidate.objects.get(pk=c.pk), 'phone', 1.0)

    # 3. Fuzzy name + secondary signal
    if full_name and len(full_name) >= 3 and first_name:
        qs = Candidate.objects.filter(
            full_name__icontains=first_name
        ).only('id', 'full_name', 'current_employer', 'designation')

        for c in qs:
            if c.id in seen_ids:
                continue
            name_score = _similarity(full_name, c.full_name)
            if name_score < _NAME_THRESHOLD:
                continue
            matched = False
            if company and c.current_employer:
                if _similarity(company, c.current_employer) >= _COMPANY_THRESHOLD:
                    _add(Candidate.objects.get(pk=c.pk), 'fuzzy_name', round(name_score, 2))
                    matched = True
            if not matched and designation and c.designation:
                if _similarity(designation, c.designation) >= _DESIG_THRESHOLD:
                    _add(Candidate.objects.get(pk=c.pk), 'fuzzy_name', round(name_score, 2))

    results.sort(key=lambda x: x['confidence'], reverse=True)
    return results


def find_duplicate(reviewed_data: dict) -> Tuple[Optional[Candidate], Optional[str]]:
    """Single-result shim kept for the resolve endpoint."""
    matches = find_duplicates(reviewed_data)
    if matches:
        return matches[0]['candidate'], matches[0]['match_type']
    return None, None
