import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    HIRING_MANAGER = 'hiring_manager', 'Hiring Manager'
    RECRUITER = 'recruiter', 'Recruiter'


class UserManager(BaseUserManager):
    """Custom manager for email-based authentication."""

    def create_user(self, email, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)
        return self.create_user(email, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model with email as the login identifier and role-based access.
    Roles: admin, hiring_manager, recruiter.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.RECRUITER,
    )
    department = models.ForeignKey(
        'departments.Department',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='users',
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # SSO fields (wired later)
    sso_provider = models.CharField(max_length=50, blank=True)
    sso_subject_id = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['sso_provider', 'sso_subject_id'],
                name='unique_sso_identity',
                condition=~models.Q(sso_provider=''),
            ),
        ]

    def __str__(self):
        return f'{self.full_name} ({self.email})'

    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN

    @property
    def is_hiring_manager(self):
        return self.role == UserRole.HIRING_MANAGER

    @property
    def is_recruiter(self):
        return self.role == UserRole.RECRUITER
