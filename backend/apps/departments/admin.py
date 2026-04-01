from django.contrib import admin

from .models import Department, SubVertical


class SubVerticalInline(admin.TabularInline):
    model = SubVertical
    extra = 1


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    inlines = [SubVerticalInline]


@admin.register(SubVertical)
class SubVerticalAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'is_active')
    list_filter = ('department', 'is_active')
    search_fields = ('name',)
