from rest_framework.permissions import BasePermission, SAFE_METHODS
from apps.core.rbac import has_permission


def rbac_perm(permission_key):
    """
    Factory that returns a DRF permission class backed by the DB role system.

    Usage:
        permission_classes = [rbac_perm('VIEW_CANDIDATES')]
    """
    class _RBACPermission(BasePermission):
        _key = permission_key

        def has_permission(self, request, view):
            return (
                request.user.is_authenticated
                and has_permission(request.user, self._key)
            )

    _RBACPermission.__name__ = f'RBACPerm_{permission_key}'
    return _RBACPermission


class CanEditJob(BasePermission):
    """
    Allows editing a job if:
      - user has EDIT_JOBS permission, AND
      - user is admin (any job) OR created/collaborates on this specific job.
    Safe methods always pass (read access is controlled separately).
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return has_permission(request.user, 'EDIT_JOBS')

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if not has_permission(request.user, 'EDIT_JOBS'):
            return False
        if request.user.role == 'admin':
            return True
        return (
            obj.created_by_id == request.user.pk
            or obj.collaborators.filter(user=request.user).exists()
        )


# ── Kept for backward-compat with existing code that hasn't been migrated ─────
# Do not use these in new code — use rbac_perm() instead.

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrHM(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'hiring_manager')


class IsAdminOrRecruiter(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'recruiter')


class IsAdminRecruiterOrHM(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, 'role')
            and request.user.role in ('admin', 'recruiter', 'hiring_manager')
        )


class IsJobCollaborator(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj.collaborators.filter(user=request.user).exists()


class HasRBACPermission(BasePermission):
    """
    Generic DB-backed permission. Set required_permission on the view:
        permission_classes = [HasRBACPermission]
        required_permission = 'MANAGE_CANDIDATES'
    Or use the rbac_perm() factory instead.
    """
    required_permission = None

    def has_permission(self, request, view):
        perm = getattr(view, 'required_permission', self.required_permission)
        if not perm:
            return False
        return request.user.is_authenticated and has_permission(request.user, perm)
