"""
Management command: compute AI match scores for all existing candidate-job mappings.

Usage:
    python manage.py compute_all_ai_match
    python manage.py compute_all_ai_match --overwrite    # recompute even if score exists
    python manage.py compute_all_ai_match --limit 50    # process only first N mappings
"""
from django.core.management.base import BaseCommand
from apps.candidates.models import CandidateJobMapping
from apps.candidates.services.ai_match import compute_and_save_match


class Command(BaseCommand):
    help = 'Compute AI match scores for all candidate-job mappings'

    def add_arguments(self, parser):
        parser.add_argument('--overwrite', action='store_true', help='Recompute even if score already exists')
        parser.add_argument('--limit', type=int, default=0, help='Max mappings to process (0 = all)')

    def handle(self, *args, **options):
        qs = CandidateJobMapping.objects.select_related(
            'candidate', 'job'
        ).prefetch_related('candidate__resume_files')

        if not options['overwrite']:
            qs = qs.filter(ai_match_score__isnull=True)

        if options['limit']:
            qs = qs[:options['limit']]

        total = qs.count() if not options['limit'] else min(options['limit'], qs.count())
        self.stdout.write(f"Processing {total} mappings...")

        done = 0
        errors = 0
        for mapping in qs:
            try:
                compute_and_save_match(mapping)
                done += 1
                self.stdout.write(
                    f"  [{done}/{total}] {mapping.candidate.full_name} -> "
                    f"{mapping.job.title}: {mapping.ai_match_score:.1f}%"
                )
            except Exception as exc:
                errors += 1
                self.stderr.write(
                    f"  ERROR: {mapping.candidate.full_name} / {mapping.job.title}: {exc}"
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {done} scored, {errors} errors."
        ))
