import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import ResumeFile

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=ResumeFile)
def delete_resume_file_from_s3(sender, instance, **kwargs):
    """Delete the S3 object when a ResumeFile record is deleted (including CASCADE)."""
    if instance.file:
        try:
            instance.file.delete(save=False)
        except Exception as exc:
            logger.warning(
                "Could not delete S3 file %s for ResumeFile %s: %s",
                instance.file.name, instance.id, exc,
            )
