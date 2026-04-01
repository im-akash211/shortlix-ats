from django.contrib import admin

from .models import FeedbackTemplate, Interview, InterviewFeedback, CompetencyRating


@admin.register(FeedbackTemplate)
class FeedbackTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_default', 'created_by', 'created_at')
    list_filter = ('is_default',)


class CompetencyRatingInline(admin.TabularInline):
    model = CompetencyRating
    extra = 0


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ('mapping', 'round_label', 'interviewer', 'scheduled_at', 'mode', 'status')
    list_filter = ('status', 'mode', 'round_number')
    search_fields = ('mapping__candidate__full_name',)


@admin.register(InterviewFeedback)
class InterviewFeedbackAdmin(admin.ModelAdmin):
    list_display = ('interview', 'interviewer', 'overall_rating', 'recommendation', 'submitted_at')
    list_filter = ('recommendation',)
    inlines = [CompetencyRatingInline]
