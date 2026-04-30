from rest_framework import serializers
from .models import (
    Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote, CandidateNoteHistory,
    ResumeFile, CandidateJobComment, CandidateReminder,
)


class CandidateNoteHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateNoteHistory
        fields = ['id', 'content', 'edited_at']


class CandidateJobCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model  = CandidateJobComment
        fields = ['id', 'mapping', 'user', 'user_name', 'content', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class CandidateNoteSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    history = CandidateNoteHistorySerializer(many=True, read_only=True)

    class Meta:
        model = CandidateNote
        fields = ['id', 'candidate', 'user', 'user_id', 'user_name', 'content', 'is_edited', 'history', 'created_at', 'updated_at']
        read_only_fields = ['id', 'candidate', 'user', 'user_id', 'is_edited', 'history', 'created_at', 'updated_at']


class PipelineStageHistorySerializer(serializers.ModelSerializer):
    moved_by_name = serializers.CharField(source='moved_by.full_name', read_only=True)

    class Meta:
        model = PipelineStageHistory
        fields = ['id', 'from_macro_stage', 'to_macro_stage', 'moved_by_name', 'remarks', 'created_at']


class ArchivedMappingSerializer(serializers.ModelSerializer):
    """Minimal serializer for a previous (archived) job mapping, used nested inside the active one."""
    job_code             = serializers.CharField(source='job.job_code', read_only=True)
    job_title            = serializers.CharField(source='job.title', read_only=True)
    department_name      = serializers.CharField(source='job.department.name', read_only=True)
    hiring_manager_name  = serializers.CharField(source='job.hiring_manager.full_name', read_only=True)
    stage_logs           = serializers.SerializerMethodField()
    latest_round         = serializers.SerializerMethodField()

    class Meta:
        model = CandidateJobMapping
        fields = [
            'id', 'job', 'job_code', 'job_title', 'department_name', 'hiring_manager_name',
            'macro_stage', 'drop_reason', 'interview_status', 'action_reason',
            'current_interview_round',
            'created_at', 'archived_at',
            'stage_logs', 'latest_round',
        ]

    def get_stage_logs(self, obj):
        logs = obj.stage_logs.select_related('moved_by').order_by('created_at')
        return PipelineStageHistorySerializer(logs, many=True).data

    def get_latest_round(self, obj):
        interview = obj.interviews.order_by('-created_at').first()
        if not interview:
            return None
        return {
            'id': str(interview.id),
            'round_name': interview.round_name,
            'round_status': interview.round_status,
            'round_result': interview.round_result,
            'scheduled_at': interview.scheduled_at.isoformat() if interview.scheduled_at else None,
        }


class CandidateJobMappingSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        from apps.core.rbac import has_permission
        if request and not has_permission(request.user, 'VIEW_COMPENSATION'):
            data.pop('offer_status', None)
        return data

    candidate_name = serializers.CharField(source='candidate.full_name', read_only=True)
    candidate_email = serializers.CharField(source='candidate.email', read_only=True)
    candidate_phone = serializers.CharField(source='candidate.phone', read_only=True)
    candidate_location = serializers.CharField(source='candidate.location', read_only=True)
    candidate_experience = serializers.DecimalField(
        source='candidate.total_experience_years', read_only=True,
        max_digits=4, decimal_places=1
    )
    candidate_skills = serializers.ListField(source='candidate.skills', read_only=True)
    candidate_tags = serializers.ListField(source='candidate.tags', read_only=True)
    candidate_designation = serializers.CharField(source='candidate.designation', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    job_code = serializers.CharField(source='job.job_code', read_only=True)
    previous_mapping = ArchivedMappingSerializer(read_only=True)

    class Meta:
        model = CandidateJobMapping
        fields = [
            'id', 'candidate', 'job',
            # Core pipeline stage
            'macro_stage', 'offer_status', 'drop_reason',
            'current_interview_round', 'next_interview_date', 'priority',
            'screening_status',
            'interview_status',
            'action_reason',
            'rejected_from_stage',
            # Audit
            'moved_by', 'stage_updated_at', 'created_at',
            # Denormalised candidate fields
            'candidate_name', 'candidate_email', 'candidate_phone',
            'candidate_location', 'candidate_experience', 'candidate_skills', 'candidate_tags',
            'candidate_designation',
            # Denormalised job fields
            'job_title', 'job_code',
            # AI match
            'ai_match_score', 'ai_match_reason', 'ai_match_computed_at',
            # Cross-job move history
            'previous_mapping',
        ]
        read_only_fields = ['id', 'moved_by', 'stage_updated_at', 'created_at']


class CandidateListSerializer(serializers.ModelSerializer):
    current_job = serializers.SerializerMethodField()
    current_stage = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = ['id', 'full_name', 'email', 'phone', 'location', 'designation',
                  'current_employer', 'total_experience_years', 'skills', 'tags', 'source',
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
            url = obj.file.url
        except Exception:
            return None
        request = self.context.get('request')
        if request and url.startswith('/'):
            return request.build_absolute_uri(url)
        return url


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
        from apps.core.rbac import has_permission
        if not (request and has_permission(request.user, 'VIEW_COMPENSATION')):
            data.pop('current_ctc_lakhs', None)
            data.pop('expected_ctc_lakhs', None)
            data.pop('notice_period_days', None)
        return data


class CandidateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class CandidateReminderSerializer(serializers.ModelSerializer):
    job_id = serializers.UUIDField(source='mapping.job.id', read_only=True)
    job_title = serializers.CharField(source='mapping.job.title', read_only=True)
    macro_stage = serializers.CharField(source='mapping.macro_stage', read_only=True)

    class Meta:
        model = CandidateReminder
        fields = [
            'id', 'candidate', 'mapping', 'remind_at', 'note',
            'is_done', 'notified', 'created_at', 'updated_at',
            'job_id', 'job_title', 'macro_stage',
        ]
        read_only_fields = ['id', 'candidate', 'notified', 'created_at', 'updated_at']
