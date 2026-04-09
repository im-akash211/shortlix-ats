from rest_framework import serializers
from django.db.models import Count, Q
from .models import Job, JobCollaborator


class JobCollaboratorSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = JobCollaborator
        fields = ['id', 'user', 'user_name', 'user_email', 'added_by', 'created_at']
        read_only_fields = ['id', 'added_by', 'created_at']


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
    collaborators = JobCollaboratorSerializer(many=True, read_only=True)
    pipeline_stats = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = '__all__'
        read_only_fields = ['id', 'job_code', 'created_at', 'updated_at']

    def get_pipeline_stats(self, obj):
        from apps.candidates.models import PIPELINE_STAGES
        stats = {}
        for stage_key, stage_label in PIPELINE_STAGES:
            stats[stage_key] = obj.candidate_mappings.filter(stage=stage_key).count()
        stats['total'] = obj.candidate_mappings.count()
        return stats
