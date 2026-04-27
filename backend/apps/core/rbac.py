_LEGACY_MAP = {
    'admin': {
        'VIEW_JOBS', 'EDIT_JOBS', 'SCHEDULE_INTERVIEW', 'GIVE_FEEDBACK',
        'VIEW_REPORTS', 'MANAGE_CANDIDATES', 'MANAGE_REQUISITIONS',
        'APPROVE_REQUISITIONS', 'MANAGE_USERS',
    },
    'hiring_manager': {
        'VIEW_JOBS', 'APPROVE_REQUISITIONS', 'GIVE_FEEDBACK',
        'VIEW_REPORTS', 'MANAGE_CANDIDATES',
    },
    'recruiter': {
        'VIEW_JOBS', 'EDIT_JOBS', 'SCHEDULE_INTERVIEW',
        'MANAGE_CANDIDATES', 'MANAGE_REQUISITIONS', 'VIEW_REPORTS',
    },
    'interviewer': {
        'VIEW_JOBS', 'GIVE_FEEDBACK',
    },
}

# Permission key constants for import-safe usage
VIEW_JOBS = 'VIEW_JOBS'
EDIT_JOBS = 'EDIT_JOBS'
SCHEDULE_INTERVIEW = 'SCHEDULE_INTERVIEW'
GIVE_FEEDBACK = 'GIVE_FEEDBACK'
VIEW_REPORTS = 'VIEW_REPORTS'
MANAGE_CANDIDATES = 'MANAGE_CANDIDATES'
MANAGE_REQUISITIONS = 'MANAGE_REQUISITIONS'
APPROVE_REQUISITIONS = 'APPROVE_REQUISITIONS'
MANAGE_USERS = 'MANAGE_USERS'


def has_permission(user, permission_key: str) -> bool:
    """
    Return True if user holds the given permission.

    Loads all permissions for the user's db_role in a single query and
    caches them on the user instance for the lifetime of the request.
    Falls back to the legacy string-map when db_role is not yet populated
    (safe during the transition period before seed_roles has run).
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return False

    cache_attr = '_perm_cache'
    if not hasattr(user, cache_attr):
        if getattr(user, 'db_role_id', None) is not None:
            keys = set(
                user.db_role.role_permissions
                .values_list('permission__key', flat=True)
            )
        else:
            keys = _LEGACY_MAP.get(getattr(user, 'role', ''), set())
        setattr(user, cache_attr, keys)

    return permission_key in getattr(user, cache_attr)
