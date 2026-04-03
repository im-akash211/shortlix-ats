import logging
import threading

from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ResumeIngestion
from .serializers import ResumeIngestionSerializer, ResumeUploadSerializer

logger = logging.getLogger(__name__)


def _dispatch_task(task, *args):
    """
    Try to send the task to a Celery broker.
    If the broker is unavailable (common in development without Redis),
    fall back to running the task in a background daemon thread so the
    HTTP response is never blocked.
    """
    try:
        task.delay(*args)
    except Exception as exc:
        logger.warning(
            "Celery broker unavailable (%s). Running task in background thread.", exc
        )
        thread = threading.Thread(
            target=task.apply,
            kwargs={"args": args},
            daemon=True,
        )
        thread.start()


class ResumeUploadView(APIView):
    """
    POST /api/v1/resume/upload/

    Accepts a multipart/form-data file upload.
    Validates the file, saves it to local disk, queues a Celery task for
    text extraction + LLM parsing, and returns 202 Accepted with the
    ingestion record.
    """

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ResumeUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data["file"]
        ext = file.name.rsplit(".", 1)[-1].lower()

        ingestion = ResumeIngestion.objects.create(
            uploaded_by=request.user,
            file=file,
            original_filename=file.name,
            file_type=ext,
            file_size=file.size,
            status=ResumeIngestion.STATUS_QUEUED,
        )

        # Dispatch async parsing task
        from .tasks import process_resume  # noqa: PLC0415
        _dispatch_task(process_resume, str(ingestion.id))
        logger.info(
            "Resume ingestion %s queued by user %s", ingestion.id, request.user.id
        )

        return Response(
            ResumeIngestionSerializer(ingestion).data,
            status=status.HTTP_202_ACCEPTED,
        )


class ResumeIngestionStatusView(generics.RetrieveAPIView):
    """
    GET /api/v1/resume/<uuid:pk>/status/

    Returns the current processing status and parsed data (if available)
    for a single ingestion record owned by the requesting user.
    """

    serializer_class = ResumeIngestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ResumeIngestion.objects.select_related("parsed_data").filter(
            uploaded_by=self.request.user
        )


class ResumeIngestionListView(generics.ListAPIView):
    """
    GET /api/v1/resume/

    Lists all resume ingestion records for the authenticated user,
    newest first.
    """

    serializer_class = ResumeIngestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ResumeIngestion.objects.select_related("parsed_data").filter(
            uploaded_by=self.request.user
        )
