from django.core.management.base import BaseCommand
from django.db import transaction

PERMISSIONS = [
    ('VIEW_JOBS',           'View Jobs'),
    ('EDIT_JOBS',           'Edit & Create Jobs'),
    ('SCHEDULE_INTERVIEW',  'Schedule Interviews'),
    ('GIVE_FEEDBACK',       'Submit Interview Feedback'),
    ('VIEW_REPORTS',        'View Reports & Dashboard'),
    ('VIEW_CANDIDATES',     'View Candidates'),
    ('MANAGE_CANDIDATES',   'Manage Candidates (edit / move / delete)'),
    ('VIEW_COMPENSATION',   'View Compensation Details (CTC, Notice, ECTC, Offers)'),
    ('MANAGE_REQUISITIONS', 'Manage Requisitions'),
    ('APPROVE_REQUISITIONS','Approve Requisitions'),
    ('MANAGE_USERS',        'Manage Users'),
]

# Role name matches user.role CharField values exactly
ROLE_PERMISSIONS = {
    'admin': [
        'VIEW_JOBS', 'EDIT_JOBS', 'SCHEDULE_INTERVIEW', 'GIVE_FEEDBACK',
        'VIEW_REPORTS', 'VIEW_CANDIDATES', 'MANAGE_CANDIDATES', 'VIEW_COMPENSATION',
        'MANAGE_REQUISITIONS', 'APPROVE_REQUISITIONS', 'MANAGE_USERS',
    ],
    'hiring_manager': [
        'VIEW_JOBS', 'APPROVE_REQUISITIONS', 'GIVE_FEEDBACK',
        'VIEW_REPORTS', 'VIEW_CANDIDATES', 'MANAGE_CANDIDATES',
    ],
    'recruiter': [
        'VIEW_JOBS', 'EDIT_JOBS', 'SCHEDULE_INTERVIEW', 'GIVE_FEEDBACK',
        'VIEW_CANDIDATES', 'MANAGE_CANDIDATES', 'VIEW_COMPENSATION',
        'MANAGE_REQUISITIONS', 'VIEW_REPORTS',
    ],
    'interviewer': [
        'VIEW_JOBS', 'GIVE_FEEDBACK',
    ],
}

ROLE_DISPLAY = {
    'admin': 'Admin',
    'hiring_manager': 'Hiring Manager',
    'recruiter': 'Recruiter',
    'interviewer': 'Interviewer',
}


class Command(BaseCommand):
    help = 'Seed default roles, permissions and back-fill db_role FK on existing users'

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.accounts.models import Role, Permission, RolePermission, User

        # 1. Seed permissions
        perm_map = {}
        for key, label in PERMISSIONS:
            perm, created = Permission.objects.get_or_create(key=key, defaults={'label': label})
            if not created and perm.label != label:
                perm.label = label
                perm.save(update_fields=['label'])
            perm_map[key] = perm
            self.stdout.write(f"  {'created' if created else 'exists '} permission: {key}")

        # 2. Seed roles
        role_map = {}
        for role_key, display_name in ROLE_DISPLAY.items():
            role, created = Role.objects.get_or_create(
                name=role_key,
                defaults={'is_system_role': True},
            )
            if not created and not role.is_system_role:
                role.is_system_role = True
                role.save(update_fields=['is_system_role'])
            role_map[role_key] = role
            self.stdout.write(f"  {'created' if created else 'exists '} role: {role_key}")

        # 3. Assign permissions to roles (idempotent: set-based diff)
        for role_key, perm_keys in ROLE_PERMISSIONS.items():
            role = role_map[role_key]
            desired = set(perm_keys)
            existing = set(
                RolePermission.objects.filter(role=role)
                .values_list('permission__key', flat=True)
            )
            to_add = desired - existing
            to_remove = existing - desired

            if to_add:
                RolePermission.objects.bulk_create([
                    RolePermission(role=role, permission=perm_map[k])
                    for k in to_add
                ])
            if to_remove:
                RolePermission.objects.filter(
                    role=role, permission__key__in=to_remove
                ).delete()

            self.stdout.write(
                f"  role '{role_key}': +{len(to_add)} -{len(to_remove)} permissions"
            )

        # 4. Back-fill db_role FK for existing users
        backfilled = 0
        for user in User.objects.filter(db_role__isnull=True).select_related('db_role'):
            role_obj = role_map.get(user.role)
            if role_obj:
                user.db_role = role_obj
                user.save(update_fields=['db_role'])
                backfilled += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Back-filled db_role for {backfilled} existing user(s).'
        ))
