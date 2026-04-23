from django.db import migrations


def clear_education_hr_fields(apps, schema_editor):
    Candidate = apps.get_model('candidates', 'Candidate')
    Candidate.objects.all().update(
        tenth_board='',
        tenth_percentage=None,
        twelfth_board='',
        twelfth_percentage=None,
        graduation_course='',
        graduation_college='',
        graduation_year=None,
        graduation_percentage=None,
        qualifying_exam='',
        qualifying_rank='',
        post_graduation_course='',
        post_graduation_college='',
        post_graduation_year=None,
        post_graduation_percentage=None,
        post_qualifying_exam='',
        post_qualifying_rank='',
        ctc_fixed_lakhs=None,
        ctc_variable_lakhs=None,
        current_ctc_lakhs=None,
        expected_ctc_lakhs=None,
        offers_in_hand='',
        notice_period_days=None,
        notice_period_status='',
        reason_for_change='',
        native_location='',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0010_add_candidate_job_comment'),
        ('candidates', '0010_candidatenote_edit_history'),
    ]

    operations = [
        migrations.RunPython(clear_education_hr_fields, migrations.RunPython.noop),
    ]
