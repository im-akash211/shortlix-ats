from rest_framework import serializers
from .models import Department, SubVertical


class SubVerticalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubVertical
        fields = ['id', 'name', 'department']
        read_only_fields = ['id']


class DepartmentSerializer(serializers.ModelSerializer):
    sub_verticals = SubVerticalSerializer(many=True, read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'is_active', 'sub_verticals']
        read_only_fields = ['id']
