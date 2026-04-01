import uuid

from django.db import models


class Department(models.Model):
    """Company department (e.g., Engineering, Analytics, Operations)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments'
        ordering = ['name']

    def __str__(self):
        return self.name


class SubVertical(models.Model):
    """
    Sub-vertical within a department.
    The requisition form has two sub-vertical dropdowns (sub_vertical_1, sub_vertical_2),
    both select from this same pool of values scoped to the chosen department.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='sub_verticals',
    )
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sub_verticals'
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['department', 'name'],
                name='unique_department_sub_vertical',
            ),
        ]

    def __str__(self):
        return f'{self.department.name} / {self.name}'
