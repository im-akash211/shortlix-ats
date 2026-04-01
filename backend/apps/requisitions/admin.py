from django.contrib import admin

from .models import Requisition, RequisitionApproval


class RequisitionApprovalInline(admin.TabularInline):
    model = RequisitionApproval
    extra = 0
    readonly_fields = ('action', 'acted_by', 'comments', 'created_at')


@admin.register(Requisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'department', 'priority', 'created_by', 'created_at')
    list_filter = ('status', 'priority', 'employment_type', 'department')
    search_fields = ('title', 'designation', 'skills_required')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [RequisitionApprovalInline]


@admin.register(RequisitionApproval)
class RequisitionApprovalAdmin(admin.ModelAdmin):
    list_display = ('requisition', 'action', 'acted_by', 'created_at')
    list_filter = ('action',)
    readonly_fields = ('created_at',)
