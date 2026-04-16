from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrHM(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'hiring_manager')


class IsAdminOrRecruiter(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'recruiter')


class IsJobCollaborator(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj.collaborators.filter(user=request.user).exists()


class IsAdminRecruiterOrHM(BasePermission):
    """Allows Admin, Recruiter, and Hiring Manager — blocks Interviewer from creating requisitions."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, 'role')
            and request.user.role in ('admin', 'recruiter', 'hiring_manager')
        )
