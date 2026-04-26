from django.db import migrations, models


def rename_job_codes(apps, schema_editor):
    Job = apps.get_model('jobs', 'Job')
    # Assign new codes ordered by creation date to preserve original sequence
    internal_jobs = list(
        Job.objects.select_related('requisition')
        .filter(requisition__purpose='internal')
        .order_by('created_at')
    )
    client_jobs = list(
        Job.objects.select_related('requisition')
        .filter(requisition__purpose='client')
        .order_by('created_at')
    )

    for i, job in enumerate(internal_jobs, start=1):
        job.job_code = f'SHT-INT-{i:03d}'
        job.save(update_fields=['job_code'])

    for i, job in enumerate(client_jobs, start=1):
        job.job_code = f'SHT-CLT-{i:03d}'
        job.save(update_fields=['job_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0005_migrate_hidden_to_abandoned'),
    ]

    operations = [
        migrations.AlterField(
            model_name='job',
            name='job_code',
            field=models.CharField(max_length=15, unique=True),
        ),
        migrations.RunPython(rename_job_codes, migrations.RunPython.noop),
    ]
