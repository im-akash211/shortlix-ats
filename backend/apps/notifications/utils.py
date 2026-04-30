import logging
import re
from django.core.mail import EmailMultiAlternatives
from django.conf import settings

logger = logging.getLogger(__name__)

BASE_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_enabled(event_key):
    from apps.notifications.models import NotificationSetting
    try:
        return NotificationSetting.objects.get(event_key=event_key).is_enabled
    except NotificationSetting.DoesNotExist:
        return True


def _log(event_key, to_email, subject, status, error=''):
    from apps.notifications.models import EmailLog
    try:
        EmailLog.objects.create(
            template_key=event_key,
            to_email=to_email,
            subject=subject,
            status=status,
            error_message=error,
        )
    except Exception:
        pass


def _html_wrap(title, body_html, cta_text=None, cta_url=None):
    cta = ''
    if cta_text and cta_url:
        cta = f'''<div style="text-align:center;margin:32px 0;">
            <a href="{cta_url}" style="background:#0058be;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">{cta_text}</a>
        </div>'''
    return f'''<div style="font-family:Inter,Arial,sans-serif;background:#f8f9fa;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
            <div style="background:#0058be;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Shorthills AI — ATS</h1>
            </div>
            <div style="padding:32px;">
                <h2 style="color:#191c1d;font-size:20px;margin:0 0 16px;">{title}</h2>
                {body_html}
                {cta}
                <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f5;padding-top:16px;">
                    This is an automated notification from Shorthills AI ATS. Please do not reply.
                </p>
            </div>
        </div>
    </div>'''


def _send_email(event_key, to_email, subject, html_body):
    if not to_email:
        return
    text = re.sub(r'<[^>]+>', '', html_body.replace('<br>', '\n').replace('</p>', '\n'))
    try:
        msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to_email])
        msg.attach_alternative(html_body, 'text/html')
        msg.send()
        _log(event_key, to_email, subject, 'sent')
    except BaseException as e:
        # Catch BaseException so SystemExit/KeyboardInterrupt from SMTP failures
        # don't kill the gunicorn worker or abort the request.
        logger.error('Email failed [%s] to %s: %s', event_key, to_email, e)
        try:
            _log(event_key, to_email, subject, 'failed', str(e))
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def notify(
    event_key,
    recipient,          # User instance OR plain email string (external)
    message,            # in-app message text (ignored for external emails)
    subject,            # email subject
    html_body,          # full HTML string (use _html_wrap)
    sender=None,
    candidate=None,
    job=None,
    macro_stage='',
    notification_type='general',
):
    """
    Unified notification dispatcher.
    - User recipient  → creates InAppNotification + sends email
    - String recipient → sends email only (no account in system)
    Skips everything if NotificationSetting.is_enabled is False for event_key.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if not _is_enabled(event_key):
        return

    is_user = isinstance(recipient, User)
    to_email = recipient.email if is_user else recipient

    if is_user:
        from apps.notifications.models import InAppNotification
        try:
            InAppNotification.objects.create(
                recipient=recipient,
                sender=sender,
                notification_type=notification_type,
                message=message,
                candidate=candidate,
                job=job,
                macro_stage=macro_stage or '',
            )
        except Exception as e:
            logger.error('InAppNotification failed [%s]: %s', event_key, e)

    _send_email(event_key, to_email, subject, html_body)


# ---------------------------------------------------------------------------
# Event helpers — one function per event keeps call sites clean
# ---------------------------------------------------------------------------

def notify_requisition_submitted(req, submitter):
    approver = req.hiring_manager
    if not approver:
        return
    url = f'{BASE_URL}/requisitions'
    body = _html_wrap(
        'New Requisition Awaiting Your Approval',
        f'''<p style="color:#374151;">Hi {approver.full_name},</p>
        <p style="color:#374151;"><strong>{submitter.full_name}</strong> has submitted a requisition for your approval:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px;font-weight:600;color:#111827;">{req.title}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Department</td><td style="padding:8px;font-weight:600;color:#111827;">{getattr(req.department, "name", "—")}</td></tr>
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Purpose</td><td style="padding:8px;font-weight:600;color:#111827;">{req.get_purpose_display() if hasattr(req, "get_purpose_display") else req.purpose}</td></tr>
        </table>''',
        cta_text='Review Requisition', cta_url=url,
    )
    notify(
        event_key='requisition_submitted',
        recipient=approver,
        message=f'New requisition "{req.title}" submitted by {submitter.full_name} — awaiting your approval.',
        subject=f'Action Required: Requisition "{req.title}" needs your approval',
        html_body=body,
        sender=submitter,
        notification_type='requisition',
    )


def notify_requisition_approved(req, approver):
    creator = req.created_by
    if not creator:
        return
    url = f'{BASE_URL}/requisitions'
    body = _html_wrap(
        'Your Requisition Has Been Approved',
        f'''<p style="color:#374151;">Hi {creator.full_name},</p>
        <p style="color:#374151;">Great news! Your requisition has been <strong style="color:#16a34a;">approved</strong> by {approver.full_name}.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px;font-weight:600;color:#111827;">{req.title}</td></tr>
        </table>
        <p style="color:#374151;">A job opening will be created automatically.</p>''',
        cta_text='View Requisitions', cta_url=url,
    )
    notify(
        event_key='requisition_approved',
        recipient=creator,
        message=f'Your requisition "{req.title}" has been approved by {approver.full_name}.',
        subject=f'Requisition Approved: {req.title}',
        html_body=body,
        sender=approver,
        notification_type='requisition',
    )


def notify_requisition_rejected(req, rejector):
    creator = req.created_by
    if not creator:
        return
    url = f'{BASE_URL}/requisitions'
    body = _html_wrap(
        'Your Requisition Was Not Approved',
        f'''<p style="color:#374151;">Hi {creator.full_name},</p>
        <p style="color:#374151;">Unfortunately, your requisition has been <strong style="color:#dc2626;">rejected</strong> by {rejector.full_name}.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px;font-weight:600;color:#111827;">{req.title}</td></tr>
        </table>
        <p style="color:#374151;">You may revise and resubmit it.</p>''',
        cta_text='View Requisitions', cta_url=url,
    )
    notify(
        event_key='requisition_rejected',
        recipient=creator,
        message=f'Your requisition "{req.title}" was rejected by {rejector.full_name}.',
        subject=f'Requisition Rejected: {req.title}',
        html_body=body,
        sender=rejector,
        notification_type='requisition',
    )


def notify_collaborator_added(job, added_user, added_by):
    url = f'{BASE_URL}/jobs/{job.id}'
    body = _html_wrap(
        "You've Been Added to a Job",
        f'''<p style="color:#374151;">Hi {added_user.full_name},</p>
        <p style="color:#374151;"><strong>{added_by.full_name}</strong> has added you as a collaborator on:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Job</td><td style="padding:8px;font-weight:600;color:#111827;">{job.title}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Job Code</td><td style="padding:8px;font-weight:600;color:#111827;">{job.job_code}</td></tr>
        </table>''',
        cta_text='View Job', cta_url=url,
    )
    notify(
        event_key='collaborator_added',
        recipient=added_user,
        message=f'You have been added as a collaborator on "{job.title}" by {added_by.full_name}.',
        subject=f'You\'ve been added to "{job.title}"',
        html_body=body,
        sender=added_by,
        job=job,
        notification_type='job',
    )


def notify_candidate_applied(candidate, job, recruiter):
    url = f'{BASE_URL}/jobs/{job.id}/candidates'
    body = _html_wrap(
        'New Candidate in Pipeline',
        f'''<p style="color:#374151;">Hi {recruiter.full_name},</p>
        <p style="color:#374151;"><strong>{candidate.full_name}</strong> has been added to the pipeline for <strong>{job.title}</strong>.</p>''',
        cta_text='View Pipeline', cta_url=url,
    )
    notify(
        event_key='candidate_applied',
        recipient=recruiter,
        message=f'{candidate.full_name} added to pipeline for "{job.title}".',
        subject=f'New Candidate: {candidate.full_name} — {job.title}',
        html_body=body,
        candidate=candidate,
        job=job,
        macro_stage='APPLIED',
        notification_type='candidate_stage',
    )


def notify_candidate_shortlisted(candidate, job):
    if not candidate.email:
        return
    body = _html_wrap(
        'Congratulations — You Have Been Shortlisted!',
        f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
        <p style="color:#374151;">We are pleased to inform you that you have been <strong style="color:#16a34a;">shortlisted</strong> for the following position:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px;font-weight:600;color:#111827;">{job.title}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Company</td><td style="padding:8px;font-weight:600;color:#111827;">Shorthills AI</td></tr>
        </table>
        <p style="color:#374151;">Our team will be in touch shortly to schedule the next steps.</p>''',
    )
    notify(
        event_key='candidate_shortlisted',
        recipient=candidate.email,
        message='',
        subject=f'You have been shortlisted for {job.title}',
        html_body=body,
    )


def notify_candidate_rejected(candidate, job):
    if not candidate.email:
        return
    body = _html_wrap(
        'Update on Your Application',
        f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
        <p style="color:#374151;">Thank you for your interest in the <strong>{job.title}</strong> position at Shorthills AI and for the time you invested in our process.</p>
        <p style="color:#374151;">After careful evaluation, we regret to inform you that we will not be moving forward with your application at this stage.</p>
        <p style="color:#374151;">We appreciate your effort and sincerely wish you the very best in your career ahead.</p>''',
    )
    notify(
        event_key='candidate_rejected',
        recipient=candidate.email,
        message='',
        subject=f'Update on your application — {job.title}',
        html_body=body,
    )


STAGE_DISPLAY = {
    'INTERVIEW':   'Interview',
    'SHORTLISTED': 'Shortlisted',
    'APPLIED':     'Applied',
}


def notify_rejection_reversed(candidate, job, stage):
    """Send when a previous rejection is undone and the candidate is active again."""
    if not candidate.email:
        return
    stage_label = STAGE_DISPLAY.get(stage, stage.capitalize())
    body = _html_wrap(
        'Great News — Your Application Has Been Reconsidered',
        f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
        <p style="color:#374151;">We are pleased to let you know that a previous decision on your application for <strong>{job.title}</strong> has been reconsidered.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px;font-weight:600;color:#111827;">{job.title}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Current Stage</td><td style="padding:8px;font-weight:600;color:#16a34a;">{stage_label}</td></tr>
        </table>
        <p style="color:#374151;">You are now back in the <strong>{stage_label}</strong> stage of the hiring process. Our team will be in touch with the next steps shortly.</p>''',
    )
    notify(
        event_key='rejection_reversed',
        recipient=candidate.email,
        message='',
        subject=f'Your application has been reconsidered — {job.title}',
        html_body=body,
    )


def notify_interview_scheduled(interview, is_reschedule=False):
    mapping = interview.mapping
    candidate = mapping.candidate
    job = mapping.job
    interviewer = interview.interviewer
    scheduled_str = interview.scheduled_at.strftime('%d %b %Y, %I:%M %p') if interview.scheduled_at else '—'
    action = 'Rescheduled' if is_reschedule else 'Scheduled'

    # Email to candidate (external)
    if candidate.email:
        cand_body = _html_wrap(
            f'Your Interview Has Been {action}',
            f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
            <p style="color:#374151;">Your interview for the <strong>{job.title}</strong> position has been {action.lower()}.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Round</td><td style="padding:8px;font-weight:600;color:#111827;">{interview.round_label or interview.round_name or "Interview"}</td></tr>
                <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Date &amp; Time</td><td style="padding:8px;font-weight:600;color:#111827;">{scheduled_str}</td></tr>
                {"<tr><td style='padding:8px;color:#6b7280;font-size:13px;'>Location / Link</td><td style='padding:8px;font-weight:600;color:#111827;'>" + interview.location + "</td></tr>" if getattr(interview, "location", None) else ""}
            </table>
            <p style="color:#374151;">Please be available and prepared. Good luck!</p>''',
        )
        notify(
            event_key=f'interview_{action.lower()}',
            recipient=candidate.email,
            message='',
            subject=f'Interview {action}: {job.title} — {scheduled_str}',
            html_body=cand_body,
        )

    # In-app + email to interviewer
    if interviewer:
        int_body = _html_wrap(
            f'Interview {action} — Action Required',
            f'''<p style="color:#374151;">Hi {interviewer.full_name},</p>
            <p style="color:#374151;">You have been assigned to interview <strong>{candidate.full_name}</strong> for <strong>{job.title}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Round</td><td style="padding:8px;font-weight:600;color:#111827;">{interview.round_label or interview.round_name or "Interview"}</td></tr>
                <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Date &amp; Time</td><td style="padding:8px;font-weight:600;color:#111827;">{scheduled_str}</td></tr>
            </table>''',
            cta_text='View Interview', cta_url=f'{BASE_URL}/interviews',
        )
        notify(
            event_key=f'interview_{action.lower()}',
            recipient=interviewer,
            message=f'Interview {action.lower()} with {candidate.full_name} for "{job.title}" on {scheduled_str}.',
            subject=f'Interview {action}: {candidate.full_name} — {job.title}',
            html_body=int_body,
            candidate=candidate,
            job=job,
            macro_stage='INTERVIEW',
            notification_type='interview',
        )


def notify_candidate_interview_rejected(candidate, job):
    notify_candidate_rejected(candidate, job)


def notify_candidate_round_passed(candidate, job, interview):
    if not candidate.email:
        return
    round_label = getattr(interview, 'round_label', None) or getattr(interview, 'round_name', None) or 'Interview'
    body = _html_wrap(
        f'Congratulations — You Cleared {round_label}!',
        f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
        <p style="color:#374151;">Great news! You have successfully cleared <strong style="color:#16a34a;">{round_label}</strong> for the <strong>{job.title}</strong> position at Shorthills AI.</p>
        <p style="color:#374151;">Our team will be in touch shortly with details on the next steps in the process.</p>
        <p style="color:#374151;">Keep up the great work!</p>''',
    )
    notify(
        event_key='candidate_round_passed',
        recipient=candidate.email,
        message='',
        subject=f'You cleared {round_label} — {job.title} at Shorthills AI',
        html_body=body,
    )


def notify_candidate_offered(candidate, job):
    if not candidate.email:
        return
    body = _html_wrap(
        'Congratulations — You Have Received an Offer!',
        f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
        <p style="color:#374151;">We are thrilled to inform you that you have been selected for the <strong>{job.title}</strong> position at Shorthills AI.</p>
        <p style="color:#374151;">Our HR team will reach out shortly with the formal offer details and next steps.</p>
        <p style="color:#374151;">Congratulations and welcome aboard!</p>''',
    )
    notify(
        event_key='candidate_offered',
        recipient=candidate.email,
        message='',
        subject=f'Offer Extended — {job.title} at Shorthills AI',
        html_body=body,
    )


def notify_candidate_interview_stage(candidate, job):
    if not candidate.email:
        return
    body = _html_wrap(
        'You Have Advanced to the Interview Stage!',
        f'''<p style="color:#374151;">Dear {candidate.full_name},</p>
        <p style="color:#374151;">We are pleased to inform you that your application for the <strong>{job.title}</strong> position at Shorthills AI has progressed to the <strong style="color:#2563eb;">Interview Stage</strong>.</p>
        <p style="color:#374151;">Our team will reach out shortly with details about your interview schedule.</p>
        <p style="color:#374151;">Please keep an eye on your inbox and be prepared. Best of luck!</p>''',
    )
    notify(
        event_key='candidate_interview_stage',
        recipient=candidate.email,
        message='',
        subject=f'Interview Stage — {job.title} at Shorthills AI',
        html_body=body,
    )


def notify_referral_submitted(referral, admins):
    parsed = referral.parsed_data or {}
    candidate_name = (
        f"{(parsed.get('first_name') or '').strip()} {(parsed.get('last_name') or '').strip()}".strip()
        or referral.original_filename
    )
    url = f'{BASE_URL}/referrals'
    for admin in admins:
        body = _html_wrap(
            'New Employee Referral Awaiting Review',
            f'''<p style="color:#374151;">Hi {admin.full_name},</p>
            <p style="color:#374151;">A new referral has been submitted and requires your review:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Candidate</td><td style="padding:8px;font-weight:600;color:#111827;">{candidate_name}</td></tr>
                <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Referred By</td><td style="padding:8px;font-weight:600;color:#111827;">{referral.employee_name} (ID: {referral.employee_id})</td></tr>
                <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Job</td><td style="padding:8px;font-weight:600;color:#111827;">{referral.job.title if referral.job else "—"}</td></tr>
            </table>''',
            cta_text='Review Referral', cta_url=url,
        )
        _send_email('referral_submitted', admin.email, f'New Referral: {candidate_name}', body)


def notify_referral_approved(referral, recruiters):
    parsed = referral.parsed_data or {}
    candidate_name = (
        f"{(parsed.get('first_name') or '').strip()} {(parsed.get('last_name') or '').strip()}".strip()
        or referral.original_filename
    )
    url = f'{BASE_URL}/referrals'
    for recruiter in recruiters:
        body = _html_wrap(
            'Referral Approved — Candidate Added to Pipeline',
            f'''<p style="color:#374151;">Hi {recruiter.full_name},</p>
            <p style="color:#374151;">A referral has been approved and the candidate has been added to your pipeline:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Candidate</td><td style="padding:8px;font-weight:600;color:#111827;">{candidate_name}</td></tr>
                <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Referred By</td><td style="padding:8px;font-weight:600;color:#111827;">{referral.employee_name}</td></tr>
                <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Job</td><td style="padding:8px;font-weight:600;color:#111827;">{referral.job.title if referral.job else "—"}</td></tr>
            </table>''',
            cta_text='View Pipeline', cta_url=url,
        )
        _send_email('referral_approved', recruiter.email, f'Referral Approved: {candidate_name}', body)


def notify_referral_declined(referral):
    if not referral.employee_email:
        return
    parsed = referral.parsed_data or {}
    candidate_name = (
        f"{(parsed.get('first_name') or '').strip()} {(parsed.get('last_name') or '').strip()}".strip()
        or referral.original_filename
    )
    body = _html_wrap(
        'Update on Your Referral',
        f'''<p style="color:#374151;">Dear {referral.employee_name},</p>
        <p style="color:#374151;">Thank you for referring <strong>{candidate_name}</strong> for the <strong>{referral.job.title if referral.job else "open position"}</strong> role.</p>
        <p style="color:#374151;">After review, we are unable to move forward with this referral at this time. We appreciate your effort in helping us find great talent.</p>''',
    )
    _send_email('referral_declined', referral.employee_email, f'Update on your referral — {candidate_name}', body)


def notify_reminder_due(user, reminder, job, macro_stage):
    if not user.email:
        return
    job_title = job.title if job else '—'
    scheduled_str = reminder.remind_at.strftime('%d %b %Y, %I:%M %p') if reminder.remind_at else ''
    body = _html_wrap(
        'Candidate Reminder Due',
        f'''<p style="color:#374151;">Hi {user.full_name},</p>
        <p style="color:#374151;">You have a reminder for <strong>{reminder.candidate.full_name}</strong>:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Job</td><td style="padding:8px;font-weight:600;color:#111827;">{job_title}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Stage</td><td style="padding:8px;font-weight:600;color:#111827;">{macro_stage.capitalize() if macro_stage else "—"}</td></tr>
            {"<tr><td style='padding:8px;color:#6b7280;font-size:13px;'>Note</td><td style='padding:8px;color:#111827;'>" + reminder.note + "</td></tr>" if reminder.note else ""}
        </table>''',
        cta_text='View Candidate', cta_url=f'{BASE_URL}/candidates/{reminder.candidate.id}/profile',
    )
    _send_email('reminder_due', user.email, f'Reminder: {reminder.candidate.full_name} — {job_title}', body)


def notify_feedback_pending_reminder(interview):
    """
    Sent to the interviewer every 24 h while feedback for a completed interview
    remains unsubmitted.
    """
    interviewer = interview.interviewer
    if not interviewer or not interviewer.email:
        return

    candidate = interview.mapping.candidate
    job = interview.mapping.job
    round_label = interview.round_label or interview.round_name or 'Interview'
    scheduled_str = (
        interview.scheduled_at.strftime('%d %b %Y, %I:%M %p')
        if interview.scheduled_at else '—'
    )
    url = f'{BASE_URL}/interviews'

    body = _html_wrap(
        'Interview Feedback Pending — Action Required',
        f'''<p style="color:#374151;">Hi {interviewer.full_name},</p>
        <p style="color:#374151;">A friendly reminder that your feedback for the following interview is still pending.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Candidate</td><td style="padding:8px;font-weight:600;color:#111827;">{candidate.full_name}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px;font-weight:600;color:#111827;">{job.title}</td></tr>
            <tr><td style="padding:8px;color:#6b7280;font-size:13px;">Round</td><td style="padding:8px;font-weight:600;color:#111827;">{round_label}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;font-size:13px;">Scheduled</td><td style="padding:8px;font-weight:600;color:#111827;">{scheduled_str}</td></tr>
        </table>
        <p style="color:#374151;">Please submit your feedback as soon as possible so the hiring team can move forward.</p>''',
        cta_text='Submit Feedback', cta_url=url,
    )

    notify(
        event_key='feedback_pending_reminder',
        recipient=interviewer,
        message=f'Feedback pending for {candidate.full_name} ({round_label} — {job.title}).',
        subject=f'Feedback Reminder: {candidate.full_name} — {job.title}',
        html_body=body,
        candidate=candidate,
        job=job,
        macro_stage='INTERVIEW',
        notification_type='interview',
    )
