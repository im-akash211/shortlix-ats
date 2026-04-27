from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Permission, Role, User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.full_name
        token['department_id'] = str(user.department_id) if user.department_id else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['key', 'label']


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'is_system_role', 'permissions']

    def get_permissions(self, obj):
        return [
            {'key': rp.permission.key, 'label': rp.permission.label}
            for rp in obj.role_permissions.select_related('permission').all()
        ]


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'role', 'department', 'department_name',
            'is_active', 'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserDropdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'role']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'department', 'password', 'is_active', 'status']
        read_only_fields = ['id']

    def create(self, validated_data):
        from apps.accounts.models import Role as RoleModel
        password = validated_data.pop('password')
        validated_data.setdefault('status', 'INVITED')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        # sync db_role FK on creation
        db_role = RoleModel.objects.filter(name=user.role).first()
        if db_role:
            user.db_role = db_role
            user.save(update_fields=['db_role'])
        return user
