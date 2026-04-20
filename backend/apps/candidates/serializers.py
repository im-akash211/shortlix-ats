from rest_framework import serializers
from .models import (
    Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote, ResumeFile,
)


class CandidateNoteSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = CandidateNote
        fields = ['id', 'candidate', 'user', 'user_name', 'content', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class PipelineStageHistorySerializer(serializers.ModelSerializer):
    moved_by_name = serializers.CharField(source='moved_by.full_name', read_only=True)

    class Meta:
        model = PipelineStageHistory
        fields = [
            'id', 'from_macro_stage', 'to_macro_stage',
            'moved_by', 'moved_by_name', 'remarks', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CandidateJobMappingSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='candidate.full_name', read_only=True)
    candidate_email = serializers.CharField(source='candidate.email', read_only=True)
    candidate_phone = serializers.CharField(source='candidate.phone', read_only=True)
    candidate_location = serializers.CharField(source='candidate.location', read_only=True)
    candidate_experience = serializers.DecimalField(
        source='candidate.total_experience_years', read_only=True,
        max_digits=4, decimal_places=1
    )
    candidate_skills = serializers.ListField(source='candidate.skills', read_only=True)
    candidate_designation = serializers.CharField(source='candidate.designation', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    job_code = serializers.CharField(source='job.job_code', read_only=True)

    class Meta:
        model = CandidateJobMapping
        fields = [
            'id', 'candidate', 'job',
            # New macro stage fields
            'macro_stage', 'offer_status', 'drop_reason',
            'current_interview_round', 'next_interview_date', 'priority',
            'screening_status',
            # Audit
            'moved_by', 'stage_updated_at', 'created_at',
            # Denormalised candidate fields
            'candidate_name', 'candidate_email', 'candidate_phone',
            'candidate_location', 'candidate_experience', 'candidate_skills',
            'candidate_designation',
            # Denormalised job fields
            'job_title', 'job_code',
        ]
        read_only_fields = ['id', 'moved_by', 'stage_updated_at', 'created_at']


class CandidateListSerializer(serializers.ModelSerializer):
    current_job = serializers.SerializerMethodField()
    current_stage = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = ['id', 'full_name', 'email', 'phone', 'location', 'designation',
                  'current_employer', 'total_experience_years', 'skills', 'source',
                  'sub_source', 'created_at', 'current_job', 'current_stage']

    def get_current_job(self, obj):
        mapping = next(iter(obj.job_mappings.all()), None)
        if mapping is None:
            return None
        return {'id': str(mapping.job_id), 'title': mapping.job.title, 'job_code': mapping.job.job_code}

    def get_current_stage(self, obj):
        mapping = next(iter(obj.job_mappings.all()), None)
        return mapping.macro_stage if mapping else None


class ResumeFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ResumeFile
        fields = ['id', 'original_filename', 'file_type', 'file_size_bytes', 'is_latest', 'created_at', 'file_url']

    def get_file_url(self, obj):
        if not obj.file:
            return None
        try:
            if not obj.file.storage.exists(obj.file.name):
                return None
        except Exception:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class CandidateDetailSerializer(serializers.ModelSerializer):
    job_mappings = CandidateJobMappingSerializer(many=True, read_only=True)
    notes = CandidateNoteSerializer(many=True, read_only=True)
    resume_files = ResumeFileSerializer(many=True, read_only=True)

    class Meta:
        model = Candidate
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not (
            request
            and hasattr(request.user, 'role')
            and request.user.role in ('admin', 'recruiter')
        ):
            data.pop('current_ctc_lakhs', None)
            data.pop('notice_period_days', None)
        return data


class CandidateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
