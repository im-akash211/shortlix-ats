from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin
from apps.core.rbac import MANAGE_USERS
from .models import AuditLog, Permission, Role, RolePermission, User
from .serializers import RoleSerializer, UserSerializer


def _write_audit(actor, action, target_id='', metadata=None):
    AuditLog.objects.create(
        actor=actor,
        action=action,
        target_id=str(target_id),
        metadata=metadata or {},
    )


# ── Role views ────────────────────────────────────────────────────────────────

class RoleListView(generics.ListAPIView):
    """GET /api/v1/roles/ — readable by any authenticated user."""
    permission_classes = [IsAuthenticated]
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related(
        'role_permissions__permission'
    ).all()


class RolePermissionsUpdateView(APIView):
    """PATCH /api/v1/roles/<pk>/permissions/ — admin only, full replace."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        role = generics.get_object_or_404(Role, pk=pk)

        permission_keys = request.data.get('permission_keys', [])
        if not isinstance(permission_keys, list):
            return Response(
                {'detail': 'permission_keys must be a list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate all keys exist
        valid_keys = set(Permission.objects.values_list('key', flat=True))
        unknown = set(permission_keys) - valid_keys
        if unknown:
            return Response(
                {'detail': f'Unknown permission keys: {sorted(unknown)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard: admin role must always keep MANAGE_USERS
        if role.name == 'admin' and MANAGE_USERS not in permission_keys:
            return Response(
                {'detail': 'The admin role must always retain MANAGE_USERS.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            RolePermission.objects.filter(role=role).delete()
            if permission_keys:
                perms = Permission.objects.filter(key__in=permission_keys)
                RolePermission.objects.bulk_create([
                    RolePermission(role=role, permission=p) for p in perms
                ])

        _write_audit(
            actor=request.user,
            action='ROLE_PERMISSIONS_UPDATED',
            target_id=role.id,
            metadata={'role': role.name, 'permission_keys': permission_keys},
        )

        role.refresh_from_db()
        return Response(RoleSerializer(role).data)


# ── User management views ─────────────────────────────────────────────────────

class UserRoleChangeView(APIView):
    """PATCH /api/v1/users/<pk>/role/ — change user.role CharField + db_role FK atomically."""
    permission_classes = [IsAdmin]

    VALID_ROLES = {'admin', 'hiring_manager', 'recruiter', 'interviewer'}

    def patch(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        new_role = request.data.get('role', '').strip()

        if new_role not in self.VALID_ROLES:
            return Response(
                {'detail': f'Invalid role. Must be one of: {sorted(self.VALID_ROLES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_role = user.role
        db_role_obj = Role.objects.filter(name=new_role).first()

        user.role = new_role
        user.db_role = db_role_obj
        # Invalidate per-request perm cache if present
        if hasattr(user, '_perm_cache'):
            del user._perm_cache
        user.save(update_fields=['role', 'db_role', 'updated_at'])

        _write_audit(
            actor=request.user,
            action='USER_ROLE_CHANGED',
            target_id=user.id,
            metadata={'from': old_role, 'to': new_role},
        )

        return Response(UserSerializer(user).data)


class UserStatusChangeView(APIView):
    """PATCH /api/v1/users/<pk>/status/ — change status + sync is_active."""
    permission_classes = [IsAdmin]

    VALID_STATUSES = {'INVITED', 'ACTIVE', 'DISABLED'}

    def patch(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        new_status = request.data.get('status', '').strip().upper()

        if new_status not in self.VALID_STATUSES:
            return Response(
                {'detail': f'Invalid status. Must be one of: {sorted(self.VALID_STATUSES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_status = user.status
        user.status = new_status
        # Keep is_active in sync for backward-compat with existing auth checks
        user.is_active = (new_status == 'ACTIVE')
        user.save(update_fields=['status', 'is_active', 'updated_at'])

        _write_audit(
            actor=request.user,
            action='USER_STATUS_CHANGED',
            target_id=user.id,
            metadata={'from': old_status, 'to': new_status},
        )

        return Response(UserSerializer(user).data)


class UserDeleteView(APIView):
    """DELETE /api/v1/users/<pk>/remove/ — soft-delete (is_active=False, status=DISABLED)."""
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)

        if user.pk == request.user.pk:
            return Response(
                {'detail': 'You cannot remove your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.status = 'DISABLED'
        user.save(update_fields=['is_active', 'status', 'updated_at'])

        _write_audit(
            actor=request.user,
            action='USER_REMOVED',
            target_id=user.id,
            metadata={'email': user.email},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
