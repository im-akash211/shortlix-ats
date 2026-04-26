from rest_framework import serializers
from .models import InAppNotification


class InAppNotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    candidate_name = serializers.CharField(source='candidate.full_name', read_only=True)
    candidate_id = serializers.UUIDField(source='candidate.id', read_only=True)
    job_id = serializers.UUIDField(source='job.id', read_only=True)

    class Meta:
        model = InAppNotification
        fields = [
            'id', 'notification_type', 'message', 'is_read', 'created_at',
            'sender_name', 'candidate_name', 'candidate_id',
            'job_id', 'macro_stage',
        ]
        read_only_fields = ['id', 'created_at']
