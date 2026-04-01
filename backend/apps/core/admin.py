from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'entity_type', 'entity_id', 'user', 'ip_address', 'created_at')
    list_filter = ('action', 'entity_type')
    search_fields = ('entity_type', 'entity_id')
    readonly_fields = ('user', 'action', 'entity_type', 'entity_id', 'changes', 'ip_address', 'created_at')
