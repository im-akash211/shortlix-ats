from rest_framework import serializers
from django.db.models import Count, Q
from .models import Requisition, RequisitionApproval


def _generate_purpose_code(purpose):
    """Generate next sequential purpose code: SHT-INT-N or SHT-CLT-N (max+1)."""
    prefix = 'SHT-INT' if purpose == 'internal' else 'SHT-CLT'
    existing = Requisition.objects.filter(
        purpose_code__startswith=prefix
    ).values_list('purpose_code', flat=True)
    numbers = []
    for code in existing:
        try:
            numbers.append(int(code.split('-')[-1]))
        except ValueError:
            pass
    next_num = max(numbers) + 1 if numbers else 0
    return f'{prefix}-{next_num:03d}'


class RequisitionApprovalSerializer(serializers.ModelSerializer):
    acted_by_name = serializers.CharField(source='acted_by.full_name', read_only=True)

    class Meta:
        model = RequisitionApproval
        fields = ['id', 'action', 'acted_by', 'acted_by_name', 'comments', 'created_at']
        read_only_fields = ['id', 'created_at']


class RequisitionListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    hiring_manager_name = serializers.CharField(source='hiring_manager.full_name', read_only=True)
    applies_count = serializers.SerializerMethodField()
    shortlists_count = serializers.SerializerMethodField()
    offers_count = serializers.SerializerMethodField()
    joined_count = serializers.SerializerMethodField()

    class Meta:
        model = Requisition
        fields = ['id', 'title', 'department', 'department_name', 'location', 'status',
                  'hiring_manager', 'hiring_manager_name', 'positions_count', 'priority',
                  'purpose', 'purpose_code',
                  'created_at', 'applies_count', 'shortlists_count', 'offers_count', 'joined_count']

    def _get_job_stage_count(self, obj, stages):
        try:
            job = obj.job
            return job.candidate_mappings.filter(stage__in=stages).count()
        except Exception:
            return 0

    def get_applies_count(self, obj):
        return self._get_job_stage_count(obj, ['pending', 'shortlisted', 'interview', 'on_hold', 'selected', 'rejected', 'offered', 'joined'])

    def get_shortlists_count(self, obj):
        return self._get_job_stage_count(obj, ['shortlisted', 'interview', 'selected', 'offered', 'joined'])

    def get_offers_count(self, obj):
        return self._get_job_stage_count(obj, ['offered', 'joined'])

    def get_joined_count(self, obj):
        return self._get_job_stage_count(obj, ['joined'])


class RequisitionDetailSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    sub_vertical_1_name = serializers.CharField(source='sub_vertical_1.name', read_only=True, default=None)
    sub_vertical_2_name = serializers.CharField(source='sub_vertical_2.name', read_only=True, default=None)
    hiring_manager_name = serializers.CharField(source='hiring_manager.full_name', read_only=True)
    l1_approver_name = serializers.CharField(source='l1_approver.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    approval_logs = RequisitionApprovalSerializer(many=True, read_only=True)

    class Meta:
        model = Requisition
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'status']


class RequisitionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Requisition
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'status', 'purpose_code']

    def validate(self, data):
        import re
        errors = {}

        if not (data.get('title') or '').strip():
            errors['title'] = 'Job title is required.'
        if not data.get('department'):
            errors['department'] = 'Department is required.'
        if not (data.get('location') or '').strip():
            errors['location'] = 'Location is required.'
        if not (data.get('work_mode') or '').strip():
            errors['work_mode'] = 'Work mode is required.'

        jd_html = data.get('job_description') or ''
        jd_text = re.sub(r'<[^>]+>', '', jd_html).strip()
        if not jd_text:
            errors['job_description'] = 'Job description is required.'

        skills = data.get('skills_required') or []
        if len(skills) < 3:
            errors['skills_required'] = 'Please add at least 3 mandatory skills.'

        exp_max = data.get('experience_max', 0)
        exp_min = data.get('experience_min', 0)
        if not exp_max or float(exp_max) <= 0:
            errors['experience_max'] = 'Experience max must be greater than 0.'
        elif float(exp_max) < float(exp_min):
            errors['experience_max'] = 'Max experience must be ≥ min.'

        if not data.get('salary_min'):
            errors['salary_min'] = 'Salary min is required.'
        if not data.get('salary_max'):
            errors['salary_max'] = 'Salary max is required.'

        if errors:
            raise serializers.ValidationError(errors)
        return data

    def create(self, validated_data):
        purpose = validated_data.get('purpose', 'internal')
        validated_data['purpose_code'] = _generate_purpose_code(purpose)
        return super().create(validated_data)
