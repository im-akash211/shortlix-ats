import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from apps.accounts.models import User
from apps.departments.models import Department, SubVertical
from apps.requisitions.models import Requisition, RequisitionApproval
from apps.jobs.models import Job
from apps.candidates.models import Candidate, CandidateJobMapping, CandidateNote
from apps.interviews.models import FeedbackTemplate, Interview, InterviewFeedback, CompetencyRating
from django.utils import timezone
from datetime import timedelta

admin = User.objects.get(email='admin@ats.com')
hm1 = User.objects.get(email='amit.verma@ats.com')
hm2 = User.objects.get(email='sneha.patel@ats.com')
iv1 = User.objects.get(email='karan.singh@ats.com')
iv2 = User.objects.get(email='divya.nair@ats.com')
eng = Department.objects.get(name='Engineering')
mkt = Department.objects.get(name='Marketing')

r1 = Requisition.objects.get(title='Senior Backend Engineer')
r2 = Requisition.objects.get(title='React Frontend Developer')
r3 = Requisition.objects.get(title='Growth Marketing Manager')

j1, _ = Job.objects.get_or_create(requisition=r1, defaults={
    'job_code': 'JOB-001', 'title': 'Senior Backend Engineer', 'department': eng,
    'hiring_manager': hm1, 'location': 'Bangalore, India',
    'skills_required': ['Python', 'Django', 'PostgreSQL', 'REST API'],
    'job_description': 'Build scalable APIs and backend services.',
    'experience_min': 3, 'experience_max': 7, 'status': 'open'
})
j2, _ = Job.objects.get_or_create(requisition=r2, defaults={
    'job_code': 'JOB-002', 'title': 'React Frontend Developer', 'department': eng,
    'hiring_manager': hm1, 'location': 'Remote',
    'skills_required': ['React', 'TypeScript', 'Tailwind CSS'],
    'job_description': 'Build performant UIs for our SaaS platform.',
    'experience_min': 2, 'experience_max': 5, 'status': 'open'
})
j3, _ = Job.objects.get_or_create(requisition=r3, defaults={
    'job_code': 'JOB-003', 'title': 'Growth Marketing Manager', 'department': mkt,
    'hiring_manager': hm2, 'location': 'Mumbai, India',
    'skills_required': ['SEO', 'Google Analytics', 'Content Strategy'],
    'job_description': 'Lead growth initiatives and drive user acquisition.',
    'experience_min': 4, 'experience_max': 8, 'status': 'open'
})
print('Jobs:', j1.job_code, j2.job_code, j3.job_code)

cands_data = [
    ('Arjun Kapoor', 'arjun.kapoor@gmail.com', '+91 98765 43210', 'Backend Engineer', 'TechCorp', 'Bangalore', 4.5, ['Python', 'Django', 'PostgreSQL', 'Redis']),
    ('Neha Gupta', 'neha.gupta@gmail.com', '+91 87654 32109', 'Senior Software Engineer', 'InfoSys', 'Hyderabad', 5.0, ['Python', 'Flask', 'AWS', 'Docker']),
    ('Rahul Joshi', 'rahul.joshi@gmail.com', '+91 76543 21098', 'Software Developer', 'Wipro', 'Pune', 3.5, ['Java', 'Spring Boot', 'MySQL']),
    ('Ananya Reddy', 'ananya.reddy@gmail.com', '+91 65432 10987', 'Frontend Developer', 'StartupXYZ', 'Bangalore', 2.5, ['React', 'TypeScript', 'CSS', 'Tailwind']),
    ('Vikram Nair', 'vikram.nair@gmail.com', '+91 54321 09876', 'UI Developer', 'Accenture', 'Chennai', 3.0, ['React', 'Vue.js', 'JavaScript']),
    ('Pooja Iyer', 'pooja.iyer@gmail.com', '+91 43210 98765', 'Marketing Lead', 'BrandCo', 'Mumbai', 6.0, ['SEO', 'Google Analytics', 'Content', 'SEM']),
    ('Sanjay Mehta', 'sanjay.mehta@gmail.com', '+91 32109 87654', 'Digital Marketer', 'MediaHouse', 'Delhi', 4.0, ['SEO', 'Social Media', 'Analytics']),
    ('Lakshmi Prasad', 'lakshmi.prasad@gmail.com', '+91 21098 76543', 'Full Stack Developer', 'MicroSoft', 'Bangalore', 5.5, ['Python', 'React', 'PostgreSQL', 'AWS']),
    ('Deepak Sharma', 'deepak.sharma@gmail.com', '+91 11111 22222', 'Backend Developer', 'HCL', 'Noida', 2.0, ['Python', 'Django', 'MongoDB']),
    ('Ritika Bansal', 'ritika.bansal@gmail.com', '+91 99999 88888', 'React Developer', 'Cognizant', 'Bangalore', 4.0, ['React', 'JavaScript', 'Redux', 'CSS']),
]

cands = []
for name, email, phone, desig, employer, loc, exp, skills in cands_data:
    c, _ = Candidate.objects.get_or_create(email=email, defaults={
        'full_name': name, 'phone': phone, 'designation': desig,
        'current_employer': employer, 'location': loc,
        'total_experience_years': exp, 'skills': skills,
        'current_ctc_lakhs': exp * 2.5, 'expected_ctc_lakhs': exp * 3,
        'notice_period_days': 30, 'source': 'naukri',
        'parsing_status': 'skipped', 'created_by': admin
    })
    cands.append(c)
print(f'Candidates: {len(cands)}')

mappings_data = [
    (cands[0], j1, 'interview'),
    (cands[1], j1, 'shortlisted'),
    (cands[2], j1, 'pending'),
    (cands[7], j1, 'selected'),
    (cands[8], j1, 'rejected'),
    (cands[3], j2, 'interview'),
    (cands[4], j2, 'shortlisted'),
    (cands[9], j2, 'offered'),
    (cands[5], j3, 'interview'),
    (cands[6], j3, 'pending'),
]

map_objs = []
for cand, job, stage in mappings_data:
    m, _ = CandidateJobMapping.objects.get_or_create(
        candidate=cand, job=job, defaults={'stage': stage, 'moved_by': admin}
    )
    map_objs.append(m)
print(f'Mappings: {len(map_objs)}')

CandidateNote.objects.get_or_create(
    candidate=cands[0], user=admin,
    defaults={'content': 'Strong backend skills. Cleared technical screening.'}
)
CandidateNote.objects.get_or_create(
    candidate=cands[3], user=admin,
    defaults={'content': 'Excellent React knowledge. Portfolio looks impressive.'}
)
CandidateNote.objects.get_or_create(
    candidate=cands[5], user=admin,
    defaults={'content': '7 years in marketing. Strong SEO background.'}
)
print('Notes done')

ft, _ = FeedbackTemplate.objects.get_or_create(name='Standard Engineering', defaults={
    'competencies': ['Problem Solving', 'Communication', 'Technical Skills', 'Culture Fit'],
    'is_default': True, 'created_by': admin
})

now = timezone.now()
interviews_data = [
    (map_objs[0], 1, 'Round 1 - Technical', iv1, now + timedelta(days=2), 'virtual', 'scheduled'),
    (map_objs[3], 1, 'Round 1 - Technical', iv1, now - timedelta(days=3), 'virtual', 'completed'),
    (map_objs[3], 2, 'Round 2 - Managerial', iv2, now - timedelta(days=1), 'face_to_face', 'completed'),
    (map_objs[5], 1, 'Round 1 - Technical', iv2, now + timedelta(days=1), 'virtual', 'scheduled'),
    (map_objs[4], 1, 'Round 1 - Portfolio Review', iv1, now - timedelta(days=5), 'virtual', 'completed'),
]

ivs = []
for mapping, rnum, label, interviewer, sched_at, mode, status in interviews_data:
    iv, _ = Interview.objects.get_or_create(
        mapping=mapping, round_number=rnum,
        defaults={
            'round_label': label, 'interviewer': interviewer, 'scheduled_at': sched_at,
            'duration_minutes': 60, 'mode': mode, 'feedback_template': ft,
            'status': status, 'created_by': admin
        }
    )
    ivs.append(iv)
print(f'Interviews: {len(ivs)}')

fb1, created = InterviewFeedback.objects.get_or_create(interview=ivs[1], defaults={
    'interviewer': iv1, 'overall_rating': 4, 'recommendation': 'proceed',
    'strengths': 'Excellent Python skills, good system design knowledge.',
    'weaknesses': 'Could improve on distributed systems concepts.',
    'comments': 'Strong candidate, recommended for next round.'
})
if created:
    CompetencyRating.objects.create(feedback=fb1, competency_name='Technical Skills', rating=4, notes='Strong in Python and Django')
    CompetencyRating.objects.create(feedback=fb1, competency_name='Problem Solving', rating=5, notes='Great analytical thinking')
    CompetencyRating.objects.create(feedback=fb1, competency_name='Communication', rating=4, notes='Clear and concise')

fb2, _ = InterviewFeedback.objects.get_or_create(interview=ivs[4], defaults={
    'interviewer': iv1, 'overall_rating': 2, 'recommendation': 'reject',
    'strengths': 'Basic understanding of the domain.',
    'weaknesses': 'Not enough experience. Poor problem solving.',
    'comments': 'Does not meet our requirements at this time.'
})

print('Feedback done')
print('All dummy data created successfully!')
