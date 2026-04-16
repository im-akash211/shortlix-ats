"""
Management command: python manage.py seed_dev
Creates a full set of dev/demo data that matches the hardcoded arrays in the frontend pages.
Safe to run multiple times — existing data is cleared first.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import random


class Command(BaseCommand):
    help = 'Seed development database with demo data'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data...')
        self._clear()
        self.stdout.write('Seeding...')
        with transaction.atomic():
            self._seed()
        self.stdout.write(self.style.SUCCESS('Done! Login: admin@ats.com / admin123'))

    # ------------------------------------------------------------------ #
    def _clear(self):
        from apps.interviews.models import CompetencyRating, InterviewFeedback, Interview, FeedbackTemplate
        from apps.candidates.models import PipelineStageLog, CandidateNote, CandidateJobMapping, Candidate
        from apps.jobs.models import JobCollaborator, Job
        from apps.requisitions.models import RequisitionApproval, Requisition
        from apps.departments.models import SubVertical, Department
        from apps.accounts.models import User

        CompetencyRating.objects.all().delete()
        InterviewFeedback.objects.all().delete()
        Interview.objects.all().delete()
        FeedbackTemplate.objects.all().delete()
        PipelineStageLog.objects.all().delete()
        CandidateNote.objects.all().delete()
        CandidateJobMapping.objects.all().delete()
        Candidate.objects.all().delete()
        JobCollaborator.objects.all().delete()
        Job.objects.all().delete()
        RequisitionApproval.objects.all().delete()
        Requisition.objects.all().delete()
        SubVertical.objects.all().delete()
        Department.objects.all().delete()
        User.objects.all().delete()

    # ------------------------------------------------------------------ #
    def _seed(self):
        from apps.accounts.models import User
        from apps.departments.models import Department, SubVertical
        from apps.requisitions.models import Requisition, RequisitionApproval
        from apps.jobs.models import Job, JobCollaborator
        from apps.candidates.models import Candidate, CandidateJobMapping, PipelineStageLog, CandidateNote
        from apps.interviews.models import Interview, InterviewFeedback, CompetencyRating, FeedbackTemplate

        now = timezone.now()

        # ---- Users ---- #
        admin = User.objects.create_superuser(
            email='admin@ats.com', password='admin123', full_name='Admin User', role='admin'
        )

        # Departments first (needed for HMs)
        dept_backend = Department.objects.create(name='Backend Engineering')
        dept_fullstack = Department.objects.create(name='Full Stack')
        dept_analytics = Department.objects.create(name='Analytics')
        dept_data = Department.objects.create(name='Data Science')

        SubVertical.objects.create(department=dept_backend, name='Platform')
        SubVertical.objects.create(department=dept_backend, name='Infrastructure')
        SubVertical.objects.create(department=dept_fullstack, name='Web')
        SubVertical.objects.create(department=dept_fullstack, name='Mobile')
        SubVertical.objects.create(department=dept_analytics, name='BI & Reporting')
        SubVertical.objects.create(department=dept_analytics, name='Product Analytics')
        SubVertical.objects.create(department=dept_data, name='ML Engineering')

        hm1 = User.objects.create_user(
            email='gaurav.gupta@ats.com', password='pass1234', full_name='Gaurav Gupta',
            role='hiring_manager', department=dept_backend
        )
        hm2 = User.objects.create_user(
            email='rupinder.monga@ats.com', password='pass1234', full_name='Rupinder Monga',
            role='hiring_manager', department=dept_analytics
        )

        rec1 = User.objects.create_user(
            email='mrinali@ats.com', password='pass1234', full_name='Mrinali Sharma',
            role='recruiter', department=dept_backend
        )
        rec2 = User.objects.create_user(
            email='trisha@ats.com', password='pass1234', full_name='Trisha Karmakar',
            role='recruiter', department=dept_analytics
        )
        rec3 = User.objects.create_user(
            email='swati@ats.com', password='pass1234', full_name='Swati Aggarwal',
            role='recruiter', department=dept_fullstack
        )

        # ---- Requisitions ---- #
        _counters = {'internal': 0, 'client': 0}

        def _gen_purpose_code(purpose):
            prefix = 'SHT-INT' if purpose == 'internal' else 'SHT-CLT'
            code = f'{prefix}-{_counters[purpose]}'
            _counters[purpose] += 1
            return code

        def make_req(title, dept, hm, loc, status, days_ago=10, **kwargs):
            purpose = random.choice(['internal', 'client'])
            req = Requisition.objects.create(
                title=title, department=dept, hiring_manager=hm, l1_approver=admin,
                created_by=rec1, location=loc, status=status,
                priority=kwargs.get('priority', 'medium'),
                employment_type='permanent', requisition_type='new',
                purpose=purpose,
                purpose_code=_gen_purpose_code(purpose),
                positions_count=kwargs.get('positions_count', 1),
                experience_min=kwargs.get('exp_min', 2),
                experience_max=kwargs.get('exp_max', 5),
                job_description=f'We are hiring a {title}.',
                skills_required=kwargs.get('skills', []),
            )
            # approval log
            if status in ('pending_approval', 'approved', 'rejected'):
                RequisitionApproval.objects.create(
                    requisition=req, action='submitted', acted_by=rec1, comments='Please review.'
                )
            if status == 'approved':
                RequisitionApproval.objects.create(
                    requisition=req, action='approved', acted_by=admin, comments='Looks good!'
                )
            elif status == 'rejected':
                RequisitionApproval.objects.create(
                    requisition=req, action='rejected', acted_by=admin, comments='On hold.'
                )
            return req

        req1 = make_req('BI Analyst', dept_analytics, hm2, 'Gurugram, Haryana, India', 'approved',
                        skills=['SQL', 'Power BI', 'Tableau'], exp_min=3, exp_max=7)
        req2 = make_req('Hubspot Specialist', dept_backend, hm1, 'Gurgaon, Haryana, India', 'approved',
                        skills=['HubSpot', 'CRM', 'Marketing Automation'])
        req3 = make_req('CRM Business Analyst', dept_backend, hm1, 'Gurgaon, Haryana, India', 'approved',
                        skills=['CRM', 'Business Analysis', 'SQL'], exp_min=2, exp_max=6)
        req4 = make_req('Data Analyst', dept_analytics, hm2, 'Noida, Uttar Pradesh, India', 'approved',
                        skills=['Python', 'SQL', 'Pandas'], exp_min=1, exp_max=4)
        req5 = make_req('Delivery Manager', dept_fullstack, hm1, 'Noida, Uttar Pradesh, India', 'approved',
                        skills=['Project Management', 'Agile', 'Scrum'], exp_min=5, exp_max=10)
        req6 = make_req('Prompt Engineer', dept_data, hm2, 'Gurgaon, Haryana, India', 'pending_approval',
                        skills=['LLMs', 'Python', 'NLP'])
        make_req('Product Analytics Lead', dept_analytics, hm2, 'Gurgaon, Haryana, India', 'draft',
                 skills=['Analytics', 'SQL', 'Product Management'], exp_min=4, exp_max=8)

        # ---- Jobs (manually created for 5 approved reqs to control job_codes) ---- #
        def make_job(req, code, rec=None):
            return Job.objects.create(
                requisition=req, job_code=code, title=req.title,
                department=req.department, hiring_manager=req.hiring_manager,
                location=req.location, skills_required=req.skills_required,
                job_description=req.job_description,
                experience_min=req.experience_min, experience_max=req.experience_max,
                status='open',
            )

        job1 = make_job(req1, 'JOB-2026-0001')
        job2 = make_job(req2, 'JOB-2026-0002')
        job3 = make_job(req3, 'JOB-2026-0003')
        job4 = make_job(req4, 'JOB-2026-0004')
        job5 = make_job(req5, 'JOB-2026-0005')

        # Collaborators
        JobCollaborator.objects.create(job=job1, user=rec2, added_by=admin)
        JobCollaborator.objects.create(job=job3, user=rec1, added_by=admin)
        JobCollaborator.objects.create(job=job4, user=rec3, added_by=admin)

        # ---- Candidates ---- #
        candidates_data = [
            ('Shubham Jaiswal', 'sjai1702@gmail.com', '9621137855', 'Noida', 3.5, 'Research Analyst', 'NextZen Minds', 'recruiter_upload'),
            ('Brijendra Singh', 'brijendra.singh@example.com', '+91-9650719860', 'South Delhi', 7.0, 'Security Lead', 'Infosys', 'recruiter_upload'),
            ('Neha Surbhi', 'surabhi.neha1@example.com', '+91-7091976436', 'Gurgaon', 6.5, 'CRM Analyst', 'TechCorp', 'recruiter_upload'),
            ('Shrey Mahajan', 'shreymahajan9@example.com', '8587911191', 'Gurgaon', 3.4, 'Business Analyst', 'Wipro', 'naukri'),
            ('Visharad Singh', 'visharadsingh@example.com', '+91-7073571941', 'New Delhi', 0.6, 'Research Executive', 'Startup Inc', 'recruiter_upload'),
            ('Paras Arora', 'parastakkar88@example.com', '8875616691', 'Gurugram', 4.0, 'Data Engineer', 'Amazon', 'linkedin'),
            ('Shivam Garg', 'shivamgarg014@example.com', '8950627527', 'Gurugram', 4.0, 'Data Engineer', 'Microsoft', 'naukri'),
            ('Manmeet Singh', 'ianmanmeet25@example.com', '+91-858807000', 'Delhi', 4.0, 'Security Engineer', 'Deloitte', 'linkedin'),
            ('Aaryan Sharma', 'aaryan.sharma@example.com', '9988776655', 'Mumbai', 5.0, 'BI Developer', 'Oracle', 'referral'),
            ('Priya Patel', 'priya.patel@example.com', '9876543210', 'Bangalore', 3.0, 'SQL Analyst', 'TCS', 'naukri'),
            ('Rahul Mehta', 'rahul.mehta@example.com', '9765432109', 'Pune', 6.0, 'Delivery Manager', 'Capgemini', 'linkedin'),
            ('Anjali Gupta', 'anjali.gupta@example.com', '9654321098', 'Hyderabad', 2.5, 'HubSpot Admin', 'HCL', 'recruiter_upload'),
            ('Kiran Kumar', 'kiran.kumar@example.com', '9543210987', 'Chennai', 8.0, 'Product Manager', 'IBM', 'referral'),
            ('Sneha Verma', 'sneha.verma@example.com', '9432109876', 'Noida', 1.5, 'Junior Analyst', 'Accenture', 'naukri'),
            ('Amit Bose', 'amit.bose@example.com', '9321098765', 'Kolkata', 4.5, 'Data Scientist', 'Cognizant', 'linkedin'),
            ('Deepika Rao', 'deepika.rao@example.com', '9210987654', 'Bangalore', 3.5, 'CRM Manager', 'Zoho', 'recruiter_upload'),
            ('Vivek Nair', 'vivek.nair@example.com', '9109876543', 'Kochi', 5.5, 'BI Analyst', 'Mphasis', 'naukri'),
            ('Ritu Singh', 'ritu.singh@example.com', '9098765432', 'Lucknow', 2.0, 'Business Analyst', 'Tech Mahindra', 'referral'),
            ('Akash Sharma', 'akash.sharma@example.com', '8987654321', 'Jaipur', 7.5, 'Senior Developer', 'NIIT', 'linkedin'),
            ('Meera Iyer', 'meera.iyer@example.com', '8876543210', 'Coimbatore', 1.0, 'Fresher Analyst', 'Freshworks', 'naukri'),
        ]

        skills_map = {
            'recruiter_upload': ['Python', 'SQL', 'Excel'],
            'naukri': ['Java', 'SQL', 'Hibernate'],
            'linkedin': ['Python', 'Pandas', 'Tableau'],
            'referral': ['Power BI', 'SQL', 'DAX'],
        }

        candidates = []
        for (name, email, phone, location, exp, designation, employer, source) in candidates_data:
            c = Candidate.objects.create(
                full_name=name, email=email, phone=phone, location=location,
                total_experience_years=exp, designation=designation,
                current_employer=employer, source=source,
                skills=skills_map.get(source, ['Python']),
                created_by=rec1,
            )
            candidates.append(c)

        # ---- Pipeline mappings ---- #
        stage_cycle = [
            'pending', 'shortlisted', 'interview', 'interview', 'on_hold',
            'selected', 'offered', 'joined', 'rejected', 'pending',
            'shortlisted', 'interview', 'on_hold', 'pending', 'shortlisted',
            'interview', 'rejected', 'pending', 'shortlisted', 'interview',
        ]
        job_cycle = [job1, job1, job2, job3, job3, job4, job4, job5, job5, job1,
                     job2, job2, job3, job4, job5, job1, job2, job3, job4, job5]

        mappings = []
        for i, candidate in enumerate(candidates):
            job = job_cycle[i]
            stage = stage_cycle[i]
            m = CandidateJobMapping.objects.create(
                candidate=candidate, job=job, stage=stage, moved_by=rec1
            )
            PipelineStageLog.objects.create(
                mapping=m, from_stage='', to_stage=stage, changed_by=rec1, notes='Initial assignment'
            )
            mappings.append(m)

        # ---- Feedback template ---- #
        template = FeedbackTemplate.objects.create(
            name='Standard Technical Interview',
            is_default=True,
            created_by=admin,
            competencies=[
                {'name': 'Problem Solving', 'max_rating': 5},
                {'name': 'Communication', 'max_rating': 5},
                {'name': 'Technical Skills', 'max_rating': 5},
                {'name': 'Culture Fit', 'max_rating': 5},
            ]
        )

        # ---- Interviews ---- #
        # 8 scheduled, 2 completed with feedback
        interview_mappings = [m for m in mappings if m.stage in ('interview', 'shortlisted')][:10]

        for idx, mapping in enumerate(interview_mappings):
            scheduled_at = now + timedelta(days=idx - 2)  # some past, some future
            status = 'completed' if idx < 2 else 'scheduled'
            if status == 'completed':
                scheduled_at = now - timedelta(days=3 - idx)

            interview = Interview.objects.create(
                mapping=mapping,
                round_number=1,
                round_label='Evaluation Round 1 - Tech',
                interviewer=hm1 if idx % 2 == 0 else hm2,
                scheduled_at=scheduled_at,
                duration_minutes=60,
                mode='virtual',
                meeting_link='https://meet.google.com/abc-defg-hij',
                feedback_template=template,
                status=status,
                created_by=rec1,
            )

            if status == 'completed':
                feedback = InterviewFeedback.objects.create(
                    interview=interview,
                    interviewer=hm1 if idx % 2 == 0 else hm2,
                    overall_rating=random.randint(3, 5),
                    recommendation='proceed',
                    strengths='Strong technical background.',
                    weaknesses='Could improve communication.',
                    comments='Good candidate overall.',
                )
                for comp in template.competencies:
                    CompetencyRating.objects.create(
                        feedback=feedback,
                        competency_name=comp['name'],
                        rating=random.randint(3, 5),
                        notes='Satisfactory',
                    )

        # ---- Notes ---- #
        CandidateNote.objects.create(
            candidate=candidates[0], user=rec1,
            content='Strong Python background, follow up next week.'
        )
        CandidateNote.objects.create(
            candidate=candidates[1], user=rec2,
            content='Requested 60 day notice period — check with HM.'
        )

        self.stdout.write(f'  ✓ {len(candidates)} candidates')
        self.stdout.write(f'  ✓ 7 requisitions')
        self.stdout.write(f'  ✓ 5 jobs')
        self.stdout.write(f'  ✓ {len(interview_mappings)} interviews')
