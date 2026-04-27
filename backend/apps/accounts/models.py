import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('hiring_manager', 'Hiring Manager'),
        ('recruiter', 'Recruiter'),
        ('interviewer', 'Interviewer'),
    ]

    STATUS_CHOICES = [
        ('INVITED', 'Invited'),
        ('ACTIVE', 'Active'),
        ('DISABLED', 'Disabled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='recruiter')
    department = models.ForeignKey(
        'departments.Department', null=True, blank=True, on_delete=models.SET_NULL
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    db_role = models.ForeignKey(
        'accounts.Role',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='users',
        db_column='db_role_id',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.full_name


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    is_system_role = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_role'
        ordering = ['name']

    def __str__(self):
        return self.name


class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=255)

    class Meta:
        db_table = 'accounts_permission'
        ordering = ['key']

    def __str__(self):
        return self.key


class RolePermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')

    class Meta:
        db_table = 'accounts_role_permission'
        unique_together = [('role', 'permission')]
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['permission']),
        ]

    def __str__(self):
        return f"{self.role.name}:{self.permission.key}"


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_actions',
    )
    action = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_audit_log'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} by {self.actor_id} at {self.timestamp}"
