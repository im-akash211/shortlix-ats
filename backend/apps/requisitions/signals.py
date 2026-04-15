from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import RequisitionApproval


@receiver(post_save, sender=RequisitionApproval)
def auto_create_job(sender, instance, created, **kwargs):
    if not created or instance.action != 'approved':
        return
    from apps.jobs.models import Job
    from django.utils import timezone

    req = instance.requisition
    if hasattr(req, 'job'):
        return  # Job already exists

    year = timezone.now().year
    with transaction.atomic():
        existing_codes = set(
            Job.objects.filter(job_code__startswith=f'JOB-{year}-')
            .values_list('job_code', flat=True)
        )
        count = 1
        while f'JOB-{year}-{count:04d}' in existing_codes:
            count += 1
        job_code = f'JOB-{year}-{count:04d}'
        Job.objects.create(
            requisition=req,
            job_code=job_code,
            title=req.title,
            department=req.department,
            hiring_manager=req.hiring_manager,
            location=req.location,
            skills_required=req.skills_required,
            job_description=req.job_description,
            experience_min=req.experience_min,
            experience_max=req.experience_max,
            status='open',
        )
