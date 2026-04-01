"""
Role-based permission classes used across all API views.
These are stubs — full implementation requires the accounts app (Phase 1).
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with role='admin'."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'admin'
        )


class IsHiringManager(BasePermission):
    """Allow access only to users with role='hiring_manager'."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'hiring_manager'
        )


class IsRecruiter(BasePermission):
    """Allow access only to users with role='recruiter'."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'recruiter'
        )


class IsAdminOrHiringManager(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) in ('admin', 'hiring_manager')
        )


class IsAdminOrRecruiter(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) in ('admin', 'recruiter')
        )
