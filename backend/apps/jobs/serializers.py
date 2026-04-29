from rest_framework import serializers
from django.db.models import Count, Q
from .models import Job, JobCollaborator, JobHistory, ALLOWED_TRANSITIONS

SIGNAL_LABELS = {
    'iit_grad':             'IIT Grad',
    'nit_grad':             'NIT Grad',
    'iim_grad':             'IIM Grad',
    'top_institute':        'Top Institute',
    'unicorn_exp':          'Unicorn Exp',
    'top_internet_product': 'Top Internet Product',
    'top_software_product': 'Top Software Product',
    'top_it_services_mnc':  'Top IT Services MNC',
    'top_consulting_mnc':   'Top Consulting MNC',
}


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
    purpose = serializers.CharField(source='requisition.purpose', read_only=True, default='')
    purpose_code = serializers.CharField(source='requisition.purpose_code', read_only=True, default='')
    applies_count = serializers.IntegerField(read_only=True)
    shortlists_count = serializers.IntegerField(read_only=True)
    interviews_count = serializers.IntegerField(read_only=True)
    offers_count = serializers.IntegerField(read_only=True)
    joined_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Job
        fields = [
            'id', 'job_code', 'title', 'department', 'department_name',
            'hiring_manager', 'hiring_manager_name', 'location', 'status',
            'experience_min', 'experience_max', 'created_at', 'purpose', 'purpose_code',
            'applies_count', 'shortlists_count', 'interviews_count', 'offers_count', 'joined_count',
        ]


class JobDetailSerializer(serializers.ModelSerializer):
    # Denormalised read-only fields
    department_name     = serializers.CharField(source='department.name', read_only=True)
    hiring_manager_name = serializers.CharField(source='hiring_manager.full_name', read_only=True)
    sub_vertical_1_name = serializers.CharField(source='sub_vertical_1.name', read_only=True, default=None)
    sub_vertical_2_name = serializers.CharField(source='sub_vertical_2.name', read_only=True, default=None)
    created_by_name     = serializers.SerializerMethodField()
    # Requisition context (read-only)
    purpose             = serializers.CharField(source='requisition.purpose', read_only=True, default='')
    purpose_code        = serializers.CharField(source='requisition.purpose_code', read_only=True, default='')
    # Relations
    collaborators       = JobCollaboratorSerializer(many=True, read_only=True)
    # Computed
    pipeline_stats      = serializers.SerializerMethodField()
    history             = serializers.SerializerMethodField()
    recruiters_working  = serializers.SerializerMethodField()
    candidate_signals   = serializers.SerializerMethodField()

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
        from apps.candidates.models import MACRO_STAGE_CHOICES
        stats = {}
        for stage_key, _ in MACRO_STAGE_CHOICES:
            stats[stage_key.lower()] = obj.candidate_mappings.filter(macro_stage=stage_key).count()
        stats['total'] = obj.candidate_mappings.count()
        return stats

    def get_history(self, obj):
        entries = obj.history.select_related('changed_by').order_by('-created_at')[:20]
        return JobHistorySerializer(entries, many=True).data

    def get_recruiters_working(self, obj):
        result = []
        if obj.created_by and obj.created_by.role == 'recruiter':
            result.append({'id': str(obj.created_by.id), 'name': obj.created_by.full_name, 'email': obj.created_by.email})
        for c in obj.collaborators.select_related('user').all():
            if c.user.role == 'recruiter' and not any(r['id'] == str(c.user.id) for r in result):
                result.append({'id': str(c.user.id), 'name': c.user.full_name, 'email': c.user.email})
        return result

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name
        try:
            return obj.requisition.created_by.full_name
        except Exception:
            return None

    def get_candidate_signals(self, obj):
        return [label for key, label in SIGNAL_LABELS.items() if getattr(obj, key, False)]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and hasattr(request.user, 'role') and request.user.role not in ('admin', 'recruiter'):
            data.pop('budget_min', None)
            data.pop('budget_max', None)
        return data
