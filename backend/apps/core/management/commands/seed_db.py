"""
Management command to seed the database with initial users and dummy data.
Usage: python manage.py seed_db
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta, date
import random


class Command(BaseCommand):
    help = "Seeds the database with initial users, departments, sub verticals, requisitions, jobs, and candidates"

    def handle(self, *args, **options):
        self.stdout.write("Clearing existing data...")
        self._clear_data()

        self.stdout.write("Seeding database...")
        with transaction.atomic():
            departments = self._create_departments()
            self._create_sub_verticals(departments)
            users = self._create_users(departments)
            requisitions = self._create_requisitions(users, departments)
            jobs = self._create_jobs(requisitions, users, departments)
            self._create_candidates(jobs, users)

        self.stdout.write(self.style.SUCCESS("\nDatabase seeded successfully!"))
        self.stdout.write(self.style.SUCCESS("Login: admin@ats.com / Admin@123"))

    # ---------------------------------------------------------
    def _clear_data(self):
        from django.db import connection

        tables = [
            "candidates_candidatejobmapping",
            "candidates_candidatenote",
            "candidates_candidate",
            "jobs_job",
            "requisitions_requisition",
            "sub_verticals",
            "departments",
            "accounts_user_groups",
            "accounts_user_user_permissions",
            "accounts_user",
        ]

        with connection.cursor() as cursor:
            for table in tables:
                try:
                    cursor.execute(
                        f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'
                    )
                except Exception:
                    pass

        self.stdout.write("  All existing data cleared.")

    # ---------------------------------------------------------
    def _create_departments(self):
        from apps.departments.models import Department

        names = [
            "Engineering",
            "Product",
            "Design",
            "Data Science",
            "HR",
            "Marketing",
            "Finance",
            "Sales",
            "Customer Success",
            "Operations",
        ]

        departments = {}
        for name in names:
            dept = Department.objects.create(name=name)
            departments[name] = dept

        self.stdout.write(f"  Created {len(departments)} departments.")
        return departments

    # ---------------------------------------------------------
    def _create_sub_verticals(self, departments):
        from apps.departments.models import SubVertical

        structure = {
            "Engineering": {
                "Platform Engineering": [
                    "Backend Services",
                    "API Infrastructure",
                    "Database Engineering",
                ],
                "Frontend Engineering": [
                    "Web Applications",
                    "Design Systems",
                    "Performance Engineering",
                ],
                "DevOps & Cloud": [
                    "AWS Infrastructure",
                    "CI/CD Pipelines",
                    "Site Reliability",
                ],
                "QA & Testing": [
                    "Automation Testing",
                    "Performance Testing",
                    "Security Testing",
                ],
            },
            "Product": {
                "Growth Product": [
                    "User Acquisition",
                    "Retention",
                    "Monetization",
                ],
                "Core Product": [
                    "Platform Features",
                    "Customer Experience",
                    "Roadmap Delivery",
                ],
                "Analytics Product": [
                    "BI Dashboards",
                    "Experimentation",
                    "Insights Platform",
                ],
            },
            "Design": {
                "UX Design": [
                    "User Research",
                    "Wireframing",
                    "Prototyping",
                ],
                "UI Design": [
                    "Web Design",
                    "Mobile Design",
                    "Design Systems",
                ],
                "Brand Design": [
                    "Visual Identity",
                    "Campaign Creatives",
                    "Social Media Assets",
                ],
            },
            "Data Science": {
                "Machine Learning": [
                    "Recommendation Systems",
                    "Predictive Models",
                    "Model Deployment",
                ],
                "AI & NLP": [
                    "LLM Applications",
                    "Text Processing",
                    "Search Ranking",
                ],
                "Analytics": [
                    "BI Reporting",
                    "Dashboards",
                    "Insights",
                ],
            },
            "HR": {
                "Talent Acquisition": [
                    "Campus Hiring",
                    "Lateral Hiring",
                    "Executive Hiring",
                ],
                "People Operations": [
                    "Payroll",
                    "Employee Engagement",
                    "Compliance",
                ],
            },
            "Marketing": {
                "Digital Marketing": [
                    "SEO",
                    "Paid Ads",
                    "Performance Marketing",
                ],
                "Content Marketing": [
                    "Blog Strategy",
                    "Email Campaigns",
                    "Social Media",
                ],
                "Brand Marketing": [
                    "PR",
                    "Campaign Strategy",
                    "Events",
                ],
            },
            "Finance": {
                "Financial Planning": [
                    "Budgeting",
                    "Forecasting",
                    "Business Planning",
                ],
                "Accounting": [
                    "Accounts Payable",
                    "Accounts Receivable",
                    "Compliance",
                ],
                "Strategy & Investments": [
                    "Fundraising",
                    "M&A",
                    "Investor Relations",
                ],
            },
        }

        created_count = 0

        for dept_name, subvertical_groups in structure.items():
            department = departments.get(dept_name)

            if not department:
                continue

            for parent_name, child_names in subvertical_groups.items():
                parent_sv = SubVertical.objects.create(
                    department=department,
                    name=parent_name,
                    parent=None,
                )
                created_count += 1

                for child_name in child_names:
                    SubVertical.objects.create(
                        department=department,
                        name=child_name,
                        parent=parent_sv,
                    )
                    created_count += 1

        self.stdout.write(f"  Created {created_count} sub verticals.")

    # ---------------------------------------------------------
    def _create_users(self, departments):
        from apps.accounts.models import User

        specs = [
            {
                "email": "admin@ats.com",
                "full_name": "Admin User",
                "password": "Admin@123",
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
                "department": departments["HR"],
            },

            # Hiring managers
            {
                "email": "amit.verma@ats.com",
                "full_name": "Amit Verma",
                "password": "Pass@123",
                "role": "hiring_manager",
                "department": departments["Engineering"],
            },
            {
                "email": "sneha.patel@ats.com",
                "full_name": "Sneha Patel",
                "password": "Pass@123",
                "role": "hiring_manager",
                "department": departments["Product"],
            },
            {
                "email": "rohit.malhotra@ats.com",
                "full_name": "Rohit Malhotra",
                "password": "Pass@123",
                "role": "hiring_manager",
                "department": departments["Data Science"],
            },

            # Recruiters
            {
                "email": "priya.sharma@ats.com",
                "full_name": "Priya Sharma",
                "password": "Pass@123",
                "role": "recruiter",
                "department": departments["HR"],
            },
            {
                "email": "karan.singh@ats.com",
                "full_name": "Karan Singh",
                "password": "Pass@123",
                "role": "recruiter",
                "department": departments["Engineering"],
            },
            {
                "email": "divya.nair@ats.com",
                "full_name": "Divya Nair",
                "password": "Pass@123",
                "role": "recruiter",
                "department": departments["Design"],
            },

            # Interviewers
            {
                "email": "vivek.rana@ats.com",
                "full_name": "Vivek Rana",
                "password": "Pass@123",
                "role": "interviewer",
                "department": departments["Engineering"],
            },
            {
                "email": "nidhi.agarwal@ats.com",
                "full_name": "Nidhi Agarwal",
                "password": "Pass@123",
                "role": "interviewer",
                "department": departments["Product"],
            },
        ]

        users = {}

        for spec in specs:
            password = spec.pop("password")
            user = User(**spec)
            user.set_password(password)
            user.save()
            users[user.email] = user

        return users

    # ---------------------------------------------------------
    def _create_requisitions(self, users, departments):
        from apps.requisitions.models import Requisition, RequisitionApproval

        req_specs = [
            ("Senior Backend Engineer", "Engineering", "approved"),
            ("Frontend Engineer", "Engineering", "approved"),
            ("DevOps Engineer", "Engineering", "pending_approval"),
            ("Data Scientist", "Data Science", "approved"),
            ("ML Engineer", "Data Science", "draft"),
            ("Product Manager", "Product", "approved"),
            ("Senior UX Designer", "Design", "approved"),
            ("Talent Acquisition Specialist", "HR", "closed"),
        ]

        reqs = []

        for idx, (title, dept_name, status) in enumerate(req_specs, 1):
            req = Requisition.objects.create(
                title=title,
                department=departments[dept_name],
                location=random.choice(["Gurgaon", "Noida", "Remote"]),
                designation=title,
                priority=random.choice(["medium", "high", "critical"]),
                employment_type="permanent",
                requisition_type=random.choice(["new", "backfill"]),
                positions_count=random.randint(1, 5),
                experience_min=random.randint(1, 4),
                experience_max=random.randint(5, 10),
                job_description=f"Detailed JD for {title}",
                roles_responsibilities="Ownership, execution, stakeholder management",
                skills_required=["Python", "Django", "PostgreSQL"],
                skills_desirable=["AWS", "Docker"],
                skills_to_evaluate=["Problem Solving", "Communication"],
                tags=["tech", dept_name.lower()],
                min_qualification="Bachelor's Degree",
                created_by=users["admin@ats.com"],
                hiring_manager=users["amit.verma@ats.com"],
                l1_approver=users["admin@ats.com"],
                status=status,
                expected_start_date=date.today() + timedelta(days=30),
            )

            RequisitionApproval.objects.create(
                requisition=req,
                action="submitted",
                acted_by=users["admin@ats.com"],
                comments="Initial submission",
            )

            if status == "approved":
                RequisitionApproval.objects.create(
                    requisition=req,
                    action="approved",
                    acted_by=users["admin@ats.com"],
                    comments="Approved for hiring",
                )

            reqs.append(req)

        return reqs

    # ---------------------------------------------------------
    def _create_jobs(self, requisitions, users, departments):
        from apps.jobs.models import Job

        jobs = []

        approved_reqs = [
            req for req in requisitions
            if req.status == "approved"
        ]

        unique_reqs = {str(req.id): req for req in approved_reqs}.values()

        for idx, req in enumerate(unique_reqs, start=1):
            existing_job = Job.objects.filter(requisition=req).first()

            if existing_job:
                jobs.append(existing_job)
                continue

            job = Job.objects.create(
                requisition=req,
                job_code=f"JOB-{idx:04d}",
                title=req.title,
                department=req.department,
                hiring_manager=req.hiring_manager,
                created_by=users["admin@ats.com"],
                location=req.location,
                skills_required=req.skills_required,
                job_description=req.job_description,
                experience_min=req.experience_min,
                experience_max=req.experience_max,
                status=random.choice(["open", "open", "open", "closed"]),
                view_count=random.randint(10, 300),
                positions_filled=min(
                    random.randint(0, req.positions_count),
                    req.positions_count
                ),
            )

            jobs.append(job)

        self.stdout.write(f"  Created {len(jobs)} jobs.")
        return jobs

    # ---------------------------------------------------------
    def _create_candidates(self, jobs, users):
        from apps.candidates.models import (
            Candidate,
            CandidateJobMapping,
            PipelineStageHistory,
            CandidateNote,
        )
        from apps.interviews.models import Interview, InterviewFeedback

        first_names = [
            "Rahul", "Neha", "Arjun", "Meera", "Aditya",
            "Simran", "Rohan", "Ishita", "Vikram", "Deepak",
            "Ananya", "Kunal", "Sanya", "Harshit", "Nitin",
        ]

        last_names = [
            "Gupta", "Sharma", "Verma", "Kapoor",
            "Rao", "Nair", "Patel", "Roy",
        ]

        companies = [
            "Infosys", "TCS", "Wipro", "Accenture",
            "Google", "Amazon", "Microsoft", "Flipkart",
        ]

        stages = [
            "APPLIED",
            "SHORTLISTED",
            "INTERVIEW",
            "OFFERED",
            "JOINED",
            "DROPPED",
        ]

        total_candidates = 60

        for idx in range(total_candidates):
            name = f"{random.choice(first_names)} {random.choice(last_names)}"

            candidate = Candidate.objects.create(
                full_name=name,
                email=f"candidate{idx}@example.com",
                phone=f"+91-987654{1000+idx}",
                designation=random.choice([
                    "Software Engineer",
                    "Senior Developer",
                    "Data Scientist",
                    "Product Analyst",
                ]),
                current_employer=random.choice(companies),
                location=random.choice([
                    "Bangalore", "Gurgaon", "Pune", "Remote"
                ]),
                total_experience_years=round(random.uniform(1, 8), 1),
                skills=random.sample(
                    [
                        "Python", "Django", "React", "AWS",
                        "SQL", "Machine Learning", "Docker",
                        "Kubernetes", "JavaScript",
                    ],
                    4,
                ),
                current_ctc_lakhs=random.randint(6, 25),
                notice_period_days=random.choice([15, 30, 60, 90]),
                source=random.choice([
                    "linkedin",
                    "naukri",
                    "referral",
                    "manual",
                    "recruiter_upload",
                ]),
                created_by=users["admin@ats.com"],
                parsing_status="done",
            )

            job = random.choice(jobs)
            stage = random.choice(stages)

            extra = {}
            if stage == 'INTERVIEW':
                extra['current_interview_round'] = 'R1'
            elif stage == 'DROPPED':
                extra['drop_reason'] = 'REJECTED'
            elif stage == 'OFFERED':
                extra['offer_status'] = 'OFFER_SENT'

            mapping = CandidateJobMapping.objects.create(
                candidate=candidate,
                job=job,
                macro_stage=stage,
                moved_by=users["priya.sharma@ats.com"],
                **extra,
            )

            PipelineStageHistory.objects.create(
                mapping=mapping,
                from_macro_stage="APPLIED",
                to_macro_stage=stage,
                moved_by=users["priya.sharma@ats.com"],
                remarks=f"Moved to {stage}",
            )

            CandidateNote.objects.create(
                candidate=candidate,
                user=users["priya.sharma@ats.com"],
                content="Strong profile, good communication skills.",
            )

            if stage in ["interview", "selected", "offered", "joined"]:
                interview = Interview.objects.create(
                    mapping=mapping,
                    round_number=1,
                    round_label="Technical Round",
                    interviewer=users["vivek.rana@ats.com"],
                    scheduled_at=timezone.now() + timedelta(days=idx % 5),
                    duration_minutes=60,
                    mode="virtual",
                    meeting_link="https://meet.google.com/test-room",
                    status=random.choice(["scheduled", "completed"]),
                    created_by=users["priya.sharma@ats.com"],
                )

                if interview.status == "completed":
                    InterviewFeedback.objects.create(
                        interview=interview,
                        interviewer=users["vivek.rana@ats.com"],
                        overall_rating=random.randint(3, 5),
                        recommendation=random.choice(
                            ["proceed", "hold", "reject"]
                        ),
                        strengths="Strong DSA and backend concepts",
                        weaknesses="Needs improvement in system design",
                        comments="Overall good fit",
                    )

        self.stdout.write(f"  Created {total_candidates} candidates.")
