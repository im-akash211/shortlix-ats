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
    help = "Seeds the database with users, departments, jobs, candidates and interview data"

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
        self.stdout.write(self.style.SUCCESS("All other users: Pass@123"))

    # ---------------------------------------------------------
    def _clear_data(self):
        from django.db import connection

        tables = [
            "interviews_interviewfeedback",
            "interviews_competencyrating",
            "interviews_interview",
            "candidates_candidatejobcomment",
            "candidates_candidatejobmapping",
            "candidates_candidatenote",
            "candidates_pipelinestagehistory",
            "candidates_candidate",
            "jobs_jobcollaborator",
            "jobs_job",
            "requisitions_requisitionapproval",
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
                    cursor.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')
                except Exception:
                    pass

            # Some DB columns exist with NOT NULL but no model default (schema drift).
            # Set empty-string defaults so ORM inserts succeed without listing them.
            extra_text_cols = [
                "graduation_college", "graduation_course", "native_location",
                "notice_period_status", "offers_in_hand", "post_graduation_college",
                "post_graduation_course", "post_qualifying_exam", "post_qualifying_rank",
                "qualifying_exam", "qualifying_rank", "reason_for_change",
                "tenth_board", "twelfth_board",
            ]
            for col in extra_text_cols:
                try:
                    cursor.execute(
                        f"ALTER TABLE candidates_candidate ALTER COLUMN {col} SET DEFAULT ''"
                    )
                except Exception:
                    pass

        self.stdout.write("  All existing data cleared.")

    # ---------------------------------------------------------
    def _create_departments(self):
        from apps.departments.models import Department

        names = [
            "Engineering", "Product", "Design", "Data Science",
            "HR", "Marketing", "Finance", "Sales",
            "Customer Success", "Operations",
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
                "Platform Engineering": ["Backend Services", "API Infrastructure", "Database Engineering"],
                "Frontend Engineering": ["Web Applications", "Design Systems", "Performance Engineering"],
                "DevOps & Cloud": ["AWS Infrastructure", "CI/CD Pipelines", "Site Reliability"],
                "QA & Testing": ["Automation Testing", "Performance Testing", "Security Testing"],
            },
            "Product": {
                "Growth Product": ["User Acquisition", "Retention", "Monetization"],
                "Core Product": ["Platform Features", "Customer Experience", "Roadmap Delivery"],
                "Analytics Product": ["BI Dashboards", "Experimentation", "Insights Platform"],
            },
            "Design": {
                "UX Design": ["User Research", "Wireframing", "Prototyping"],
                "UI Design": ["Web Design", "Mobile Design", "Design Systems"],
                "Brand Design": ["Visual Identity", "Campaign Creatives", "Social Media Assets"],
            },
            "Data Science": {
                "Machine Learning": ["Recommendation Systems", "Predictive Models", "Model Deployment"],
                "AI & NLP": ["LLM Applications", "Text Processing", "Search Ranking"],
                "Analytics": ["BI Reporting", "Dashboards", "Insights"],
            },
            "HR": {
                "Talent Acquisition": ["Campus Hiring", "Lateral Hiring", "Executive Hiring"],
                "People Operations": ["Payroll", "Employee Engagement", "Compliance"],
            },
            "Marketing": {
                "Digital Marketing": ["SEO", "Paid Ads", "Performance Marketing"],
                "Content Marketing": ["Blog Strategy", "Email Campaigns", "Social Media"],
                "Brand Marketing": ["PR", "Campaign Strategy", "Events"],
            },
            "Finance": {
                "Financial Planning": ["Budgeting", "Forecasting", "Business Planning"],
                "Accounting": ["Accounts Payable", "Accounts Receivable", "Compliance"],
                "Strategy & Investments": ["Fundraising", "M&A", "Investor Relations"],
            },
        }

        created_count = 0
        for dept_name, subvertical_groups in structure.items():
            department = departments.get(dept_name)
            if not department:
                continue
            for parent_name, child_names in subvertical_groups.items():
                parent_sv = SubVertical.objects.create(department=department, name=parent_name, parent=None)
                created_count += 1
                for child_name in child_names:
                    SubVertical.objects.create(department=department, name=child_name, parent=parent_sv)
                    created_count += 1

        self.stdout.write(f"  Created {created_count} sub verticals.")

    # ---------------------------------------------------------
    def _create_users(self, departments):
        from apps.accounts.models import User

        specs = [
            # ── Admin ─────────────────────────────────────────────────
            {
                "email": "admin@ats.com", "full_name": "Admin User",
                "password": "Admin@123", "role": "admin",
                "is_staff": True, "is_superuser": True,
                "department": departments["HR"],
            },

            # ── Hiring Managers ───────────────────────────────────────
            {
                "email": "amit.verma@ats.com", "full_name": "Amit Verma",
                "password": "Pass@123", "role": "hiring_manager",
                "department": departments["Engineering"],
            },
            {
                "email": "sneha.patel@ats.com", "full_name": "Sneha Patel",
                "password": "Pass@123", "role": "hiring_manager",
                "department": departments["Product"],
            },
            {
                "email": "rohit.malhotra@ats.com", "full_name": "Rohit Malhotra",
                "password": "Pass@123", "role": "hiring_manager",
                "department": departments["Data Science"],
            },
            {
                "email": "kavita.iyer@ats.com", "full_name": "Kavita Iyer",
                "password": "Pass@123", "role": "hiring_manager",
                "department": departments["Design"],
            },
            {
                "email": "suresh.menon@ats.com", "full_name": "Suresh Menon",
                "password": "Pass@123", "role": "hiring_manager",
                "department": departments["Finance"],
            },
            {
                "email": "deepa.krishnan@ats.com", "full_name": "Deepa Krishnan",
                "password": "Pass@123", "role": "hiring_manager",
                "department": departments["Marketing"],
            },

            # ── Recruiters ────────────────────────────────────────────
            {
                "email": "priya.sharma@ats.com", "full_name": "Priya Sharma",
                "password": "Pass@123", "role": "recruiter",
                "department": departments["HR"],
            },
            {
                "email": "karan.singh@ats.com", "full_name": "Karan Singh",
                "password": "Pass@123", "role": "recruiter",
                "department": departments["Engineering"],
            },
            {
                "email": "divya.nair@ats.com", "full_name": "Divya Nair",
                "password": "Pass@123", "role": "recruiter",
                "department": departments["Design"],
            },
            {
                "email": "ritu.bhatia@ats.com", "full_name": "Ritu Bhatia",
                "password": "Pass@123", "role": "recruiter",
                "department": departments["HR"],
            },
            {
                "email": "manish.dubey@ats.com", "full_name": "Manish Dubey",
                "password": "Pass@123", "role": "recruiter",
                "department": departments["Operations"],
            },

            # ── Interviewers ──────────────────────────────────────────
            {
                "email": "vivek.rana@ats.com", "full_name": "Vivek Rana",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Engineering"],
            },
            {
                "email": "nidhi.agarwal@ats.com", "full_name": "Nidhi Agarwal",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Product"],
            },
            {
                "email": "sanjay.khanna@ats.com", "full_name": "Sanjay Khanna",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Engineering"],
            },
            {
                "email": "pooja.reddy@ats.com", "full_name": "Pooja Reddy",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Data Science"],
            },
            {
                "email": "ankit.joshi@ats.com", "full_name": "Ankit Joshi",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Engineering"],
            },
            {
                "email": "swati.chauhan@ats.com", "full_name": "Swati Chauhan",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Product"],
            },
            {
                "email": "rajesh.pillai@ats.com", "full_name": "Rajesh Pillai",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Design"],
            },
            {
                "email": "megha.tiwari@ats.com", "full_name": "Megha Tiwari",
                "password": "Pass@123", "role": "interviewer",
                "department": departments["Data Science"],
            },
        ]

        users = {}
        for spec in specs:
            password = spec.pop("password")
            user = User(**spec)
            user.set_password(password)
            user.save()
            users[user.email] = user

        self.stdout.write(f"  Created {len(users)} users.")
        return users

    # ---------------------------------------------------------
    def _create_requisitions(self, users, departments):
        from apps.requisitions.models import Requisition, RequisitionApproval

        req_specs = [
            ("Senior Backend Engineer",         "Engineering",  "approved"),
            ("Frontend Engineer",               "Engineering",  "approved"),
            ("DevOps Engineer",                 "Engineering",  "approved"),
            ("Full Stack Engineer",             "Engineering",  "approved"),
            ("Data Scientist",                  "Data Science", "approved"),
            ("ML Engineer",                     "Data Science", "approved"),
            ("AI Research Engineer",            "Data Science", "draft"),
            ("Product Manager",                 "Product",      "approved"),
            ("Senior Product Manager",          "Product",      "approved"),
            ("Senior UX Designer",              "Design",       "approved"),
            ("UI Designer",                     "Design",       "approved"),
            ("Talent Acquisition Specialist",   "HR",           "approved"),
            ("Performance Marketing Manager",   "Marketing",    "approved"),
            ("Financial Analyst",               "Finance",      "approved"),
        ]

        skill_map = {
            "Engineering":  ["Python", "Django", "PostgreSQL", "AWS", "Docker", "Kubernetes", "React", "TypeScript"],
            "Data Science": ["Python", "TensorFlow", "PyTorch", "SQL", "Spark", "Machine Learning", "NLP"],
            "Product":      ["Product Strategy", "Roadmapping", "Agile", "SQL", "Figma", "Stakeholder Management"],
            "Design":       ["Figma", "UX Research", "Prototyping", "Adobe XD", "Design Systems"],
            "HR":           ["Talent Acquisition", "Naukri", "LinkedIn", "Stakeholder Management"],
            "Marketing":    ["Google Ads", "SEO", "Analytics", "Performance Marketing", "Meta Ads"],
            "Finance":      ["Excel", "Financial Modelling", "Accounting", "Tally", "SAP"],
        }

        hiring_managers = {
            "Engineering":  users["amit.verma@ats.com"],
            "Data Science": users["rohit.malhotra@ats.com"],
            "Product":      users["sneha.patel@ats.com"],
            "Design":       users["kavita.iyer@ats.com"],
            "HR":           users["admin@ats.com"],
            "Marketing":    users["deepa.krishnan@ats.com"],
            "Finance":      users["suresh.menon@ats.com"],
        }

        reqs = []
        for idx, (title, dept_name, status) in enumerate(req_specs, 1):
            skills = skill_map.get(dept_name, ["Communication", "Leadership"])
            req = Requisition.objects.create(
                title=title,
                department=departments[dept_name],
                location=random.choice(["Gurgaon", "Noida", "Bangalore", "Remote", "Hyderabad"]),
                designation=title,
                priority=random.choice(["medium", "high", "critical"]),
                employment_type="permanent",
                requisition_type=random.choice(["new", "backfill"]),
                positions_count=random.randint(1, 4),
                experience_min=random.randint(2, 5),
                experience_max=random.randint(6, 12),
                job_description=f"We are looking for a {title} to join our {dept_name} team. "
                                f"You will own key product/tech outcomes and collaborate closely with cross-functional teams.",
                roles_responsibilities="Ownership of deliverables, stakeholder communication, technical execution.",
                skills_required=skills[:4],
                skills_desirable=skills[4:],
                skills_to_evaluate=["Problem Solving", "Communication", "Technical Depth"],
                tags=["tech", dept_name.lower().replace(" ", "-")],
                min_qualification="Bachelor's Degree",
                created_by=users["admin@ats.com"],
                hiring_manager=hiring_managers.get(dept_name, users["amit.verma@ats.com"]),
                status=status,
                expected_start_date=date.today() + timedelta(days=random.randint(20, 60)),
            )

            RequisitionApproval.objects.create(
                requisition=req, action="submitted",
                acted_by=users["admin@ats.com"], comments="Initial submission",
            )
            if status == "approved":
                RequisitionApproval.objects.create(
                    requisition=req, action="approved",
                    acted_by=users["admin@ats.com"], comments="Approved for hiring",
                )

            reqs.append(req)

        self.stdout.write(f"  Created {len(reqs)} requisitions.")
        return reqs

    # ---------------------------------------------------------
    def _create_jobs(self, requisitions, users, departments):
        from apps.jobs.models import Job

        jobs = []
        approved_reqs = [r for r in requisitions if r.status == "approved"]

        for idx, req in enumerate(approved_reqs, start=1):
            existing = Job.objects.filter(requisition=req).first()
            if existing:
                jobs.append(existing)
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
                view_count=random.randint(15, 400),
                positions_filled=min(random.randint(0, req.positions_count), req.positions_count),
            )
            jobs.append(job)

        self.stdout.write(f"  Created {len(jobs)} jobs.")
        return jobs

    # ---------------------------------------------------------
    def _create_candidates(self, jobs, users):
        from apps.candidates.models import (
            Candidate, CandidateJobMapping, PipelineStageHistory,
            CandidateNote, CandidateJobComment,
        )
        from apps.interviews.models import Interview

        first_names = [
            "Rahul", "Neha", "Arjun", "Meera", "Aditya", "Simran", "Rohan",
            "Ishita", "Vikram", "Deepak", "Ananya", "Kunal", "Sanya", "Harshit",
            "Nitin", "Prerna", "Gaurav", "Kavya", "Akshay", "Riya", "Shubham",
            "Pooja", "Varun", "Shreya", "Mohit", "Pallavi", "Abhijit", "Tanya",
            "Kartik", "Nisha", "Siddharth", "Yamini", "Rajeev", "Divyanka",
        ]

        last_names = [
            "Gupta", "Sharma", "Verma", "Kapoor", "Rao", "Nair", "Patel",
            "Roy", "Joshi", "Mehta", "Desai", "Bose", "Pillai", "Chatterjee",
            "Sinha", "Tiwari", "Bhatia", "Malhotra", "Khanna", "Iyer",
        ]

        companies = [
            "Infosys", "TCS", "Wipro", "Accenture", "Google", "Amazon",
            "Microsoft", "Flipkart", "Zomato", "Swiggy", "Paytm", "HDFC Tech",
            "Meesho", "Razorpay", "Freshworks", "Zoho", "PhonePe", "Ola",
        ]

        designations = [
            "Software Engineer", "Senior Software Engineer", "Lead Engineer",
            "Data Scientist", "ML Engineer", "Product Analyst", "Senior Developer",
            "DevOps Engineer", "Frontend Developer", "Backend Developer",
            "Full Stack Developer", "Product Manager", "UX Designer",
            "Data Analyst", "Cloud Engineer",
        ]

        all_skills = [
            "Python", "Django", "React", "AWS", "SQL", "Machine Learning",
            "Docker", "Kubernetes", "JavaScript", "TypeScript", "Node.js",
            "PostgreSQL", "Redis", "Kafka", "TensorFlow", "PyTorch",
            "Figma", "Java", "Spring Boot", "Go", "Rust", "GraphQL",
        ]

        locations = ["Bangalore", "Gurgaon", "Pune", "Hyderabad", "Mumbai", "Remote", "Noida", "Chennai"]
        sources = ["linkedin", "naukri", "referral", "manual", "recruiter_upload"]

        interviewers = [
            users["vivek.rana@ats.com"],
            users["nidhi.agarwal@ats.com"],
            users["sanjay.khanna@ats.com"],
            users["pooja.reddy@ats.com"],
            users["ankit.joshi@ats.com"],
            users["swati.chauhan@ats.com"],
            users["rajesh.pillai@ats.com"],
            users["megha.tiwari@ats.com"],
        ]

        recruiters = [
            users["priya.sharma@ats.com"],
            users["karan.singh@ats.com"],
            users["divya.nair@ats.com"],
            users["ritu.bhatia@ats.com"],
            users["manish.dubey@ats.com"],
        ]

        screening_statuses = ["SCREENED", "MAYBE", "REJECTED", None]
        round_progression = ["R1", "R2", "R3", "CLIENT", "CDO", "MGMT"]

        # Distribution: 25 Applied, 20 Shortlisted, 30 Interview, 10 Offered, 8 Joined, 7 Dropped
        stage_pool = (
            ["APPLIED"] * 25 +
            ["SHORTLISTED"] * 20 +
            ["INTERVIEW"] * 30 +
            ["OFFERED"] * 10 +
            ["JOINED"] * 8 +
            ["DROPPED"] * 7
        )
        random.shuffle(stage_pool)

        now = timezone.now()
        created_interviews = 0
        created_candidates = 0

        for idx, stage in enumerate(stage_pool):
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            recruiter = random.choice(recruiters)

            candidate = Candidate.objects.create(
                full_name=name,
                email=f"candidate{idx:03d}@example.com",
                phone=f"+91-98765{40000 + idx}",
                designation=random.choice(designations),
                current_employer=random.choice(companies),
                location=random.choice(locations),
                total_experience_years=round(random.uniform(1.5, 12.0), 1),
                skills=random.sample(all_skills, random.randint(3, 6)),
                current_ctc_lakhs=round(random.uniform(5.0, 40.0), 1),
                notice_period_days=random.choice([0, 15, 30, 60, 90]),
                source=random.choice(sources),
                sub_source=random.choice(["Direct Apply", "Employee Referral", "Agency", ""]),
                created_by=users["admin@ats.com"],
                parsing_status="done",
            )

            job = random.choice(jobs)
            extra = {}
            interview_round = None

            if stage == "INTERVIEW":
                interview_round = random.choice(round_progression)
                extra["current_interview_round"] = interview_round
            elif stage == "DROPPED":
                extra["drop_reason"] = random.choice(["REJECTED", "CANDIDATE_DROP", "NO_SHOW"])
            elif stage == "OFFERED":
                extra["offer_status"] = random.choice(["OFFER_SENT", "OFFER_ACCEPTED", "OFFER_DECLINED"])
            elif stage == "APPLIED":
                sc = random.choice(screening_statuses)
                if sc:
                    extra["screening_status"] = sc

            mapping = CandidateJobMapping.objects.create(
                candidate=candidate,
                job=job,
                macro_stage=stage,
                moved_by=recruiter,
                priority=random.choice(["LOW", "MEDIUM", "HIGH"]),
                **extra,
            )

            # Pipeline history
            if stage != "APPLIED":
                PipelineStageHistory.objects.create(
                    mapping=mapping,
                    from_macro_stage="APPLIED",
                    to_macro_stage="SHORTLISTED",
                    moved_by=recruiter,
                    remarks="Shortlisted after screening",
                )
            if stage in ["INTERVIEW", "OFFERED", "JOINED", "DROPPED"]:
                PipelineStageHistory.objects.create(
                    mapping=mapping,
                    from_macro_stage="SHORTLISTED",
                    to_macro_stage="INTERVIEW",
                    moved_by=recruiter,
                    remarks="Moved to interview",
                )
            if stage == "OFFERED":
                PipelineStageHistory.objects.create(
                    mapping=mapping,
                    from_macro_stage="INTERVIEW",
                    to_macro_stage="OFFERED",
                    moved_by=recruiter,
                    remarks="Cleared all rounds",
                )
            elif stage == "JOINED":
                PipelineStageHistory.objects.create(
                    mapping=mapping,
                    from_macro_stage="INTERVIEW",
                    to_macro_stage="OFFERED",
                    moved_by=recruiter,
                    remarks="Offer sent",
                )
                PipelineStageHistory.objects.create(
                    mapping=mapping,
                    from_macro_stage="OFFERED",
                    to_macro_stage="JOINED",
                    moved_by=recruiter,
                    remarks="Candidate joined",
                )
            elif stage == "DROPPED":
                PipelineStageHistory.objects.create(
                    mapping=mapping,
                    from_macro_stage="INTERVIEW",
                    to_macro_stage="DROPPED",
                    moved_by=recruiter,
                    remarks=f"Dropped: {extra.get('drop_reason', '')}",
                )

            # Candidate note
            CandidateNote.objects.create(
                candidate=candidate,
                user=recruiter,
                content=random.choice([
                    "Strong profile, excellent communication skills.",
                    "Good technical background, needs system design improvement.",
                    "Referral candidate — high priority.",
                    "Previously rejected at HR round, reconsidering.",
                    "Candidate has competing offer, needs fast-track.",
                    "Strong DSA. Backend experience solid.",
                    "Domain knowledge excellent. Culture fit TBD.",
                    "Notice period negotiable.",
                ]),
            )

            # Job-scoped comment
            if random.random() < 0.6:
                CandidateJobComment.objects.create(
                    mapping=mapping,
                    user=recruiter,
                    content=random.choice([
                        "Reviewed resume — good fit for the role.",
                        "Scheduled R1. Candidate confirmed.",
                        "HM gave positive feedback after R1.",
                        "Candidate has a competing offer. Please expedite.",
                        "Background check initiated.",
                        "R2 panel finalized.",
                        "Candidate asked for salary revision.",
                        "Offer letter sent. Awaiting acceptance.",
                        "Candidate joined today.",
                        "No-show in technical round. Rescheduling.",
                    ]),
                )

            # ── Interview records ──────────────────────────────────────────────
            if stage == "INTERVIEW":
                self._create_interview_chain(
                    mapping, interview_round, interviewers, recruiters, now,
                )
                created_interviews += 1

            elif stage in ["OFFERED", "JOINED"]:
                # These candidates cleared interviews — create completed R1 at minimum
                completed_round = random.choice(["R1", "R2", "CLIENT"])
                self._create_completed_interview(
                    mapping, completed_round, interviewers, recruiters, now,
                )

            created_candidates += 1

        self.stdout.write(f"  Created {created_candidates} candidates.")
        self.stdout.write(f"  Created interview records for {created_interviews} INTERVIEW-stage candidates.")

    # ---------------------------------------------------------
    def _create_interview_chain(self, mapping, current_round, interviewers, recruiters, now):
        """
        Create realistic interview history for a candidate currently in `current_round`.
        All rounds before current_round are COMPLETED; current_round may be
        SCHEDULED, ON_HOLD, or COMPLETED (no next round scheduled yet).
        """
        from apps.interviews.models import Interview

        round_progression = ["R1", "R2", "R3", "CLIENT", "CDO", "MGMT"]
        current_idx = round_progression.index(current_round)

        interviewer = random.choice(interviewers)
        recruiter = random.choice(recruiters)

        # Create COMPLETED interviews for all prior rounds
        for prior_round in round_progression[:current_idx]:
            try:
                Interview.objects.create(
                    mapping=mapping,
                    round_name=prior_round,
                    round_status="COMPLETED",
                    round_result="PASS",
                    round_number=round_progression.index(prior_round) + 1,
                    round_label=f"Round {round_progression.index(prior_round) + 1}",
                    interviewer=random.choice(interviewers),
                    scheduled_at=now - timedelta(days=(current_idx - round_progression.index(prior_round)) * 7),
                    duration_minutes=random.choice([45, 60, 90]),
                    mode=random.choice(["virtual", "phone", "face_to_face"]),
                    meeting_link="https://meet.google.com/seed-room",
                    status="completed",
                    created_by=recruiter,
                )
            except Exception:
                pass  # skip unique constraint violations

        # Determine current round status
        current_status_choice = random.choices(
            ["SCHEDULED", "COMPLETED", "ON_HOLD"],
            weights=[50, 30, 20],
        )[0]

        # Some INTERVIEW-stage candidates may be REJECTED
        is_rejected = (current_status_choice == "COMPLETED") and (random.random() < 0.2)

        try:
            Interview.objects.create(
                mapping=mapping,
                round_name=current_round,
                round_status=current_status_choice,
                round_result="FAIL" if is_rejected else (
                    "PASS" if current_status_choice == "COMPLETED" else None
                ),
                round_number=current_idx + 1,
                round_label=f"Round {current_idx + 1}",
                interviewer=interviewer,
                scheduled_at=now + timedelta(days=random.randint(-3, 10)),
                duration_minutes=random.choice([45, 60, 90]),
                mode=random.choice(["virtual", "phone", "face_to_face"]),
                meeting_link="https://meet.google.com/seed-room" if random.random() > 0.3 else "",
                status="completed" if current_status_choice in ("COMPLETED",) else "scheduled",
                created_by=recruiter,
            )

            if is_rejected:
                mapping.interview_status = "REJECTED"
                mapping.save(update_fields=["interview_status"])

        except Exception:
            pass

    # ---------------------------------------------------------
    def _create_completed_interview(self, mapping, round_name, interviewers, recruiters, now):
        """Create a single COMPLETED interview for OFFERED/JOINED candidates."""
        from apps.interviews.models import Interview

        round_progression = ["R1", "R2", "R3", "CLIENT", "CDO", "MGMT"]
        round_idx = round_progression.index(round_name)

        try:
            Interview.objects.create(
                mapping=mapping,
                round_name=round_name,
                round_status="COMPLETED",
                round_result="PASS",
                round_number=round_idx + 1,
                round_label=f"Round {round_idx + 1}",
                interviewer=random.choice(interviewers),
                scheduled_at=now - timedelta(days=random.randint(7, 30)),
                duration_minutes=random.choice([45, 60, 90]),
                mode=random.choice(["virtual", "phone", "face_to_face"]),
                meeting_link="https://meet.google.com/seed-room",
                status="completed",
                created_by=random.choice(recruiters),
            )
        except Exception:
            pass
