"""
Management command: python manage.py seed_dev
Creates a full set of dev/demo data.
Safe to run multiple times — existing data is cleared first.
Login: admin@ats.com / Admin@123  (all seeded users share the same password)
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import random

PASSWORD = 'Admin@123'


def _slug(name):
    """'Rupinder Monga' → 'rupinder.monga'"""
    parts = name.lower().split()
    return '.'.join(parts)


class Command(BaseCommand):
    help = 'Seed development database with comprehensive demo data'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data...')
        self._clear()
        self.stdout.write('Seeding...')
        with transaction.atomic():
            self._seed()
        self.stdout.write(self.style.SUCCESS(
            f'Done!  Login: admin@ats.com / {PASSWORD}'
        ))

    # ------------------------------------------------------------------ #
    def _clear(self):
        from django.db import connection

        # Raw TRUNCATE CASCADE bypasses ORM SELECT — safe even when pending
        # migrations have added columns not yet applied to the DB.
        # Postgres CASCADE handles FK ordering automatically.
        tables = [
            'interviews_competencyrating',
            'interviews_interviewfeedback',
            'interviews_interview',
            'interviews_feedbacktemplate',
            'candidates_pipelinestagehistory',
            'candidates_candidatenotehistory',
            'candidates_candidatenote',
            'candidates_candidatejobcomment',
            'candidates_candidatereminder',
            'candidates_candidatejobmapping',
            'candidates_referral',
            'resume_parsed_data',
            'resume_ingestions',
            'resume_files',
            'candidates_candidate',
            'jobs_jobhistory',
            'jobs_jobcollaborator',
            'jobs_job',
            'requisitions_requisitionapproval',
            'requisitions_requisition',
            'in_app_notifications',
            'email_logs',
            'sub_verticals',
            'departments',
            'accounts_audit_log',
            'audit_logs',
            'accounts_role_permission',
            'accounts_permission',
            'accounts_role',
            'accounts_user_groups',
            'accounts_user_user_permissions',
            'accounts_user',
        ]
        with connection.cursor() as cursor:
            tables_sql = ', '.join(f'"{t}"' for t in tables)
            cursor.execute(f'TRUNCATE TABLE {tables_sql} RESTART IDENTITY CASCADE;')

    # ------------------------------------------------------------------ #
    def _seed(self):
        from apps.accounts.models import Role, Permission, RolePermission, User
        from apps.departments.models import Department, SubVertical
        from apps.requisitions.models import Requisition, RequisitionApproval
        from apps.jobs.models import JobCollaborator
        from apps.candidates.models import Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote
        from apps.interviews.models import Interview, InterviewFeedback, CompetencyRating, FeedbackTemplate

        now = timezone.now()

        # ================================================================ #
        # ROLES & PERMISSIONS                                               #
        # ================================================================ #
        PERMISSION_DEFS = [
            ('VIEW_JOBS', 'View Jobs'),
            ('EDIT_JOBS', 'Edit Jobs'),
            ('SCHEDULE_INTERVIEW', 'Schedule Interviews'),
            ('GIVE_FEEDBACK', 'Submit Interview Feedback'),
            ('VIEW_REPORTS', 'View Reports & Dashboard'),
            ('MANAGE_CANDIDATES', 'Manage Candidates'),
            ('MANAGE_REQUISITIONS', 'Manage Requisitions'),
            ('APPROVE_REQUISITIONS', 'Approve Requisitions'),
            ('MANAGE_USERS', 'Manage Users'),
        ]
        ROLE_PERM_MAP = {
            'admin':          [k for k, _ in PERMISSION_DEFS],
            'hiring_manager': ['VIEW_JOBS', 'APPROVE_REQUISITIONS', 'GIVE_FEEDBACK', 'VIEW_REPORTS', 'MANAGE_CANDIDATES'],
            'recruiter':      ['VIEW_JOBS', 'EDIT_JOBS', 'SCHEDULE_INTERVIEW', 'MANAGE_CANDIDATES', 'MANAGE_REQUISITIONS', 'VIEW_REPORTS'],
            'interviewer':    ['VIEW_JOBS', 'GIVE_FEEDBACK'],
        }

        perm_objs = {}
        for key, label in PERMISSION_DEFS:
            p = Permission.objects.create(key=key, label=label)
            perm_objs[key] = p

        role_objs = {}
        for rname, pkeys in ROLE_PERM_MAP.items():
            role = Role.objects.create(name=rname, is_system_role=True)
            role_objs[rname] = role
            RolePermission.objects.bulk_create([
                RolePermission(role=role, permission=perm_objs[k]) for k in pkeys
            ])

        # ================================================================ #
        # DEPARTMENTS & SUB-VERTICALS                                       #
        # ================================================================ #
        dept_tech = Department.objects.create(name='Technology')
        dept_non_tech = Department.objects.create(name='Non Technical')
        dept_mgmt = Department.objects.create(name='Management')

        # Technology sub-verticals
        sv_backend   = SubVertical.objects.create(department=dept_tech, name='Backend Developer')
        sv_frontend  = SubVertical.objects.create(department=dept_tech, name='Frontend Developer')
        sv_fullstack = SubVertical.objects.create(department=dept_tech, name='Full Stack Developer')
        sv_de        = SubVertical.objects.create(department=dept_tech, name='Data Engineer')
        sv_da        = SubVertical.objects.create(department=dept_tech, name='Data Analyst')
        sv_ds        = SubVertical.objects.create(department=dept_tech, name='Data Scientist')
        sv_qa        = SubVertical.objects.create(department=dept_tech, name='QA (Quality Assurance)')
        sv_devops    = SubVertical.objects.create(department=dept_tech, name='DevOps Engineer')

        # Non-Technical sub-verticals
        sv_research  = SubVertical.objects.create(department=dept_non_tech, name='Research / Data Entry')
        sv_hr        = SubVertical.objects.create(department=dept_non_tech, name='Human Resources – TA, Ops')
        sv_finance   = SubVertical.objects.create(department=dept_non_tech, name='Finance')
        sv_it_admin  = SubVertical.objects.create(department=dept_non_tech, name='IT Admin')
        sv_design    = SubVertical.objects.create(department=dept_non_tech, name='Design')
        sv_marketing = SubVertical.objects.create(department=dept_non_tech, name='Marketing')
        sv_sales     = SubVertical.objects.create(department=dept_non_tech, name='Sales')

        # Management sub-verticals
        sv_pm     = SubVertical.objects.create(department=dept_mgmt, name='Product Management')
        sv_projm  = SubVertical.objects.create(department=dept_mgmt, name='Project Management')
        sv_scrum  = SubVertical.objects.create(department=dept_mgmt, name='Scrum Master')
        sv_ba     = SubVertical.objects.create(department=dept_mgmt, name='Business Analyst')
        sv_exec   = SubVertical.objects.create(department=dept_mgmt, name='Executive Roles')

        self.stdout.write('  ✓ 3 departments, 20 sub-verticals')

        # ================================================================ #
        # ADMIN USER                                                        #
        # ================================================================ #
        admin = User.objects.create_superuser(
            email='admin@ats.com', password=PASSWORD,
            full_name='Admin User', role='admin',
            status='ACTIVE', db_role=role_objs['admin'],
        )

        # ================================================================ #
        # HIRING MANAGERS (20)                                              #
        # ================================================================ #
        hm_data = [
            # (Full Name, department)
            ('Siddhartha Jain',    dept_tech),
            ('Mandakini Satpathy', dept_tech),
            ('Supriya Suri',       dept_tech),
            ('Ankur Pratap',       dept_tech),
            ('Anand Dubey',        dept_tech),
            ('Riya Garg',          dept_tech),
            ('Rupinder Monga',     dept_tech),
            ('Kavita Teekas',      dept_non_tech),
            ('Avinav Goel',        dept_non_tech),
            ('Sidakpreet Singh',   dept_non_tech),
            ('Ayush Grack',        dept_non_tech),
            ('Atul Sharma',        dept_non_tech),
            ('Harleen Kaur',       dept_non_tech),
            ('Gaurav Gupta',       dept_mgmt),
            ('Prashant Agarwal',   dept_mgmt),
            ('Vikash Sharma',      dept_mgmt),
            ('Sharanya Singh',     dept_mgmt),
            ('Sunil Sharma',       dept_mgmt),
            ('Pawan Prabhat',      dept_mgmt),
            ('Paramdeep Singh',    dept_mgmt),
        ]

        hms = []
        for full_name, dept in hm_data:
            u = User.objects.create_user(
                email=f'{_slug(full_name)}@ats.com',
                password=PASSWORD,
                full_name=full_name,
                role='hiring_manager',
                department=dept,
                status='ACTIVE',
                db_role=role_objs['hiring_manager'],
            )
            hms.append(u)

        # Shorthand aliases used later
        hm_tech   = hms[:7]    # tech hiring managers
        hm_nontech = hms[7:13] # non-tech hiring managers
        hm_mgmt   = hms[13:]   # management hiring managers

        self.stdout.write(f'  ✓ {len(hms)} hiring managers')

        # ================================================================ #
        # RECRUITERS (6)                                                    #
        # ================================================================ #
        recruiters_data = [
            ('Mrinali Sharma',   dept_tech),
            ('Trisha Karmakar',  dept_tech),
            ('Swati Aggarwal',   dept_non_tech),
            ('Nikhil Bhatia',    dept_non_tech),
            ('Pooja Rawat',      dept_mgmt),
            ('Shreya Malhotra',  dept_mgmt),
        ]
        recruiters = []
        for full_name, dept in recruiters_data:
            u = User.objects.create_user(
                email=f'{_slug(full_name)}@ats.com',
                password=PASSWORD,
                full_name=full_name,
                role='recruiter',
                department=dept,
                status='ACTIVE',
                db_role=role_objs['recruiter'],
            )
            recruiters.append(u)

        rec1, rec2, rec3, rec4, rec5, rec6 = recruiters
        self.stdout.write(f'  ✓ {len(recruiters)} recruiters')

        # ================================================================ #
        # INTERVIEWERS (5)                                                  #
        # ================================================================ #
        interviewers_data = [
            ('Karan Singh',   dept_tech),
            ('Divya Nair',    dept_tech),
            ('Arpit Kulkarni', dept_non_tech),
            ('Tanu Sharma',   dept_mgmt),
            ('Rajat Mehra',   dept_tech),
        ]
        interviewers = []
        for full_name, dept in interviewers_data:
            u = User.objects.create_user(
                email=f'{_slug(full_name)}@ats.com',
                password=PASSWORD,
                full_name=full_name,
                role='interviewer',
                department=dept,
                status='ACTIVE',
                db_role=role_objs['interviewer'],
            )
            interviewers.append(u)

        iv1, iv2, iv3, iv4, iv5 = interviewers
        self.stdout.write(f'  ✓ {len(interviewers)} interviewers')

        # ================================================================ #
        # REQUISITIONS                                                      #
        # ================================================================ #
        _counters = {'internal': 0, 'client': 0}

        def _gen_code(purpose):
            prefix = 'SHT-INT' if purpose == 'internal' else 'SHT-CLT'
            code = f'{prefix}-{_counters[purpose]:03d}'
            _counters[purpose] += 1
            return code

        def make_req(title, dept, hm, rec, loc, status,
                     skills=None, exp_min=2, exp_max=5,
                     priority='medium', positions=1, employment='permanent'):
            purpose = random.choice(['internal', 'client'])
            req = Requisition.objects.create(
                title=title, department=dept, hiring_manager=hm,
                created_by=rec, location=loc,
                status=status, priority=priority,
                employment_type=employment, requisition_type='new',
                purpose=purpose, purpose_code=_gen_code(purpose),
                positions_count=positions,
                experience_min=exp_min, experience_max=exp_max,
                job_description=f'We are looking for a talented {title} to join our team.',
                skills_required=skills or [],
            )
            if status in ('pending_approval', 'approved', 'rejected'):
                RequisitionApproval.objects.create(
                    requisition=req, action='submitted',
                    acted_by=rec, comments='Please review this requisition.'
                )
            if status == 'approved':
                RequisitionApproval.objects.create(
                    requisition=req, action='approved',
                    acted_by=admin, comments='Approved. Go ahead with hiring.'
                )
            elif status == 'rejected':
                RequisitionApproval.objects.create(
                    requisition=req, action='rejected',
                    acted_by=admin, comments='On hold for budget reasons.'
                )
            return req

        # ---- Technology requisitions ---- #
        req_be1  = make_req('Senior Backend Developer', dept_tech, hms[0], rec1,
                            'Gurgaon', 'approved',
                            skills=['Python', 'Django', 'PostgreSQL', 'Redis', 'REST API'],
                            exp_min=3, exp_max=8, priority='high', positions=2)
        req_be2  = make_req('Backend Developer', dept_tech, hms[1], rec1,
                            'Noida', 'approved',
                            skills=['Node.js', 'Express', 'MongoDB', 'AWS'],
                            exp_min=2, exp_max=5)
        req_fe1  = make_req('Senior Frontend Developer', dept_tech, hms[2], rec2,
                            'Gurgaon', 'approved',
                            skills=['React', 'TypeScript', 'Tailwind CSS', 'GraphQL'],
                            exp_min=3, exp_max=7, priority='high')
        req_fe2  = make_req('Frontend Developer', dept_tech, hms[3], rec2,
                            'Remote', 'approved',
                            skills=['React', 'JavaScript', 'HTML', 'CSS'],
                            exp_min=1, exp_max=4)
        req_fs   = make_req('Full Stack Developer', dept_tech, hms[4], rec1,
                            'Gurgaon', 'approved',
                            skills=['Python', 'React', 'PostgreSQL', 'Docker'],
                            exp_min=3, exp_max=6)
        req_de   = make_req('Data Engineer', dept_tech, hms[5], rec2,
                            'Gurgaon', 'approved',
                            skills=['Python', 'PySpark', 'Airflow', 'AWS Glue', 'SQL'],
                            exp_min=2, exp_max=6)
        req_da   = make_req('Data Analyst', dept_tech, hms[6], rec1,
                            'Noida', 'approved',
                            skills=['Python', 'SQL', 'Pandas', 'Tableau', 'Power BI'],
                            exp_min=1, exp_max=4)
        req_ds   = make_req('Data Scientist', dept_tech, hms[0], rec2,
                            'Gurgaon', 'pending_approval',
                            skills=['Python', 'ML', 'TensorFlow', 'NLP', 'Statistics'],
                            exp_min=3, exp_max=7, priority='high')
        req_qa   = make_req('QA Engineer', dept_tech, hms[1], rec1,
                            'Noida', 'approved',
                            skills=['Selenium', 'Pytest', 'JIRA', 'API Testing'],
                            exp_min=2, exp_max=5)
        req_devops = make_req('DevOps Engineer', dept_tech, hms[2], rec2,
                              'Remote', 'draft',
                              skills=['Kubernetes', 'Docker', 'CI/CD', 'AWS', 'Terraform'],
                              exp_min=3, exp_max=7)

        # ---- Non-Technical requisitions ---- #
        req_hr   = make_req('HR – Talent Acquisition', dept_non_tech, hms[7], rec3,
                            'Gurgaon', 'approved',
                            skills=['Recruiting', 'HRMS', 'Stakeholder Management'],
                            exp_min=2, exp_max=5)
        req_res  = make_req('Research Analyst', dept_non_tech, hms[8], rec3,
                            'Gurgaon', 'approved',
                            skills=['Excel', 'Data Collection', 'Google Sheets'],
                            exp_min=0, exp_max=3)
        req_fin  = make_req('Finance Analyst', dept_non_tech, hms[9], rec4,
                            'Gurgaon', 'approved',
                            skills=['Tally', 'Excel', 'GST', 'Financial Reporting'],
                            exp_min=2, exp_max=5)
        req_des  = make_req('UI/UX Designer', dept_non_tech, hms[10], rec4,
                            'Remote', 'approved',
                            skills=['Figma', 'Adobe XD', 'Prototyping', 'User Research'],
                            exp_min=2, exp_max=5, priority='high')
        req_mkt  = make_req('Digital Marketing Specialist', dept_non_tech, hms[11], rec3,
                            'Gurgaon', 'pending_approval',
                            skills=['SEO', 'Google Analytics', 'Meta Ads', 'Content Strategy'],
                            exp_min=2, exp_max=6)
        req_sales = make_req('Sales Executive', dept_non_tech, hms[12], rec4,
                             'Noida', 'approved',
                             skills=['B2B Sales', 'CRM', 'Negotiation', 'Lead Generation'],
                             exp_min=1, exp_max=4, positions=3)

        # ---- Management requisitions ---- #
        req_pm   = make_req('Product Manager', dept_mgmt, hms[13], rec5,
                            'Gurgaon', 'approved',
                            skills=['Product Roadmap', 'Agile', 'JIRA', 'Stakeholder Management'],
                            exp_min=4, exp_max=8, priority='high')
        req_projm = make_req('Project Manager', dept_mgmt, hms[14], rec5,
                             'Noida', 'approved',
                             skills=['PMP', 'Agile', 'MS Project', 'Risk Management'],
                             exp_min=4, exp_max=9)
        req_scrum = make_req('Scrum Master', dept_mgmt, hms[15], rec6,
                             'Remote', 'approved',
                             skills=['Scrum', 'SAFe', 'Kanban', 'Agile Coaching'],
                             exp_min=3, exp_max=7)
        req_ba   = make_req('Business Analyst', dept_mgmt, hms[16], rec6,
                            'Gurgaon', 'approved',
                            skills=['BRD', 'Use Cases', 'SQL', 'Wireframing', 'Stakeholder Mgmt'],
                            exp_min=2, exp_max=6)
        req_dm   = make_req('Delivery Manager', dept_mgmt, hms[17], rec5,
                            'Noida', 'rejected',
                            skills=['Delivery Management', 'Client Relations', 'Agile'],
                            exp_min=6, exp_max=12, priority='high')
        req_prompt = make_req('Prompt Engineer', dept_tech, hms[6], rec2,
                              'Gurgaon', 'draft',
                              skills=['LLMs', 'Python', 'NLP', 'Langchain'],
                              exp_min=2, exp_max=5)

        all_reqs = [req_be1, req_be2, req_fe1, req_fe2, req_fs, req_de, req_da, req_ds,
                    req_qa, req_devops, req_hr, req_res, req_fin, req_des, req_mkt,
                    req_sales, req_pm, req_projm, req_scrum, req_ba, req_dm, req_prompt]
        self.stdout.write(f'  ✓ {len(all_reqs)} requisitions')

        # ================================================================ #
        # JOBS (auto-created by auto_create_job signal on approval)        #
        # ================================================================ #
        # The requisitions/signals.py auto_create_job handler fires when a
        # RequisitionApproval with action='approved' is saved, creating a Job
        # automatically. We just fetch those here instead of creating manually.
        def _get_job(req):
            req.refresh_from_db()
            return getattr(req, 'job', None)

        job_be1   = _get_job(req_be1)
        job_be2   = _get_job(req_be2)
        job_fe1   = _get_job(req_fe1)
        job_fe2   = _get_job(req_fe2)
        job_fs    = _get_job(req_fs)
        job_de    = _get_job(req_de)
        job_da    = _get_job(req_da)
        job_qa    = _get_job(req_qa)
        job_hr    = _get_job(req_hr)
        job_res   = _get_job(req_res)
        job_fin   = _get_job(req_fin)
        job_des   = _get_job(req_des)
        job_sales = _get_job(req_sales)
        job_pm    = _get_job(req_pm)
        job_projm = _get_job(req_projm)
        job_scrum = _get_job(req_scrum)
        job_ba    = _get_job(req_ba)

        all_jobs = [j for j in [job_be1, job_be2, job_fe1, job_fe2, job_fs, job_de,
                                 job_da, job_qa, job_hr, job_res, job_fin, job_des,
                                 job_sales, job_pm, job_projm, job_scrum, job_ba]
                    if j is not None]

        # Collaborators
        JobCollaborator.objects.create(job=job_be1, user=rec2, added_by=admin)
        JobCollaborator.objects.create(job=job_fe1, user=rec1, added_by=admin)
        JobCollaborator.objects.create(job=job_da,  user=rec3, added_by=admin)
        JobCollaborator.objects.create(job=job_pm,  user=rec5, added_by=admin)
        JobCollaborator.objects.create(job=job_ba,  user=rec6, added_by=admin)

        self.stdout.write(f'  ✓ {len(all_jobs)} jobs')

        # ================================================================ #
        # CANDIDATES (40)                                                   #
        # ================================================================ #
        candidates_raw = [
            # (name, email, phone, location, exp, designation, employer, source, skills, ctc)
            # --- Backend ---
            ('Shubham Jaiswal',    'shubham.jaiswal@gmail.com',    '9621137855', 'Noida',            3.5, 'Backend Engineer',        'NextZen Minds',   'recruiter_upload', ['Python', 'Django', 'PostgreSQL', 'Redis'],           9.0),
            ('Brijendra Singh',    'brijendra.singh@gmail.com',    '9650719860', 'Delhi',             7.0, 'Senior Backend Engineer', 'Infosys',         'linkedin',         ['Python', 'FastAPI', 'AWS', 'Docker', 'Kafka'],       18.0),
            ('Aakash Mehta',       'aakash.mehta@gmail.com',       '9812345678', 'Gurugram',          4.0, 'Software Engineer',       'HCL Technologies','naukri',           ['Java', 'Spring Boot', 'MySQL', 'Microservices'],    10.5),
            ('Rahul Tiwari',       'rahul.tiwari@gmail.com',       '9823456789', 'Pune',              5.5, 'Backend Developer',       'TCS',             'naukri',           ['Python', 'Flask', 'MongoDB', 'REST'],               13.5),
            ('Ankit Verma',        'ankit.verma@gmail.com',        '9834567890', 'Bangalore',         2.5, 'Junior Developer',        'Wipro',           'recruiter_upload', ['Node.js', 'Express', 'MySQL'],                       6.5),
            # --- Frontend ---
            ('Neha Surbhi',        'neha.surbhi@gmail.com',        '9091976436', 'Gurgaon',           6.5, 'Senior Frontend Developer','TechCorp',       'recruiter_upload', ['React', 'TypeScript', 'Redux', 'GraphQL'],          16.0),
            ('Ananya Reddy',       'ananya.reddy@gmail.com',       '9845678901', 'Bangalore',         3.0, 'Frontend Developer',      'StartupXYZ',      'naukri',           ['React', 'JavaScript', 'CSS', 'Tailwind'],            7.5),
            ('Ritika Bansal',      'ritika.bansal@gmail.com',      '9856789012', 'Hyderabad',         4.5, 'React Developer',         'Cognizant',       'linkedin',         ['React', 'TypeScript', 'Jest', 'Webpack'],           11.5),
            ('Vikram Nair',        'vikram.nair@gmail.com',        '9867890123', 'Chennai',           2.0, 'UI Developer',            'Accenture',       'naukri',           ['Vue.js', 'JavaScript', 'Sass', 'Bootstrap'],         5.0),
            ('Preethi Suresh',     'preethi.suresh@gmail.com',     '9878901234', 'Kochi',             5.0, 'Frontend Engineer',       'Oracle',          'referral',         ['React', 'Angular', 'TypeScript', 'CSS Animations'], 13.0),
            # --- Full Stack ---
            ('Lakshmi Prasad',     'lakshmi.prasad@gmail.com',     '9889012345', 'Bangalore',         5.5, 'Full Stack Developer',    'Microsoft',       'linkedin',         ['Python', 'React', 'PostgreSQL', 'AWS', 'Docker'],   14.0),
            ('Shrey Mahajan',      'shrey.mahajan@gmail.com',      '8587911191', 'Gurgaon',           3.5, 'Full Stack Engineer',     'Wipro',           'naukri',           ['Node.js', 'React', 'MongoDB', 'Express'],            9.0),
            ('Deepak Sharma',      'deepak.sharma@gmail.com',      '9890123456', 'Noida',             2.0, 'Software Developer',      'Mphasis',         'recruiter_upload', ['Python', 'Django', 'Vue.js', 'MySQL'],               5.5),
            # --- Data Engineering ---
            ('Paras Arora',        'paras.arora@gmail.com',        '8875616691', 'Gurugram',          4.0, 'Data Engineer',           'Amazon',          'linkedin',         ['Python', 'PySpark', 'Airflow', 'AWS Glue', 'SQL'],  12.0),
            ('Shivam Garg',        'shivam.garg@gmail.com',        '8950627527', 'Gurugram',          4.0, 'Data Engineer',           'Microsoft',       'naukri',           ['Python', 'Kafka', 'Databricks', 'Azure'],           11.5),
            ('Varun Saxena',       'varun.saxena@gmail.com',       '9901234567', 'Pune',              6.0, 'Senior Data Engineer',    'Capgemini',       'linkedin',         ['PySpark', 'Hive', 'Snowflake', 'DBT', 'Airflow'],   16.0),
            # --- Data Analyst ---
            ('Aaryan Sharma',      'aaryan.sharma@gmail.com',      '9912345678', 'Mumbai',            5.0, 'BI Analyst',              'Oracle',          'referral',         ['Power BI', 'SQL', 'DAX', 'Excel'],                  12.5),
            ('Priya Patel',        'priya.patel@gmail.com',        '9923456789', 'Bangalore',         3.0, 'Data Analyst',            'TCS',             'naukri',           ['Python', 'Pandas', 'Tableau', 'SQL'],                7.5),
            ('Vivek Nair',         'vivek.nair@gmail.com',         '9934567890', 'Kochi',             5.5, 'BI Developer',            'Mphasis',         'recruiter_upload', ['Power BI', 'SSRS', 'SQL Server', 'DAX'],            14.0),
            ('Meera Iyer',         'meera.iyer@gmail.com',         '9945678901', 'Coimbatore',        1.5, 'Junior Analyst',          'Freshworks',      'naukri',           ['Excel', 'SQL', 'Google Data Studio'],                4.0),
            # --- Data Science ---
            ('Amit Bose',          'amit.bose@gmail.com',          '9956789012', 'Kolkata',           4.5, 'Data Scientist',          'Cognizant',       'linkedin',         ['Python', 'ML', 'Scikit-learn', 'TensorFlow'],       12.0),
            ('Sneha Verma',        'sneha.verma@gmail.com',        '9967890123', 'Noida',             2.5, 'ML Engineer',             'Accenture',       'recruiter_upload', ['Python', 'NLP', 'HuggingFace', 'PyTorch'],           7.0),
            # --- QA ---
            ('Manmeet Singh',      'manmeet.singh@gmail.com',      '8588070001', 'Delhi',             4.0, 'QA Engineer',             'Deloitte',        'linkedin',         ['Selenium', 'Pytest', 'Postman', 'JIRA'],            10.0),
            ('Ritu Singh',         'ritu.singh@gmail.com',         '9978901234', 'Lucknow',           2.0, 'QA Analyst',              'Tech Mahindra',   'naukri',           ['Manual Testing', 'JIRA', 'Agile', 'TestRail'],       5.0),
            # --- HR / Non-Tech ---
            ('Anjali Gupta',       'anjali.gupta@gmail.com',       '9989012345', 'Hyderabad',         3.5, 'HR Recruiter',            'HCL',             'recruiter_upload', ['Recruiting', 'ATS Tools', 'Naukri', 'LinkedIn'],     8.5),
            ('Deepika Rao',        'deepika.rao@gmail.com',        '9990123456', 'Bangalore',         4.0, 'HR Operations',           'Zoho',            'naukri',           ['HRMS', 'Payroll', 'Compliance', 'Excel'],           10.0),
            # --- Finance ---
            ('Akash Sharma',       'akash.sharma@gmail.com',       '8987654321', 'Jaipur',            6.5, 'Finance Manager',         'NIIT',            'linkedin',         ['Tally', 'SAP FICO', 'GST', 'Financial Modelling'],  17.0),
            ('Visharad Singh',     'visharad.singh@gmail.com',     '7073571941', 'New Delhi',         1.0, 'Finance Executive',       'Startup Inc',     'recruiter_upload', ['Excel', 'Tally', 'Basic Accounting'],               3.0),
            # --- Design ---
            ('Pooja Iyer',         'pooja.iyer@gmail.com',         '9900000001', 'Mumbai',            5.0, 'UI/UX Designer',          'BrandCo',         'linkedin',         ['Figma', 'Adobe XD', 'Sketch', 'Prototyping'],       12.5),
            ('Kiran Kumar',        'kiran.kumar@gmail.com',        '9900000002', 'Chennai',           3.0, 'Graphic Designer',        'IBM',             'naukri',           ['Photoshop', 'Illustrator', 'Figma', 'InDesign'],     7.5),
            # --- Sales & Marketing ---
            ('Sanjay Mehta',       'sanjay.mehta@gmail.com',       '9900000003', 'Delhi',             4.5, 'Sales Manager',           'MediaHouse',      'linkedin',         ['B2B Sales', 'CRM', 'Salesforce', 'Negotiation'],    11.5),
            ('Rahul Mehta',        'rahul.mehta@gmail.com',        '9900000004', 'Pune',              3.0, 'Digital Marketer',        'Capgemini',       'naukri',           ['SEO', 'Google Ads', 'Social Media', 'Analytics'],    7.5),
            # --- Management ---
            ('Kiran Desai',        'kiran.desai@gmail.com',        '9900000005', 'Mumbai',            8.0, 'Product Manager',         'Flipkart',        'referral',         ['Product Roadmap', 'Agile', 'JIRA', 'A/B Testing'],  22.0),
            ('Aryan Kapoor',       'aryan.kapoor@gmail.com',       '9900000006', 'Delhi',             6.0, 'Project Manager',         'Infosys',         'linkedin',         ['PMP', 'Agile', 'Risk Management', 'MS Project'],    16.0),
            ('Nisha Malhotra',     'nisha.malhotra@gmail.com',     '9900000007', 'Gurugram',          5.5, 'Scrum Master',            'Adobe',           'recruiter_upload', ['Scrum', 'SAFe', 'Kanban', 'Agile Coaching'],        14.5),
            ('Rohan Batra',        'rohan.batra@gmail.com',        '9900000008', 'Noida',             4.0, 'Business Analyst',        'Wipro',           'naukri',           ['BRD', 'Use Cases', 'SQL', 'Wireframing'],           10.0),
            ('Simran Kaur',        'simran.kaur@gmail.com',        '9900000009', 'Bangalore',         7.0, 'Delivery Manager',        'TCS',             'linkedin',         ['Delivery Mgmt', 'Client Relations', 'Agile'],        19.5),
            ('Gaurav Joshi',       'gaurav.joshi@gmail.com',       '9900000010', 'Hyderabad',         3.5, 'Business Analyst',        'Accenture',       'naukri',           ['Business Analysis', 'BPMN', 'SQL', 'Agile'],         9.0),
            ('Priyanka Dubey',     'priyanka.dubey@gmail.com',     '9900000011', 'Mumbai',            5.0, 'Product Analyst',         'Ola',             'referral',         ['Analytics', 'SQL', 'Product Thinking', 'Tableau'],  13.0),
            ('Suresh Babu',        'suresh.babu@gmail.com',        '9900000012', 'Chennai',           2.5, 'Junior BA',               'Mindtree',        'recruiter_upload', ['Excel', 'SQL', 'Agile Basics', 'Visio'],             6.0),
        ]

        candidates = []
        for (name, email, phone, location, exp, designation, employer, source,
             skills, ctc) in candidates_raw:
            c = Candidate.objects.create(
                full_name=name, email=email, phone=phone, location=location,
                total_experience_years=exp, designation=designation,
                current_employer=employer, source=source, skills=skills,
                current_ctc_lakhs=ctc,
                expected_ctc_lakhs=round(ctc * 1.25, 1),
                notice_period_days=random.choice([0, 15, 30, 45, 60, 90]),
                parsing_status='skipped',
                created_by=rec1,
            )
            candidates.append(c)

        self.stdout.write(f'  ✓ {len(candidates)} candidates')

        # ================================================================ #
        # PIPELINE MAPPINGS                                                 #
        # ================================================================ #
        # Mapping: (candidate_index, job, stage)
        pipeline = [
            # Backend job 1 (Senior Backend Developer)
            (0,  job_be1, 'INTERVIEW'),
            (1,  job_be1, 'SHORTLISTED'),
            (2,  job_be1, 'APPLIED'),
            (3,  job_be1, 'OFFERED'),
            (4,  job_be1, 'DROPPED'),
            # Backend job 2
            (0,  job_be2, 'SHORTLISTED'),
            (2,  job_be2, 'INTERVIEW'),
            (4,  job_be2, 'APPLIED'),
            # Frontend job 1
            (5,  job_fe1, 'INTERVIEW'),
            (6,  job_fe1, 'SHORTLISTED'),
            (7,  job_fe1, 'OFFERED'),
            (8,  job_fe1, 'APPLIED'),
            (9,  job_fe1, 'JOINED'),
            # Frontend job 2
            (6,  job_fe2, 'INTERVIEW'),
            (8,  job_fe2, 'SHORTLISTED'),
            # Full Stack
            (10, job_fs,  'INTERVIEW'),
            (11, job_fs,  'SHORTLISTED'),
            (12, job_fs,  'APPLIED'),
            # Data Engineer
            (13, job_de,  'INTERVIEW'),
            (14, job_de,  'SHORTLISTED'),
            (15, job_de,  'OFFERED'),
            # Data Analyst
            (16, job_da,  'INTERVIEW'),
            (17, job_da,  'SHORTLISTED'),
            (18, job_da,  'INTERVIEW'),
            (19, job_da,  'APPLIED'),
            # QA
            (22, job_qa,  'INTERVIEW'),
            (23, job_qa,  'SHORTLISTED'),
            # HR
            (24, job_hr,  'INTERVIEW'),
            (25, job_hr,  'SHORTLISTED'),
            # Research
            (27, job_res, 'APPLIED'),
            (19, job_res, 'SHORTLISTED'),
            # Finance
            (26, job_fin, 'INTERVIEW'),
            (27, job_fin, 'APPLIED'),
            # Design
            (28, job_des, 'INTERVIEW'),
            (29, job_des, 'SHORTLISTED'),
            # Sales
            (30, job_sales, 'INTERVIEW'),
            (31, job_sales, 'OFFERED'),
            # Product Manager
            (32, job_pm,   'INTERVIEW'),
            (38, job_pm,   'SHORTLISTED'),
            # Project Manager
            (33, job_projm, 'INTERVIEW'),
            (36, job_projm, 'SHORTLISTED'),
            # Scrum Master
            (34, job_scrum, 'INTERVIEW'),
            # Business Analyst
            (35, job_ba,   'INTERVIEW'),
            (37, job_ba,   'SHORTLISTED'),
            (39, job_ba,   'APPLIED'),
        ]

        mappings = []
        for cand_idx, job, stage in pipeline:
            extra = {}
            if stage == 'INTERVIEW':
                extra['current_interview_round'] = 'R1'
            elif stage == 'DROPPED':
                extra['drop_reason'] = 'REJECTED'
            elif stage == 'OFFERED':
                extra['offer_status'] = 'OFFER_SENT'
            m = CandidateJobMapping.objects.create(
                candidate=candidates[cand_idx], job=job,
                macro_stage=stage, moved_by=rec1, **extra
            )
            PipelineStageHistory.objects.create(
                mapping=m, from_macro_stage='', to_macro_stage=stage,
                moved_by=rec1, remarks='Initial assignment'
            )
            mappings.append(m)

        self.stdout.write(f'  ✓ {len(mappings)} pipeline mappings')

        # ================================================================ #
        # CANDIDATE NOTES                                                   #
        # ================================================================ #
        notes_data = [
            (candidates[0],  rec1, 'Strong Python background, good system design knowledge. Follow up next week.'),
            (candidates[1],  rec2, 'Requested 60-day notice period — check with HM before proceeding.'),
            (candidates[5],  rec1, 'Excellent React skills. Portfolio is impressive. Fast-track this one.'),
            (candidates[10], rec2, 'Full-stack profile. Comfortable with both Python and React. Great culture fit.'),
            (candidates[13], rec3, 'Strong data engineering background. Has worked on large-scale Spark pipelines.'),
            (candidates[16], rec1, 'BI skills are solid. Has Power BI certification. HM loved the profile.'),
            (candidates[20], rec2, 'ML experience in NLP domain. Good publications record.'),
            (candidates[28], rec4, 'Great portfolio. Specialises in B2C product design with strong research approach.'),
            (candidates[32], rec5, 'Led product for a Series B startup. Strong roadmap and stakeholder experience.'),
            (candidates[33], rec6, 'PMP certified. Has handled 10+ person teams. Good for senior PM role.'),
        ]
        for cand, user, content in notes_data:
            CandidateNote.objects.create(candidate=cand, user=user, content=content)

        self.stdout.write(f'  ✓ {len(notes_data)} candidate notes')

        # ================================================================ #
        # FEEDBACK TEMPLATES                                                #
        # ================================================================ #
        tech_template = FeedbackTemplate.objects.create(
            name='Standard Technical Interview',
            is_default=True,
            created_by=admin,
            competencies=[
                {'name': 'Problem Solving',   'max_rating': 5},
                {'name': 'Technical Skills',  'max_rating': 5},
                {'name': 'Communication',     'max_rating': 5},
                {'name': 'Culture Fit',       'max_rating': 5},
                {'name': 'System Design',     'max_rating': 5},
            ]
        )
        mgmt_template = FeedbackTemplate.objects.create(
            name='Management / Leadership Interview',
            is_default=False,
            created_by=admin,
            competencies=[
                {'name': 'Leadership',              'max_rating': 5},
                {'name': 'Stakeholder Management',  'max_rating': 5},
                {'name': 'Communication',           'max_rating': 5},
                {'name': 'Strategic Thinking',      'max_rating': 5},
                {'name': 'Culture Fit',             'max_rating': 5},
            ]
        )
        design_template = FeedbackTemplate.objects.create(
            name='Design / Creative Interview',
            is_default=False,
            created_by=admin,
            competencies=[
                {'name': 'Portfolio Quality',  'max_rating': 5},
                {'name': 'Design Thinking',    'max_rating': 5},
                {'name': 'Communication',      'max_rating': 5},
                {'name': 'Tool Proficiency',   'max_rating': 5},
            ]
        )

        # ================================================================ #
        # INTERVIEWS                                                        #
        # ================================================================ #
        interview_mappings = [m for m in mappings if m.macro_stage == 'INTERVIEW']

        interview_configs = [
            # (mapping, round_no, label, interviewer, days_offset, mode, status, template)
            (interview_mappings[0],  1, 'Round 1 – Technical Screening',  iv1, -5,  'virtual',       'completed', tech_template),
            (interview_mappings[0],  2, 'Round 2 – System Design',        iv2, -2,  'virtual',       'completed', tech_template),
            (interview_mappings[1],  1, 'Round 1 – Technical Screening',  iv1,  2,  'virtual',       'scheduled', tech_template),
            (interview_mappings[2],  1, 'Round 1 – Coding Assessment',    iv3, -3,  'virtual',       'completed', tech_template),
            (interview_mappings[3],  1, 'Round 1 – Portfolio Review',     iv2,  1,  'virtual',       'scheduled', tech_template),
            (interview_mappings[4],  1, 'Round 1 – Technical Screening',  iv1,  3,  'virtual',       'scheduled', tech_template),
            (interview_mappings[5],  1, 'Round 1 – Technical Screening',  iv4, -1,  'face_to_face',  'completed', mgmt_template),
            (interview_mappings[6],  1, 'Round 1 – Technical Assessment', iv3,  4,  'virtual',       'scheduled', tech_template),
            (interview_mappings[7],  1, 'Round 1 – HR Screening',         iv4,  2,  'telephonic',    'scheduled', mgmt_template),
            (interview_mappings[8],  1, 'Round 1 – Technical Screening',  iv1, -4,  'virtual',       'completed', tech_template),
            (interview_mappings[9],  1, 'Round 1 – Case Study Round',     iv2,  5,  'virtual',       'scheduled', mgmt_template),
            (interview_mappings[10], 1, 'Round 1 – Design Portfolio',     iv3, -2,  'virtual',       'completed', design_template),
            (interview_mappings[11], 1, 'Round 1 – Sales Roleplay',       iv5,  1,  'face_to_face',  'scheduled', mgmt_template),
            (interview_mappings[12], 1, 'Round 1 – Product Case Study',   iv4, -6,  'virtual',       'completed', mgmt_template),
            (interview_mappings[12], 2, 'Round 2 – Leadership Discussion',hms[13], -3, 'face_to_face','completed', mgmt_template),
            (interview_mappings[13], 1, 'Round 1 – Technical Assessment', iv1,  6,  'virtual',       'scheduled', tech_template),
            (interview_mappings[14], 1, 'Round 1 – Data Engineering Test',iv2, -1,  'virtual',       'completed', tech_template),
            (interview_mappings[15], 1, 'Round 1 – PM Case Study',        iv4,  2,  'virtual',       'scheduled', mgmt_template),
        ]

        created_interviews = []
        for (mapping, rnum, label, interviewer, days_offset,
             mode, ivstatus, template) in interview_configs:
            scheduled_at = now + timedelta(days=days_offset)
            iv_obj = Interview.objects.create(
                mapping=mapping, round_number=rnum, round_label=label,
                interviewer=interviewer, scheduled_at=scheduled_at,
                duration_minutes=60, mode=mode,
                meeting_link='https://meet.google.com/abc-defg-hij' if mode == 'virtual' else '',
                feedback_template=template, status=ivstatus,
                created_by=rec1,
            )
            created_interviews.append((iv_obj, interviewer, template, ivstatus))

        self.stdout.write(f'  ✓ {len(created_interviews)} interviews')

        # ================================================================ #
        # INTERVIEW FEEDBACK (for completed interviews)                     #
        # ================================================================ #
        feedback_params = [
            # (interview_obj, overall_rating, recommendation, strengths, weaknesses)
            (0,  4, 'proceed',  'Excellent Python skills and clear system design thinking.',          'Needs more exposure to distributed caching patterns.'),
            (1,  5, 'proceed',  'Outstanding system design. Clear thought process. Strong AWS knowledge.', 'Minor gaps in cost-optimisation strategies.'),
            (2,  3, 'hold',     'Solid coding fundamentals. Handles easy-medium problems well.',       'Struggled with graph algorithms. Needs more prep.'),
            (5,  4, 'proceed',  'Strong stakeholder management experience. Excellent communicator.',   'Limited exposure to product roadmap ownership.'),
            (8,  3, 'hold',     'Good domain knowledge of HR processes.',                              'Needs stronger data-driven approach to hiring.'),
            (9,  5, 'proceed',  'Exceptional React skills. Clean, maintainable code. Great team fit.', 'None significant.'),
            (11, 4, 'proceed',  'Portfolio is impressive. Strong user research and prototyping skills.','Transition animations could be more polished.'),
            (12, 4, 'proceed',  'Great sales instinct. Handles objections confidently.',               'Needs to improve product knowledge.'),
            (13, 5, 'proceed',  'Strong product thinking. Excellent framework for prioritisation.',    'None.'),
            (14, 4, 'proceed',  'Leadership presence is strong. Team inspires confidence in her.',    'Needs broader exposure to enterprise clients.'),
            (16, 4, 'proceed',  'Strong Spark and Airflow knowledge. Has worked on petabyte-scale data.','Unfamiliar with Iceberg table format.'),
        ]

        for fb_idx, overall, rec_str, strengths, weaknesses in feedback_params:
            if fb_idx >= len(created_interviews):
                continue
            iv_obj, interviewer, template, ivstatus = created_interviews[fb_idx]
            if ivstatus != 'completed':
                continue
            fb = InterviewFeedback.objects.create(
                interview=iv_obj, interviewer=interviewer,
                overall_rating=overall, recommendation=rec_str,
                strengths=strengths, weaknesses=weaknesses,
                comments='Candidate assessed thoroughly across all competencies.',
            )
            for comp in template.competencies:
                CompetencyRating.objects.create(
                    feedback=fb,
                    competency_name=comp['name'],
                    rating=min(5, max(1, overall + random.randint(-1, 1))),
                    notes='Assessed during the interview.',
                )

        self.stdout.write('  ✓ Interview feedback created')

        # ================================================================ #
        # SUMMARY                                                           #
        # ================================================================ #
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('════════════════════════════════════'))
        self.stdout.write(self.style.SUCCESS('  Seed complete'))
        self.stdout.write(self.style.SUCCESS('════════════════════════════════════'))
        self.stdout.write(f'  Admin         : admin@ats.com / {PASSWORD}')
        self.stdout.write(f'  HM (sample)   : {_slug(hm_data[0][0])}@ats.com / {PASSWORD}')
        self.stdout.write(f'  Recruiter     : {_slug(recruiters_data[0][0])}@ats.com / {PASSWORD}')
        self.stdout.write(f'  Interviewer   : {_slug(interviewers_data[0][0])}@ats.com / {PASSWORD}')
        self.stdout.write(f'  Hiring Mgrs   : {len(hms)}')
        self.stdout.write(f'  Recruiters    : {len(recruiters)}')
        self.stdout.write(f'  Interviewers  : {len(interviewers)}')
        self.stdout.write(f'  Departments   : 3  (Technology, Non Technical, Management)')
        self.stdout.write(f'  Sub-Verticals : 20')
        self.stdout.write(f'  Requisitions  : {len(all_reqs)}')
        self.stdout.write(f'  Jobs          : {len(all_jobs)}')
        self.stdout.write(f'  Candidates    : {len(candidates)}')
        self.stdout.write(f'  Mappings      : {len(mappings)}')
        self.stdout.write(f'  Interviews    : {len(created_interviews)}')
        self.stdout.write(self.style.SUCCESS('════════════════════════════════════'))
