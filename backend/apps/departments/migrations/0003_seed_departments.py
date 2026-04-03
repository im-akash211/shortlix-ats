import uuid
from django.db import migrations


SEED_DATA = {
    "Engineering": {
        "Frontend Engineering": ["React / Next.js", "Angular", "Vue.js"],
        "Backend Engineering": ["Python / Django", "Node.js", "Java / Spring", "Go"],
        "Mobile Engineering": ["iOS (Swift)", "Android (Kotlin)", "React Native / Flutter"],
        "DevOps & Infrastructure": ["Cloud (AWS / GCP)", "CI/CD & Automation", "Site Reliability"],
        "QA & Testing": ["Manual Testing", "Automation Testing", "Performance Testing"],
        "Security Engineering": ["AppSec", "Infrastructure Security"],
    },
    "Product Management": {
        "Core Product": ["Platform & Growth", "Consumer Products"],
        "Enterprise Product": ["B2B SaaS", "Integrations & APIs"],
    },
    "Data & Analytics": {
        "Data Engineering": ["Data Pipelines", "Data Warehousing"],
        "Data Science & ML": ["Machine Learning", "AI / GenAI", "Business Intelligence"],
    },
    "Design (UX/UI)": {
        "Product Design": ["UI Design", "UX Research"],
        "Brand & Marketing Design": ["Visual Design", "Motion & Video"],
    },
    "Sales": {
        "Inside Sales": ["SMB Sales", "Mid-Market Sales"],
        "Enterprise Sales": ["Key Accounts", "Pre-Sales / Solutions"],
    },
    "Marketing": {
        "Growth & Digital Marketing": ["SEO / SEM", "Performance Marketing"],
        "Content & Brand": ["Content Marketing", "PR & Communications"],
    },
    "Finance": {
        "Financial Planning & Analysis": ["Budgeting & Forecasting", "Revenue Operations"],
        "Accounting & Compliance": ["Taxation", "Audit & Controls"],
    },
    "Human Resources": {
        "Talent Acquisition": ["Tech Hiring", "Non-Tech Hiring"],
        "HR Business Partnering": ["People Ops", "L&D / Training"],
    },
    "Operations": {
        "Business Operations": ["Strategic Ops", "Vendor Management"],
        "IT & Internal Tools": ["IT Support", "Corporate Systems"],
    },
    "Customer Success": {
        "Onboarding": ["SMB Onboarding", "Enterprise Onboarding"],
        "Account Management": ["Renewals", "Customer Education"],
    },
}


def seed_departments(apps, schema_editor):
    Department = apps.get_model('departments', 'Department')
    SubVertical = apps.get_model('departments', 'SubVertical')

    for dept_name, sv1_map in SEED_DATA.items():
        dept, _ = Department.objects.get_or_create(name=dept_name)
        for sv1_name, sv2_list in sv1_map.items():
            sv1, _ = SubVertical.objects.get_or_create(department=dept, name=sv1_name, defaults={'parent': None})
            for sv2_name in sv2_list:
                SubVertical.objects.get_or_create(department=dept, name=sv2_name, defaults={'parent': sv1})


def unseed_departments(apps, schema_editor):
    Department = apps.get_model('departments', 'Department')
    all_names = list(SEED_DATA.keys())
    Department.objects.filter(name__in=all_names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0002_subvertical_parent'),
    ]

    operations = [
        migrations.RunPython(seed_departments, reverse_code=unseed_departments),
    ]
