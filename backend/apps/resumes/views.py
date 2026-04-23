import logging
import threading

from django.db import IntegrityError, transaction
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ResumeIngestion
from .serializers import (
    CandidateSnapshotSerializer,
    DuplicateResolutionSerializer,
    ResumeIngestionSerializer,
    ResumeReviewSerializer,
    ResumeUploadSerializer,
)

logger = logging.getLogger(__name__)


def _dispatch_task(task, *args):
    """
    Try Celery first; fall back to background thread when broker unavailable.
    """
    try:
        task.delay(*args)
    except Exception as exc:
        logger.warning(
            "Celery broker unavailable (%s). Running task in background thread.", exc
        )
        threading.Thread(target=task.apply, kwargs={"args": args}, daemon=True).start()


def _commit_temp_to_s3(ingestion):
    """Copy temp_file from ats/temp_resumes/ to ats/resumes/ as ingestion.file."""
    if not ingestion.temp_file or ingestion.file:
        return
    try:
        import os
        import boto3
        from django.conf import settings as _s

        opts = _s.STORAGES.get('default', {}).get('OPTIONS', {})
        bucket = opts.get('bucket_name') or os.environ.get('AWS_S3_BUCKET', '')
        s3 = boto3.client(
            's3',
            aws_access_key_id=opts.get('access_key') or os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=opts.get('secret_key') or os.environ.get('AWS_SECRET_ACCESS_KEY'),
            region_name=opts.get('region_name', 'us-west-2'),
        )
        src_key = ingestion.temp_file.name
        dst_key = f"ats/resumes/{os.path.basename(src_key)}"
        s3.copy_object(Bucket=bucket, CopySource={'Bucket': bucket, 'Key': src_key}, Key=dst_key)
        s3.delete_object(Bucket=bucket, Key=src_key)

        ingestion.file = dst_key
        ingestion.temp_file = ''
        ingestion.save(update_fields=['file', 'temp_file', 'updated_at'])
    except Exception as exc:
        logger.warning("Failed to commit temp file to S3 for ingestion %s: %s", ingestion.id, exc)


def _delete_temp_file(ingestion):
    """Delete temp_file from S3 if it exists."""
    if not ingestion.temp_file:
        return
    try:
        ingestion.temp_file.delete(save=False)
        ingestion.temp_file = ''
        ingestion.save(update_fields=['temp_file', 'updated_at'])
    except Exception as exc:
        logger.warning("Failed to delete temp file for ingestion %s: %s", ingestion.id, exc)


# ── Phase 1 views ──────────────────────────────────────────────────────────────

class ResumeUploadView(APIView):
    """POST /api/v1/resume/upload/ — validate, store in temp S3, queue parsing."""

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ResumeUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data["file"]
        ext  = file.name.rsplit(".", 1)[-1].lower()

        # ── SHA-256 duplicate detection ────────────────────────────────────────
        from .utils.file_hash import generate_file_hash
        file_hash = generate_file_hash(file)

        existing = ResumeIngestion.objects.filter(file_hash=file_hash).first()
        if existing:
            if existing.status == ResumeIngestion.STATUS_CONVERTED and existing.converted_candidate:
                # Already fully saved — return duplicate candidate info
                return Response(
                    {
                        "status": "already_converted",
                        "message": "This resume has already been added to the talent pool.",
                        "candidate": CandidateSnapshotSerializer(existing.converted_candidate).data,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            else:
                # Still in temp/processing — resume the existing flow
                existing_data = ResumeIngestionSerializer(
                    ResumeIngestion.objects.select_related('parsed_data').get(pk=existing.pk)
                ).data
                return Response(
                    {
                        "status": "resume_existing",
                        "message": "This resume was already uploaded and is being processed.",
                        "ingestion": existing_data,
                    },
                    status=status.HTTP_200_OK,
                )

        # ── New upload — save to temp S3 prefix ───────────────────────────────
        try:
            ingestion = ResumeIngestion.objects.create(
                uploaded_by=request.user,
                temp_file=file,
                original_filename=file.name,
                file_type=ext,
                file_size=file.size,
                file_hash=file_hash,
                status=ResumeIngestion.STATUS_QUEUED,
            )
        except IntegrityError:
            existing = ResumeIngestion.objects.filter(file_hash=file_hash).first()
            if existing:
                return Response(
                    {"status": "resume_existing", "ingestion": ResumeIngestionSerializer(existing).data},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"detail": "Upload failed. Please try again."},
                status=status.HTTP_409_CONFLICT,
            )

        from .tasks import process_resume
        _dispatch_task(process_resume, str(ingestion.id))
        logger.info("Resume ingestion %s queued by user %s", ingestion.id, request.user.id)

        return Response(
            ResumeIngestionSerializer(ingestion).data,
            status=status.HTTP_202_ACCEPTED,
        )


class ResumeIngestionStatusView(generics.RetrieveAPIView):
    """GET /api/v1/resume/<uuid>/status/ — poll processing status."""

    serializer_class = ResumeIngestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ResumeIngestion.objects.select_related("parsed_data").filter(
            uploaded_by=self.request.user
        )


class ResumeIngestionListView(generics.ListAPIView):
    """GET /api/v1/resume/ — list all ingestions for the authenticated user."""

    serializer_class = ResumeIngestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ResumeIngestion.objects.select_related("parsed_data").filter(
            uploaded_by=self.request.user
        )


# ── Phase 2 views ──────────────────────────────────────────────────────────────

class ResumeReviewView(APIView):
    """PATCH /api/v1/resume/<uuid>/review/"""

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ingestion = self._get_ingestion(pk, request.user)
        if ingestion is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not hasattr(ingestion, 'parsed_data') or ingestion.parsed_data is None:
            return Response(
                {"detail": "Resume has not been parsed yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ResumeReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save_review(ingestion, request.user)
        return Response(ResumeIngestionSerializer(ingestion).data, status=status.HTTP_200_OK)

    @staticmethod
    def _get_ingestion(pk, user):
        try:
            return ResumeIngestion.objects.select_related("parsed_data").get(
                pk=pk, uploaded_by=user
            )
        except ResumeIngestion.DoesNotExist:
            return None


class ResumeDiscardView(APIView):
    """
    DELETE /api/v1/resume/<uuid>/discard/

    Called when user closes the review modal without saving.
    Deletes temp_file from S3 and removes the ingestion record.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            ingestion = ResumeIngestion.objects.get(pk=pk, uploaded_by=request.user)
        except ResumeIngestion.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if ingestion.status == ResumeIngestion.STATUS_CONVERTED:
            return Response(
                {"detail": "Cannot discard a converted ingestion."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _delete_temp_file(ingestion)
        ingestion.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResumeConvertView(APIView):
    """POST /api/v1/resume/<uuid>/convert/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ingestion = self._get_ingestion(pk, request.user)
        if ingestion is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not hasattr(ingestion, 'parsed_data') or ingestion.parsed_data is None:
            return Response(
                {"detail": "Resume must be parsed before converting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ingestion.status not in (
            ResumeIngestion.STATUS_REVIEWED,
            ResumeIngestion.STATUS_PARSED,
        ):
            return Response(
                {"detail": f"Cannot convert from status '{ingestion.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reviewed_data = ingestion.parsed_data.effective_output

        # ── Deduplication check ────────────────────────────────────────────────
        from .services.dedup import find_duplicates
        matches = find_duplicates(reviewed_data)

        if matches:
            primary = matches[0]['candidate']
            with transaction.atomic():
                ingestion.status = ResumeIngestion.STATUS_DUPLICATE_FOUND
                ingestion.duplicate_candidate = primary
                ingestion.save(update_fields=["status", "duplicate_candidate", "updated_at"])

            duplicate_candidates = [
                {
                    **CandidateSnapshotSerializer(m['candidate']).data,
                    'match_type': m['match_type'],
                    'confidence': m['confidence'],
                }
                for m in matches
            ]
            return Response(
                {
                    "status": "duplicate_found",
                    "match_type": matches[0]['match_type'],
                    "duplicate_candidates": duplicate_candidates,
                },
                status=status.HTTP_200_OK,
            )

        # ── No duplicate — commit temp file to S3 then create candidate ────────
        _commit_temp_to_s3(ingestion)

        from .services.candidate_creator import CandidateCreationError, create_candidate_from_ingestion
        try:
            candidate = create_candidate_from_ingestion(ingestion, request.user)
        except CandidateCreationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        from apps.candidates.serializers import CandidateListSerializer
        return Response(
            {"status": "converted", "candidate": CandidateListSerializer(candidate).data},
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _get_ingestion(pk, user):
        try:
            return ResumeIngestion.objects.select_related("parsed_data").get(
                pk=pk, uploaded_by=user
            )
        except ResumeIngestion.DoesNotExist:
            return None


class ResumeDuplicateResolveView(APIView):
    """POST /api/v1/resume/<uuid>/resolve-duplicate/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ingestion = self._get_ingestion(pk, request.user)
        if ingestion is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if ingestion.status != ResumeIngestion.STATUS_DUPLICATE_FOUND:
            return Response(
                {"detail": "No pending duplicate resolution for this ingestion."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DuplicateResolutionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        decision = serializer.validated_data["decision"]

        if decision == "discard":
            _delete_temp_file(ingestion)
            ingestion.status = ResumeIngestion.STATUS_DISCARDED
            ingestion.merge_decision = "discard"
            ingestion.save(update_fields=["status", "merge_decision", "updated_at"])
            return Response({"status": "discarded"}, status=status.HTTP_200_OK)

        if decision == "merge":
            _commit_temp_to_s3(ingestion)
            with transaction.atomic():
                ingestion.status = ResumeIngestion.STATUS_CONVERTED
                ingestion.converted_candidate = ingestion.duplicate_candidate
                ingestion.merge_decision = "merge"
                ingestion.save(
                    update_fields=["status", "converted_candidate", "merge_decision", "updated_at"]
                )
            from apps.candidates.serializers import CandidateListSerializer
            return Response(
                {
                    "status": "merged",
                    "candidate": CandidateListSerializer(ingestion.converted_candidate).data,
                },
                status=status.HTTP_200_OK,
            )

        if decision == "force_create":
            dup = ingestion.duplicate_candidate
            reviewed_data = ingestion.parsed_data.effective_output
            email = (reviewed_data.get('email') or '').strip().lower()

            if dup and dup.email.lower() == email:
                return Response(
                    {"detail": "Cannot force-create: a candidate with this exact email already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ingestion.merge_decision = "force_create"
            ingestion.save(update_fields=["merge_decision", "updated_at"])
            _commit_temp_to_s3(ingestion)

            from .services.candidate_creator import CandidateCreationError, create_candidate_from_ingestion
            try:
                candidate = create_candidate_from_ingestion(ingestion, request.user)
            except CandidateCreationError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            from apps.candidates.serializers import CandidateListSerializer
            return Response(
                {"status": "converted", "candidate": CandidateListSerializer(candidate).data},
                status=status.HTTP_201_CREATED,
            )

    @staticmethod
    def _get_ingestion(pk, user):
        try:
            return ResumeIngestion.objects.select_related(
                "parsed_data", "duplicate_candidate"
            ).get(pk=pk, uploaded_by=user)
        except ResumeIngestion.DoesNotExist:
            return None
