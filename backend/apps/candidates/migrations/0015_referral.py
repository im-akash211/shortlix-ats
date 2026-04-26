import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0014_merge_0012_add_action_reason_0013_ai_match_score'),
        ('jobs', '0006_rename_job_codes_sht_format'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Referral',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('employee_name', models.CharField(max_length=255)),
                ('employee_id', models.CharField(max_length=100)),
                ('parsed_data', models.JSONField(default=dict)),
                ('raw_text', models.TextField(blank=True)),
                ('resume_file', models.FileField(blank=True, null=True, upload_to='ats/referrals/')),
                ('original_filename', models.CharField(blank=True, max_length=255)),
                ('file_type', models.CharField(blank=True, max_length=4)),
                ('file_size', models.PositiveIntegerField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined')],
                    db_index=True,
                    default='pending',
                    max_length=10,
                )),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('candidate', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='referrals',
                    to='candidates.candidate',
                )),
                ('job', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referrals',
                    to='jobs.job',
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_referrals',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
