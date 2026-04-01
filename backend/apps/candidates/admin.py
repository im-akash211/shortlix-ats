from django.contrib import admin

from .models import (
    Candidate, ResumeFile, CandidateJobMapping,
    PipelineStageLog, CandidateNote,
)


class ResumeFileInline(admin.TabularInline):
    model = ResumeFile
    extra = 0
    readonly_fields = ('file_size_bytes', 'created_at')


class CandidateJobMappingInline(admin.TabularInline):
    model = CandidateJobMapping
    extra = 0
    readonly_fields = ('stage_updated_at', 'created_at')


class CandidateNoteInline(admin.TabularInline):
    model = CandidateNote
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'designation', 'total_experience_years', 'source', 'parsing_status', 'created_at')
    list_filter = ('source', 'parsing_status')
    search_fields = ('full_name', 'email', 'phone', 'designation')
    readonly_fields = ('created_at', 'updated_at', 'parsed_data')
    inlines = [ResumeFileInline, CandidateJobMappingInline, CandidateNoteInline]


@admin.register(CandidateJobMapping)
class CandidateJobMappingAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'job', 'stage', 'stage_updated_at')
    list_filter = ('stage',)


@admin.register(PipelineStageLog)
class PipelineStageLogAdmin(admin.ModelAdmin):
    list_display = ('mapping', 'from_stage', 'to_stage', 'changed_by', 'created_at')
    readonly_fields = ('created_at',)
