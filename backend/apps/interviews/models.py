import uuid

from django.conf import settings
from django.db import models


class FeedbackTemplate(models.Model):
    """
    Pre-configured interview feedback form templates.
    Admin creates these (e.g., Tech, Non-Tech, Custom) with a list of
    competencies to rate during the interview.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    competencies = models.JSONField(
        default=list,
        help_text='List of competency objects: [{"name": "...", "description": "..."}]',
    )
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_feedback_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'feedback_templates'
        ordering = ['name']

    def __str__(self):
        return self.name


class InterviewMode(models.TextChoices):
    VIRTUAL = 'virtual', 'Virtual'
    PHONE = 'phone', 'Phone Call'
    FACE_TO_FACE = 'face_to_face', 'Face-to-Face'


class InterviewStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'
    NO_SHOW = 'no_show', 'No Show'


class Interview(models.Model):
    """
    A scheduled interview for a candidate-job combination.
    Supports multi-round: round_number 1,2,3... per mapping.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        'candidates.CandidateJobMapping',
        on_delete=models.CASCADE,
        related_name='interviews',
    )
    round_number = models.PositiveSmallIntegerField(
        help_text='1 = Round 1, 2 = Round 2, etc.',
    )
    round_label = models.CharField(
        max_length=100,
        help_text='Display label, e.g., "Round 1 - Tech", "Final"',
    )
    interviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='assigned_interviews',
    )
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    mode = models.CharField(
        max_length=15,
        choices=InterviewMode.choices,
        default=InterviewMode.VIRTUAL,
    )
    meeting_link = models.CharField(max_length=500, blank=True)
    feedback_template = models.ForeignKey(
        FeedbackTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='interviews',
    )
    status = models.CharField(
        max_length=10,
        choices=InterviewStatus.choices,
        default=InterviewStatus.SCHEDULED,
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='scheduled_interviews',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'interviews'
        ordering = ['-scheduled_at']
        constraints = [
            models.UniqueConstraint(
                fields=['mapping', 'round_number'],
                name='unique_interview_round_per_mapping',
            ),
        ]

    def __str__(self):
        return f'{self.mapping.candidate.full_name} — {self.round_label}'


class Recommendation(models.TextChoices):
    PROCEED = 'proceed', 'Proceed'
    HOLD = 'hold', 'Hold'
    REJECT = 'reject', 'Reject'


class InterviewFeedback(models.Model):
    """
    Feedback submitted by the interviewer after an interview.
    One feedback per interview (OneToOne).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview = models.OneToOneField(
        Interview,
        on_delete=models.CASCADE,
        related_name='feedback',
    )
    interviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='submitted_feedback',
    )
    overall_rating = models.PositiveSmallIntegerField(
        help_text='Rating 1-5',
    )
    recommendation = models.CharField(
        max_length=10,
        choices=Recommendation.choices,
    )
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    comments = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'interview_feedback'

    def __str__(self):
        return f'Feedback for {self.interview} — {self.recommendation}'


class CompetencyRating(models.Model):
    """Individual competency rating within an interview feedback."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feedback = models.ForeignKey(
        InterviewFeedback,
        on_delete=models.CASCADE,
        related_name='competency_ratings',
    )
    competency_name = models.CharField(max_length=255)
    rating = models.PositiveSmallIntegerField(
        help_text='Rating 1-5',
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'competency_ratings'

    def __str__(self):
        return f'{self.competency_name}: {self.rating}/5'
