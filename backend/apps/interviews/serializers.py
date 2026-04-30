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
    overall_rating = serializers.IntegerField(required=True, min_value=1, max_value=5)

    class Meta:
        model = InterviewFeedback
        fields = [
            'id', 'interview', 'interviewer', 'interviewer_name',
            'overall_rating', 'recommendation',
            'decision',
            'strengths', 'weaknesses', 'concerns', 'comments',
            'submitted_at', 'updated_at',
            'competency_ratings',
        ]
        read_only_fields = ['id', 'interview', 'interviewer', 'submitted_at', 'updated_at']
        extra_kwargs = {
            'decision': {'required': True},
            'recommendation': {'required': False},
            'strengths': {'required': False},
            'weaknesses': {'required': False},
            'concerns': {'required': False},
            'comments': {'required': False},
        }

    def _derive_recommendation(self, validated_data):
        """Auto-fill legacy recommendation field from decision if not provided."""
        if not validated_data.get('recommendation'):
            decision = validated_data.get('decision', '')
            validated_data['recommendation'] = {
                'PASS': 'proceed', 'FAIL': 'reject', 'ON_HOLD': 'hold',
            }.get(decision, 'proceed')

    def create(self, validated_data):
        ratings_data = validated_data.pop('competency_ratings', [])
        self._derive_recommendation(validated_data)
        feedback = InterviewFeedback.objects.create(**validated_data)
        for rating_data in ratings_data:
            CompetencyRating.objects.create(feedback=feedback, **rating_data)
        return feedback

    def update(self, instance, validated_data):
        ratings_data = validated_data.pop('competency_ratings', None)
        self._derive_recommendation(validated_data)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if ratings_data is not None:
            instance.competency_ratings.all().delete()
            for rating_data in ratings_data:
                CompetencyRating.objects.create(feedback=instance, **rating_data)
        return instance


class InterviewListSerializer(serializers.ModelSerializer):
    candidate_id = serializers.UUIDField(source='mapping.candidate.id', read_only=True)
    candidate_name = serializers.CharField(source='mapping.candidate.full_name', read_only=True)
    candidate_email = serializers.CharField(source='mapping.candidate.email', read_only=True)
    candidate_phone = serializers.CharField(source='mapping.candidate.phone', read_only=True)
    candidate_location = serializers.CharField(source='mapping.candidate.location', read_only=True)
    candidate_experience = serializers.DecimalField(
        source='mapping.candidate.total_experience_years', read_only=True,
        max_digits=4, decimal_places=1
    )
    candidate_skills = serializers.ListField(
        source='mapping.candidate.skills', read_only=True, child=serializers.CharField()
    )
    job_id = serializers.UUIDField(source='mapping.job.id', read_only=True)
    job_title = serializers.CharField(source='mapping.job.title', read_only=True)
    job_code = serializers.CharField(source='mapping.job.job_code', read_only=True)
    mapping_id = serializers.UUIDField(source='mapping.id', read_only=True)
    interviewer_name = serializers.CharField(source='interviewer.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    has_feedback = serializers.SerializerMethodField()
    computed_status = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = [
            'id', 'mapping', 'mapping_id', 'round_number', 'round_label',
            'round_name', 'round_status', 'round_result',
            'computed_status',
            'interviewer', 'interviewer_name',
            'scheduled_at', 'end_time', 'duration_minutes', 'mode',
            'meeting_link', 'status', 'created_by', 'created_by_name', 'created_at',
            'candidate_id', 'candidate_name', 'candidate_email', 'candidate_phone',
            'candidate_location', 'candidate_experience', 'candidate_skills',
            'job_id', 'job_title', 'job_code',
            'has_feedback',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_has_feedback(self, obj):
        return hasattr(obj, 'feedback')

    def get_computed_status(self, obj):
        return obj.computed_status

    def get_end_time(self, obj):
        et = obj.computed_end_time
        if et:
            return et.isoformat()
        return None


class InterviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = [
            'id', 'mapping', 'round_number', 'round_label',
            'round_name', 'round_status', 'round_result',
            'interviewer', 'scheduled_at', 'end_time', 'duration_minutes', 'mode',
            'meeting_link', 'feedback_template', 'status',
        ]
        read_only_fields = ['id']


class FeedbackTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackTemplate
        fields = ['id', 'name', 'competencies', 'is_default', 'created_by']
        read_only_fields = ['id', 'created_by']
