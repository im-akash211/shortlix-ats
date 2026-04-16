from rest_framework import serializers
from django.db.models import Count, Q
from .models import Requisition, RequisitionApproval


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

    def create(self, validated_data):
        import random
        purpose = validated_data.get('purpose', 'internal')
        prefix = 'SHT-INT' if purpose == 'internal' else 'SHT-CLT'
        while True:
            code = f'{prefix}-{random.randint(1000, 9999)}'
            if not Requisition.objects.filter(purpose_code=code).exists():
                break
        validated_data['purpose_code'] = code
        return super().create(validated_data)
