from rest_framework import serializers
from .models import Interview, InterviewFeedback, CompetencyRating, FeedbackTemplate


class CompetencyRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetencyRating
        fields = ['id', 'competency_name', 'rating', 'notes']
        read_only_fields = ['id']


class InterviewFeedbackSerializer(serializers.ModelSerializer):
    competency_ratings = CompetencyRatingSerializer(many=True, required=False)
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)

    class Meta:
        model = InterviewFeedback
        fields = ['id', 'interview', 'interviewer', 'interviewer_name', 'overall_rating',
                  'recommendation', 'strengths', 'weaknesses', 'comments',
                  'submitted_at', 'competency_ratings']
        read_only_fields = ['id', 'interview', 'interviewer', 'submitted_at']

    def create(self, validated_data):
        ratings_data = validated_data.pop('competency_ratings', [])
        feedback = InterviewFeedback.objects.create(**validated_data)
        for rating_data in ratings_data:
            CompetencyRating.objects.create(feedback=feedback, **rating_data)
        return feedback


class InterviewListSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='mapping.candidate.full_name', read_only=True)
    candidate_email = serializers.CharField(source='mapping.candidate.email', read_only=True)
    candidate_phone = serializers.CharField(source='mapping.candidate.phone', read_only=True)
    candidate_location = serializers.CharField(source='mapping.candidate.location', read_only=True)
    candidate_experience = serializers.DecimalField(
        source='mapping.candidate.total_experience_years', read_only=True,
        max_digits=4, decimal_places=1
    )
    job_title = serializers.CharField(source='mapping.job.title', read_only=True)
    job_code = serializers.CharField(source='mapping.job.job_code', read_only=True)
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    has_feedback = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = ['id', 'mapping', 'round_number', 'round_label', 'interviewer',
                  'interviewer_name', 'scheduled_at', 'duration_minutes', 'mode',
                  'meeting_link', 'status', 'created_by', 'created_by_name', 'created_at',
                  'candidate_name', 'candidate_email', 'candidate_phone',
                  'candidate_location', 'candidate_experience',
                  'job_title', 'job_code', 'has_feedback']
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_has_feedback(self, obj):
        return hasattr(obj, 'feedback')


class InterviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = ['id', 'mapping', 'round_number', 'round_label', 'interviewer',
                  'scheduled_at', 'duration_minutes', 'mode', 'meeting_link',
                  'feedback_template', 'status']
        read_only_fields = ['id']


class FeedbackTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackTemplate
        fields = ['id', 'name', 'competencies', 'is_default', 'created_by']
        read_only_fields = ['id', 'created_by']
