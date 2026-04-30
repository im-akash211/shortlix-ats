from rest_framework import serializers
from apps.activity.models import ActivityLog


class ActorSerializer(serializers.Serializer):
    id   = serializers.IntegerField()
    name = serializers.SerializerMethodField()
    role = serializers.CharField()

    def get_name(self, obj):
        return obj.full_name or obj.email


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = ActorSerializer(read_only=True)

    class Meta:
        model  = ActivityLog
        fields = ['id', 'actor', 'action', 'entity_type', 'sentence', 'metadata', 'created_at']
