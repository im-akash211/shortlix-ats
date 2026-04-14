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


# ── Celery dispatch helper ─────────────────────────────────────────────────────

def _dispatch_task(task, *args):
    """
    Try Celery first; fall back to background thread when broker unavailable.
    This keeps the API response non-blocking in development without Redis.
    """
    try:
        task.delay(*args)
    except Exception as exc:
        logger.warning(
            "Celery broker unavailable (%s). Running task in background thread.", exc
        )
        threading.Thread(target=task.apply, kwargs={"args": args}, daemon=True).start()


# ── Phase 1 views ──────────────────────────────────────────────────────────────

class ResumeUploadView(APIView):
    """POST /api/v1/resume/upload/ — validate, store, queue parsing."""

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ResumeUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data["file"]
        ext  = file.name.rsplit(".", 1)[-1].lower()

        # ── Exact duplicate detection via SHA-256 hash ─────────────────────────
        from .utils.file_hash import generate_file_hash  # noqa: PLC0415
        file_hash = generate_file_hash(file)

        existing = ResumeIngestion.objects.filter(file_hash=file_hash).first()
        if existing:
            return Response(
                {
                    "duplicate": True,
                    "message": "This exact resume file has already been uploaded.",
                    "existing_resume_id": str(existing.id),
                    "existing_status": existing.status,
                    "uploaded_at": existing.created_at,
                },
                status=status.HTTP_409_CONFLICT,
            )

        # ── New file — proceed with normal pipeline ────────────────────────────
        try:
            ingestion = ResumeIngestion.objects.create(
                uploaded_by=request.user,
                file=file,
                original_filename=file.name,
                file_type=ext,
                file_size=file.size,
                file_hash=file_hash,
                status=ResumeIngestion.STATUS_QUEUED,
            )
        except IntegrityError:
            # Race condition: another request saved the same hash between our
            # filter check and this insert — treat it as a duplicate.
            existing = ResumeIngestion.objects.filter(file_hash=file_hash).first()
            return Response(
                {
                    "duplicate": True,
                    "message": "This exact resume file has already been uploaded.",
                    "existing_resume_id": str(existing.id) if existing else None,
                    "existing_status": existing.status if existing else None,
                    "uploaded_at": existing.created_at if existing else None,
                },
                status=status.HTTP_409_CONFLICT,
            )

        from .tasks import process_resume  # noqa: PLC0415
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
    """
    PATCH /api/v1/resume/<uuid>/review/

    Save human-reviewed / edited resume fields into ResumeParsedData.reviewed_output.
    Advances ingestion status to STATUS_REVIEWED.
    Original llm_output is never modified.
    """

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
        return Response(
            ResumeIngestionSerializer(ingestion).data,
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _get_ingestion(pk, user):
        try:
            return ResumeIngestion.objects.select_related("parsed_data").get(
                pk=pk, uploaded_by=user
            )
        except ResumeIngestion.DoesNotExist:
            return None


class ResumeConvertView(APIView):
    """
    POST /api/v1/resume/<uuid>/convert/

    Runs deduplication and, if no duplicate exists, creates a Candidate record.

    Response cases:
      202 — {status: "converted",        candidate: {...}}
      200 — {status: "duplicate_found",  duplicate_candidate: {...}, match_type: "..."}
      400 — validation / missing data errors
    """

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
            ResumeIngestion.STATUS_PARSED,  # allow conversion without explicit review step
        ):
            return Response(
                {"detail": f"Cannot convert from status '{ingestion.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reviewed_data = ingestion.parsed_data.effective_output

        # ── Deduplication check ────────────────────────────────────────────────
        from .services.dedup import find_duplicate  # noqa: PLC0415
        duplicate, match_type = find_duplicate(reviewed_data)

        if duplicate:
            with transaction.atomic():
                ingestion.status = ResumeIngestion.STATUS_DUPLICATE_FOUND
                ingestion.duplicate_candidate = duplicate
                ingestion.save(update_fields=["status", "duplicate_candidate", "updated_at"])

            return Response(
                {
                    "status": "duplicate_found",
                    "match_type": match_type,
                    "duplicate_candidate": CandidateSnapshotSerializer(duplicate).data,
                },
                status=status.HTTP_200_OK,
            )

        # ── No duplicate — create candidate ───────────────────────────────────
        from .services.candidate_creator import (  # noqa: PLC0415
            CandidateCreationError,
            create_candidate_from_ingestion,
        )

        try:
            candidate = create_candidate_from_ingestion(ingestion, request.user)
        except CandidateCreationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        from apps.candidates.serializers import CandidateListSerializer  # noqa: PLC0415

        return Response(
            {
                "status": "converted",
                "candidate": CandidateListSerializer(candidate).data,
            },
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
    """
    POST /api/v1/resume/<uuid>/resolve-duplicate/

    Body: { "decision": "merge" | "force_create" | "discard" }

    merge       — link ingestion to existing candidate (no new row created)
    force_create — create new candidate even though a fuzzy duplicate exists
                   (blocked when duplicate was found by exact email match)
    discard     — mark ingestion as discarded; no candidate created
    """

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

        # ── discard ────────────────────────────────────────────────────────────
        if decision == "discard":
            ingestion.status = ResumeIngestion.STATUS_DISCARDED
            ingestion.merge_decision = "discard"
            ingestion.save(update_fields=["status", "merge_decision", "updated_at"])
            return Response({"status": "discarded"}, status=status.HTTP_200_OK)

        # ── merge — link to existing candidate ────────────────────────────────
        if decision == "merge":
            with transaction.atomic():
                ingestion.status = ResumeIngestion.STATUS_CONVERTED
                ingestion.converted_candidate = ingestion.duplicate_candidate
                ingestion.merge_decision = "merge"
                ingestion.save(
                    update_fields=["status", "converted_candidate", "merge_decision", "updated_at"]
                )

            from apps.candidates.serializers import CandidateListSerializer  # noqa: PLC0415
            return Response(
                {
                    "status": "merged",
                    "candidate": CandidateListSerializer(ingestion.converted_candidate).data,
                },
                status=status.HTTP_200_OK,
            )

        # ── force_create — only allowed for fuzzy (non-email) duplicates ───────
        if decision == "force_create":
            # Re-check: if the duplicate was found by exact email, force_create is unsafe
            dup = ingestion.duplicate_candidate
            reviewed_data = ingestion.parsed_data.effective_output
            email = (reviewed_data.get('email') or '').strip().lower()

            if dup and dup.email.lower() == email:
                return Response(
                    {
                        "detail": (
                            "Cannot force-create: a candidate with this exact email already exists. "
                            "Please choose 'merge' or 'discard'."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from .services.candidate_creator import (  # noqa: PLC0415
                CandidateCreationError,
                create_candidate_from_ingestion,
            )
            ingestion.merge_decision = "force_create"
            ingestion.save(update_fields=["merge_decision", "updated_at"])

            try:
                candidate = create_candidate_from_ingestion(ingestion, request.user)
            except CandidateCreationError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            from apps.candidates.serializers import CandidateListSerializer  # noqa: PLC0415
            return Response(
                {
                    "status": "converted",
                    "candidate": CandidateListSerializer(candidate).data,
                },
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
