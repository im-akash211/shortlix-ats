from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import RequisitionApproval


@receiver(post_save, sender=RequisitionApproval)
def auto_create_job(sender, instance, created, **kwargs):
    if not created or instance.action != 'approved':
        return
    from apps.jobs.models import Job

    req = instance.requisition
    if hasattr(req, 'job'):
        return  # Job already exists

    prefix = 'SHT-INT' if req.purpose == 'internal' else 'SHT-CLT'
    with transaction.atomic():
        existing_codes = set(
            Job.objects.filter(job_code__startswith=prefix)
            .values_list('job_code', flat=True)
        )
        count = 1
        while f'{prefix}-{count:03d}' in existing_codes:
            count += 1
        job_code = f'{prefix}-{count:03d}'

        Job.objects.create(
            requisition=req,
            job_code=job_code,
            # Core identity
            title=req.title,
            department=req.department,
            hiring_manager=req.hiring_manager,
            created_by=req.created_by,
            # Sub-verticals
            sub_vertical_1=req.sub_vertical_1,
            sub_vertical_2=req.sub_vertical_2,
            # Role details
            location=req.location,
            designation=req.designation,
            priority=req.priority,
            employment_type=req.employment_type,
            requisition_type=req.requisition_type,
            work_mode=req.work_mode,
            # Headcount & experience
            positions_count=req.positions_count,
            experience_min=req.experience_min,
            experience_max=req.experience_max,
            # Skills & qualifications
            skills_required=req.skills_required,
            skills_desirable=req.skills_desirable,
            min_qualification=req.min_qualification,
            # JD
            job_description=req.job_description,
            # Project / client context
            project_name=req.project_name,
            client_name=req.client_name,
            # Planning
            expected_start_date=req.expected_start_date,
            tat_days=req.tat_days,
            budget_min=req.budget_min,
            budget_max=req.budget_max,
            # Candidate signals — Educational
            iit_grad=req.iit_grad,
            nit_grad=req.nit_grad,
            iim_grad=req.iim_grad,
            top_institute=req.top_institute,
            # Candidate signals — Company
            unicorn_exp=req.unicorn_exp,
            top_internet_product=req.top_internet_product,
            top_software_product=req.top_software_product,
            top_it_services_mnc=req.top_it_services_mnc,
            top_consulting_mnc=req.top_consulting_mnc,
            status='open',
        )
