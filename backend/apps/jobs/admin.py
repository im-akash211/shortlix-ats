from django.contrib import admin

from .models import Job, JobCollaborator


class JobCollaboratorInline(admin.TabularInline):
    model = JobCollaborator
    extra = 0


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('job_code', 'title', 'status', 'department', 'hiring_manager', 'created_at')
    list_filter = ('status', 'department')
    search_fields = ('job_code', 'title')
    readonly_fields = ('created_at', 'updated_at', 'view_count')
    inlines = [JobCollaboratorInline]


@admin.register(JobCollaborator)
class JobCollaboratorAdmin(admin.ModelAdmin):
    list_display = ('job', 'user', 'added_by', 'created_at')
