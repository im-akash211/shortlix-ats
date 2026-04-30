import logging
from apps.activity.models import ActivityLog

logger = logging.getLogger(__name__)

STAGE_DISPLAY = {
    'APPLIED':     'Applied',
    'SHORTLISTED': 'Shortlisted',
    'INTERVIEW':   'Interview',
    'OFFERED':     'Offered',
    'JOINED':      'Joined',
    'DROPPED':     'Dropped',
}

RESULT_DISPLAY = {
    'PASS':    'Pass',
    'FAIL':    'Fail',
    'ON_HOLD': 'On Hold',
}

DECISION_DISPLAY = {
    'PASS':    'Pass',
    'FAIL':    'Fail',
    'ON_HOLD': 'On Hold',
}

FIELD_LABELS = {
    'status':          'Status',
    'title':           'Title',
    'hiring_manager':  'Hiring Manager',
    'job_description': 'Job Description',
}

JOB_LOGGED_EVENTS = {'status_changed', 'title_updated', 'hiring_manager_changed', 'jd_updated'}


def log_activity(actor, action, entity_type, entity_id, sentence, metadata):
    """Write an ActivityLog record. Never raises — logging failure must not break the main flow."""
    try:
        ActivityLog.objects.create(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            sentence=sentence,
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning('ActivityLog write failed (non-fatal): %s', exc)
