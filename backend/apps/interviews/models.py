import uuid
from django.conf import settings
from django.db import models


class FeedbackTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    competencies = models.JSONField(default=list)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Interview(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    MODE_CHOICES = [
        ('virtual', 'Virtual'),
        ('phone', 'Phone Call'),
        ('face_to_face', 'Face-to-Face'),
    ]
    # Structured round names for the new pipeline
    ROUND_NAME_CHOICES = [
        ('R1', 'Round 1'),
        ('R2', 'Round 2'),
        ('CLIENT', 'Client Round'),
        ('CDO', 'CDO Round'),
        ('MGMT', 'Management Round'),
    ]
    # Round-level status (separate from the interview scheduling status above)
    ROUND_STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('COMPLETED', 'Completed'),
        ('ON_HOLD', 'On Hold'),
    ]
    ROUND_RESULT_CHOICES = [
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('ON_HOLD', 'On Hold'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        'candidates.CandidateJobMapping', on_delete=models.CASCADE, related_name='interviews'
    )
    round_number = models.PositiveSmallIntegerField(default=1)
    round_label = models.CharField(max_length=100, default='Round 1')

    # New structured round fields (nullable to preserve existing records)
    round_name = models.CharField(
        max_length=10, choices=ROUND_NAME_CHOICES, null=True, blank=True
    )
    round_status = models.CharField(
        max_length=15, choices=ROUND_STATUS_CHOICES, null=True, blank=True
    )
    round_result = models.CharField(
        max_length=10, choices=ROUND_RESULT_CHOICES, null=True, blank=True
    )

    interviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='assigned_interviews'
    )
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    mode = models.CharField(max_length=15, choices=MODE_CHOICES, default='virtual')
    meeting_link = models.CharField(max_length=500, blank=True)
    feedback_template = models.ForeignKey(
        FeedbackTemplate, null=True, blank=True, on_delete=models.SET_NULL
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='scheduled')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='scheduled_interviews'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-scheduled_at']
        constraints = [
            models.UniqueConstraint(fields=['mapping', 'round_number'], name='unique_interview_round'),
        ]

    def __str__(self):
        return f"Interview {self.round_label} - {self.mapping.candidate.full_name}"


class InterviewFeedback(models.Model):
    RECOMMENDATION_CHOICES = [
        ('proceed', 'Proceed'), ('hold', 'Hold'), ('reject', 'Reject'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview = models.OneToOneField(Interview, on_delete=models.CASCADE, related_name='feedback')
    interviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    overall_rating = models.PositiveSmallIntegerField()
    recommendation = models.CharField(max_length=10, choices=RECOMMENDATION_CHOICES)
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    comments = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)


class CompetencyRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feedback = models.ForeignKey(InterviewFeedback, on_delete=models.CASCADE, related_name='competency_ratings')
    competency_name = models.CharField(max_length=255)
    rating = models.PositiveSmallIntegerField()
    notes = models.TextField(blank=True)
