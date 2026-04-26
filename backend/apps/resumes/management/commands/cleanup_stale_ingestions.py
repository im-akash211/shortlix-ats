"""
Management command: cleanup_stale_ingestions

Deletes ResumeIngestion records (and their S3 files) that were never converted
to a candidate and are older than --days (default: 7).

Safe to run as a cron job daily.

Usage:
  python manage.py cleanup_stale_ingestions
  python manage.py cleanup_stale_ingestions --days 30
  python manage.py cleanup_stale_ingestions --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


STALE_STATUSES = {
    'uploaded', 'queued', 'processing',
    'parsed', 'reviewed', 'failed',
    'review_pending', 'duplicate_found', 'discarded',
}


class Command(BaseCommand):
    help = 'Delete stale ResumeIngestion records and their S3 files older than N days'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=7,
            help='Delete ingestions older than this many days (default: 7)',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would be deleted without making any changes',
        )

    def handle(self, *args, **options):
        from apps.resumes.models import ResumeIngestion

        days = options['days']
        dry_run = options['dry_run']
        cutoff = timezone.now() - timedelta(days=days)

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN — no changes will be made\n'))

        qs = ResumeIngestion.objects.filter(
            status__in=STALE_STATUSES,
            created_at__lt=cutoff,
        )

        total = qs.count()
        self.stdout.write(f'Found {total} stale ingestion(s) older than {days} day(s)\n')

        deleted = 0
        errors = 0

        for ingestion in qs.iterator():
            filename = ingestion.original_filename
            self.stdout.write(f'  [{ingestion.status}] {filename} (created {ingestion.created_at.date()})')

            if dry_run:
                continue

            # Delete S3 file
            if ingestion.file:
                try:
                    ingestion.file.delete(save=False)
                except Exception as exc:
                    self.stdout.write(f'    [WARN] Could not delete S3 file: {exc}')

            try:
                ingestion.delete()
                deleted += 1
            except Exception as exc:
                self.stdout.write(f'    [ERROR] Could not delete ingestion: {exc}')
                errors += 1

        self.stdout.write('\n' + '=' * 45)
        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN: would delete {total} ingestion(s)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Deleted: {deleted}  |  Errors: {errors}'))
        self.stdout.write('=' * 45)
