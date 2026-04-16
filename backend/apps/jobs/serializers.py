from rest_framework import serializers
from django.db.models import Count, Q
from .models import Job, JobCollaborator, JobHistory, ALLOWED_TRANSITIONS


class JobCollaboratorSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = JobCollaborator
        fields = ['id', 'user', 'user_name', 'user_email', 'added_by', 'created_at']
        read_only_fields = ['id', 'added_by', 'created_at']


class JobHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = JobHistory
        fields = [
            'id', 'event_type', 'changed_by', 'changed_by_name',
            'previous_value', 'new_value', 'description', 'created_at',
        ]

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.full_name
        return None


class JobListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    hiring_manager_name = serializers.CharField(source='hiring_manager.full_name', read_only=True)
    # These fields are populated by annotations in JobListView.get_queryset() — no per-row DB queries.
    applies_count = serializers.IntegerField(read_only=True)
    shortlists_count = serializers.IntegerField(read_only=True)
    offers_count = serializers.IntegerField(read_only=True)
    joined_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Job
        fields = ['id', 'job_code', 'title', 'department', 'department_name',
                  'hiring_manager', 'hiring_manager_name', 'location', 'status',
                  'experience_min', 'experience_max', 'created_at',
                  'applies_count', 'shortlists_count', 'offers_count', 'joined_count']


class JobDetailSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    hiring_manager_name = serializers.CharField(source='hiring_manager.full_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    collaborators = JobCollaboratorSerializer(many=True, read_only=True)
    pipeline_stats = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    recruiters_working = serializers.SerializerMethodField()
    tat_days = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = '__all__'
        read_only_fields = ['id', 'job_code', 'created_at', 'updated_at']

    def validate(self, data):
        if 'status' in data and self.instance:
            current = self.instance.status
            new = data['status']
            if new != current and new not in ALLOWED_TRANSITIONS.get(current, []):
                raise serializers.ValidationError(
                    {'status': f'Cannot change status from "{current}" to "{new}".'}
                )
        return data

    def get_pipeline_stats(self, obj):
        from apps.candidates.models import PIPELINE_STAGES
        stats = {}
        for stage_key, stage_label in PIPELINE_STAGES:
            stats[stage_key] = obj.candidate_mappings.filter(stage=stage_key).count()
        stats['total'] = obj.candidate_mappings.count()
        return stats

    def get_history(self, obj):
        entries = obj.history.select_related('changed_by').order_by('-created_at')[:20]
        return JobHistorySerializer(entries, many=True).data

    def get_recruiters_working(self, obj):
        result = []
        if obj.created_by:
            result.append({
                'id': str(obj.created_by.id),
                'name': obj.created_by.full_name,
                'email': obj.created_by.email,
            })
        for c in obj.collaborators.select_related('user').all():
            if not any(r['id'] == str(c.user.id) for r in result):
                result.append({
                    'id': str(c.user.id),
                    'name': c.user.full_name,
                    'email': c.user.email,
                })
        return result

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name
        # Fallback for jobs created before the created_by field was populated:
        # the requisition always has a non-null created_by.
        try:
            return obj.requisition.created_by.full_name
        except Exception:
            return None

    def get_tat_days(self, obj):
        try:
            return obj.requisition.tat_days
        except Exception:
            return None

    def get_budget(self, obj):
        request = self.context.get('request')
        if request and hasattr(request.user, 'role') and request.user.role in ('admin', 'recruiter'):
            try:
                val = obj.requisition.budget
                return str(val) if val is not None else None
            except Exception:
                return None
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # budget is already conditionally None from get_budget — clean up null entry for non-privileged roles
        request = self.context.get('request')
        if request and hasattr(request.user, 'role') and request.user.role not in ('admin', 'recruiter'):
            data.pop('budget', None)
        return data
