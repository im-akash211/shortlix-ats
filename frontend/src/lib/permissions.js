/**
 * Check if a user has a given permission key.
 * `user.permissions` is the array returned by UserSerializer.get_permissions().
 */
export function hasPermission(user, key) {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes(key);
}

export const PERM = {
  VIEW_JOBS:            'VIEW_JOBS',
  EDIT_JOBS:            'EDIT_JOBS',
  VIEW_CANDIDATES:      'VIEW_CANDIDATES',
  MANAGE_CANDIDATES:    'MANAGE_CANDIDATES',
  VIEW_COMPENSATION:    'VIEW_COMPENSATION',
  SCHEDULE_INTERVIEW:   'SCHEDULE_INTERVIEW',
  GIVE_FEEDBACK:        'GIVE_FEEDBACK',
  VIEW_REPORTS:         'VIEW_REPORTS',
  MANAGE_REQUISITIONS:  'MANAGE_REQUISITIONS',
  APPROVE_REQUISITIONS: 'APPROVE_REQUISITIONS',
  MANAGE_USERS:         'MANAGE_USERS',
};
