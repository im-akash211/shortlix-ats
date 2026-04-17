from django.contrib import admin

from .models import (
    Candidate, ResumeFile, CandidateJobMapping,
    PipelineStageHistory, CandidateNote,
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
    list_display = ('candidate', 'job', 'macro_stage', 'current_interview_round', 'priority', 'stage_updated_at')
    list_filter = ('macro_stage', 'priority')


@admin.register(PipelineStageHistory)
class PipelineStageHistoryAdmin(admin.ModelAdmin):
    list_display = ('mapping', 'from_macro_stage', 'to_macro_stage', 'moved_by', 'created_at')
    readonly_fields = ('created_at',)
