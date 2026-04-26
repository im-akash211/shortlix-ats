"""
Management command: sync_s3_resumes

Brings S3, ResumeIngestion DB records, and Candidate records into full sync.

Cases handled:
  A. S3 file exists, no ResumeIngestion in DB
     → create ingestion, parse (synchronously), auto-convert to candidate

  B. ResumeIngestion exists, S3 file exists, but not yet converted to candidate
     (statuses: uploaded, queued, processing, parsed, reviewed, duplicate_found, failed)
     → re-parse if needed, then auto-convert

  C. ResumeIngestion exists but S3 file is MISSING
     → if no candidate linked: delete ingestion
     → if candidate already linked: just mark ingestion failed (keep candidate)

  D. ResumeIngestion is already converted and candidate exists → skip (already in sync)

Usage:
  python manage.py sync_s3_resumes
  python manage.py sync_s3_resumes --dry-run      # show what would happen, no writes
  python manage.py sync_s3_resumes --prefix ats/resumes/  # override S3 prefix
"""

import io
import logging
import os
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

logger = logging.getLogger(__name__)


def _get_s3_client():
    storages_cfg = settings.STORAGES.get('default', {}).get('OPTIONS', {})
    return boto3.client(
        's3',
        aws_access_key_id=storages_cfg.get('access_key') or os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=storages_cfg.get('secret_key') or os.environ.get('AWS_SECRET_ACCESS_KEY'),
        region_name=storages_cfg.get('region_name', 'us-west-2'),
    ), storages_cfg.get('bucket_name') or os.environ.get('AWS_S3_BUCKET')


def _list_s3_keys(s3, bucket, prefix):
    """Return set of all object keys under prefix."""
    keys = set()
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            keys.add(obj['Key'])
    return keys


def _download_to_buffer(s3, bucket, key):
    buf = io.BytesIO()
    s3.download_fileobj(bucket, key, buf)
    buf.seek(0)
    return buf


def _parse_synchronously(ingestion, raw_text, llm_output):
    """Persist parsed data and mark ingestion as parsed. No Celery needed."""
    from apps.resumes.models import ResumeParsedData
    with transaction.atomic():
        ResumeParsedData.objects.update_or_create(
            ingestion=ingestion,
            defaults={
                'raw_text': raw_text,
                'llm_output': llm_output,
                'parser_version': 'v1',
            },
        )
        ingestion.status = ingestion.STATUS_PARSED
        ingestion.error_message = ''
        ingestion.save(update_fields=['status', 'error_message', 'updated_at'])


def _auto_convert(ingestion, admin_user, stdout, dry_run):
    """Convert a parsed ingestion to a candidate, handling email conflicts."""
    from apps.candidates.models import Candidate
    from apps.resumes.services.candidate_creator import (
        CandidateCreationError,
        create_candidate_from_ingestion,
    )

    parsed = getattr(ingestion, 'parsed_data', None)
    if parsed is None:
        stdout.write(f'    [SKIP] No parsed_data on ingestion {ingestion.id}')
        return False

    data = parsed.effective_output
    email = (data.get('email') or '').strip().lower()

    # If email already belongs to a candidate, link rather than duplicate
    if email:
        existing = Candidate.objects.filter(email__iexact=email).first()
        if existing:
            stdout.write(
                f'    [LINK] Email {email} already exists -> '
                f'linking ingestion to candidate {existing.id} ({existing.full_name})'
            )
            if not dry_run:
                with transaction.atomic():
                    ingestion.status = ingestion.STATUS_CONVERTED
                    ingestion.converted_candidate = existing
                    ingestion.save(update_fields=['status', 'converted_candidate', 'updated_at'])
            return True

    stdout.write(f'    [CREATE] Converting ingestion {ingestion.id} -> new candidate')
    if not dry_run:
        try:
            create_candidate_from_ingestion(ingestion, admin_user)
            return True
        except CandidateCreationError as exc:
            stdout.write(f'    [ERROR] {exc}')
            return False
    return True


class Command(BaseCommand):
    help = 'Sync S3 resumes with DB ingestion records and candidate profiles'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would happen without making any changes',
        )
        parser.add_argument(
            '--prefix', default='ats/resumes/',
            help='S3 key prefix to scan (default: ats/resumes/)',
        )

    def handle(self, *args, **options):
        from apps.accounts.models import User
        from apps.resumes.models import ResumeIngestion
        from apps.resumes.services.text_extractor import TextExtractionError, extract_text
        from apps.resumes.services.llm_parser import LLMParsingError, parse_resume_with_llm

        dry_run = options['dry_run']
        prefix = options['prefix']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be written\n'))

        # ── Setup ──────────────────────────────────────────────────────────────
        try:
            admin_user = User.objects.filter(role='admin', is_active=True).first()
            if not admin_user:
                self.stderr.write('No active admin user found. Aborting.')
                return
        except Exception as exc:
            self.stderr.write(f'Failed to fetch admin user: {exc}')
            return

        try:
            s3, bucket = _get_s3_client()
            if not bucket:
                self.stderr.write('AWS_S3_BUCKET not configured. Aborting.')
                return
        except Exception as exc:
            self.stderr.write(f'Failed to create S3 client: {exc}')
            return

        self.stdout.write(f'Scanning s3://{bucket}/{prefix} ...')

        # ── Step 1: List S3 keys ───────────────────────────────────────────────
        try:
            s3_keys = _list_s3_keys(s3, bucket, prefix)
        except (BotoCoreError, ClientError) as exc:
            self.stderr.write(f'S3 list failed: {exc}')
            return

        self.stdout.write(f'Found {len(s3_keys)} file(s) in S3\n')

        # ── Step 2: Build DB map {file_field_name → ingestion} ────────────────
        db_ingestions = {
            ing.file.name: ing
            for ing in ResumeIngestion.objects.select_related('parsed_data', 'converted_candidate').all()
        }
        self.stdout.write(f'Found {len(db_ingestions)} ingestion record(s) in DB\n')

        counters = dict(created=0, reparsed=0, converted=0, linked=0, deleted=0, skipped=0, errors=0)

        # ══════════════════════════════════════════════════════════════════════
        # CASE A + B: iterate over S3 keys
        # ══════════════════════════════════════════════════════════════════════
        for key in sorted(s3_keys):
            ingestion = db_ingestions.get(key)
            filename = key.split('/')[-1]

            # ── Already fully synced ──────────────────────────────────────────
            if (
                ingestion
                and ingestion.status == ResumeIngestion.STATUS_CONVERTED
                and ingestion.converted_candidate_id
            ):
                self.stdout.write(f'[OK]   {filename}')
                counters['skipped'] += 1
                continue

            # ── CASE A: No DB record at all ───────────────────────────────────
            if ingestion is None:
                self.stdout.write(f'[A] ORPHAN S3 key (no DB record): {key}')
                ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'pdf'
                if ext not in ('pdf', 'docx'):
                    self.stdout.write(f'    [SKIP] Unsupported extension: {ext}')
                    counters['errors'] += 1
                    continue

                if not dry_run:
                    try:
                        ingestion = ResumeIngestion.objects.create(
                            id=uuid.uuid4(),
                            uploaded_by=admin_user,
                            file=key,
                            original_filename=filename,
                            file_type=ext,
                            file_size=0,
                            status=ResumeIngestion.STATUS_QUEUED,
                        )
                        counters['created'] += 1
                        self.stdout.write(f'    [DB] Created ingestion {ingestion.id}')
                    except Exception as exc:
                        self.stdout.write(f'    [ERROR] Could not create ingestion: {exc}')
                        counters['errors'] += 1
                        continue
                else:
                    self.stdout.write('    [DRY] Would create ingestion + parse + convert')
                    counters['created'] += 1
                    continue

            # ── CASE B or continuation of CASE A: needs parse / convert ───────
            needs_parse = (
                not hasattr(ingestion, 'parsed_data')
                or ingestion.parsed_data is None
                or ingestion.status in (
                    ResumeIngestion.STATUS_UPLOADED,
                    ResumeIngestion.STATUS_QUEUED,
                    ResumeIngestion.STATUS_PROCESSING,
                    ResumeIngestion.STATUS_FAILED,
                )
            )

            if needs_parse:
                self.stdout.write(f'[B] NEEDS PARSE [{ingestion.status}]: {filename}')
                if not dry_run:
                    try:
                        buf = _download_to_buffer(s3, bucket, key)

                        class _FakeDjangoFile:
                            def __init__(self, buf, name):
                                self._buf = buf
                                self.name = name
                            def read(self, *a):
                                return self._buf.read(*a)
                            def seek(self, *a):
                                return self._buf.seek(*a)
                            def tell(self):
                                return self._buf.tell()

                        raw_text = extract_text(_FakeDjangoFile(buf, filename), ingestion.file_type)
                    except (TextExtractionError, Exception) as exc:
                        self.stdout.write(f'    [ERROR] Text extraction: {exc}')
                        counters['errors'] += 1
                        if not dry_run:
                            ingestion.status = ResumeIngestion.STATUS_FAILED
                            ingestion.error_message = str(exc)
                            ingestion.save(update_fields=['status', 'error_message', 'updated_at'])
                        continue

                    if not raw_text or len(raw_text.strip()) < 20:
                        self.stdout.write(f'    [SKIP] Empty text extracted from {filename}')
                        ingestion.status = ResumeIngestion.STATUS_REVIEW_PENDING
                        ingestion.save(update_fields=['status', 'updated_at'])
                        counters['errors'] += 1
                        continue

                    try:
                        llm_output = parse_resume_with_llm(raw_text)
                    except (LLMParsingError, Exception) as exc:
                        self.stdout.write(f'    [ERROR] LLM parse: {exc}')
                        counters['errors'] += 1
                        ingestion.status = ResumeIngestion.STATUS_FAILED
                        ingestion.error_message = str(exc)
                        ingestion.save(update_fields=['status', 'error_message', 'updated_at'])
                        continue

                    _parse_synchronously(ingestion, raw_text, llm_output)
                    ingestion.refresh_from_db()
                    counters['reparsed'] += 1
                    self.stdout.write(f'    [PARSED] {filename}')
                else:
                    self.stdout.write('    [DRY] Would download, extract, parse via LLM')
                    counters['reparsed'] += 1
                    counters['converted'] += 1
                    continue

            # ── Now convert to candidate ──────────────────────────────────────
            self.stdout.write(f'    [CONVERT] {filename}')
            if dry_run:
                self.stdout.write('    [DRY] Would auto-convert to candidate')
                counters['converted'] += 1
            else:
                ok = _auto_convert(ingestion, admin_user, self.stdout, dry_run)
                if ok:
                    counters['converted'] += 1
                else:
                    counters['errors'] += 1

        # ══════════════════════════════════════════════════════════════════════
        # CASE C: DB records whose S3 file no longer exists
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write('\n--- Checking for DB records with missing S3 files ---')
        for db_key, ingestion in db_ingestions.items():
            if db_key in s3_keys:
                continue

            filename = db_key.split('/')[-1]
            candidate = ingestion.converted_candidate

            if candidate:
                self.stdout.write(
                    f'[C] S3 missing but candidate exists — marking failed: {filename} '
                    f'(candidate: {candidate.full_name})'
                )
                if not dry_run:
                    ingestion.status = ResumeIngestion.STATUS_FAILED
                    ingestion.error_message = 'S3 file no longer exists'
                    ingestion.save(update_fields=['status', 'error_message', 'updated_at'])
            else:
                self.stdout.write(f'[C] S3 missing, no candidate — deleting ingestion: {filename}')
                if not dry_run:
                    ingestion.delete()
                counters['deleted'] += 1

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.SUCCESS('SYNC COMPLETE'))
        self.stdout.write(f"  Skipped (already in sync) : {counters['skipped']}")
        self.stdout.write(f"  New ingestions created     : {counters['created']}")
        self.stdout.write(f"  Re-parsed                  : {counters['reparsed']}")
        self.stdout.write(f"  Converted to candidates    : {counters['converted']}")
        self.stdout.write(f"  Deleted (missing S3 file)  : {counters['deleted']}")
        self.stdout.write(f"  Errors / skipped           : {counters['errors']}")
        self.stdout.write('=' * 50)
