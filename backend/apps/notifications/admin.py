from django.contrib import admin

from .models import EmailTemplate, NotificationSetting, EmailLog


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ('template_key', 'description', 'updated_at')
    search_fields = ('template_key', 'description')


@admin.register(NotificationSetting)
class NotificationSettingAdmin(admin.ModelAdmin):
    list_display = ('event_key', 'label', 'is_enabled', 'updated_at')
    list_filter = ('is_enabled',)
    list_editable = ('is_enabled',)


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ('template_key', 'to_email', 'status', 'created_at')
    list_filter = ('status', 'template_key')
    readonly_fields = ('created_at',)
