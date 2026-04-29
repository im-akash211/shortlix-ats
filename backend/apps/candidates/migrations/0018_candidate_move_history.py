from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0017_add_rejected_from_stage'),
    ]

    operations = [
        # Add archive fields
        migrations.AddField(
            model_name='candidatejobmapping',
            name='is_archived',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='candidatejobmapping',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='candidatejobmapping',
            name='previous_mapping',
            field=models.OneToOneField(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='next_mapping',
                to='candidates.candidatejobmapping',
            ),
        ),
        # Drop old unconditional unique constraint
        migrations.RemoveConstraint(
            model_name='candidatejobmapping',
            name='unique_candidate_job',
        ),
        # Add partial unique constraint (only active mappings)
        migrations.AddConstraint(
            model_name='candidatejobmapping',
            constraint=models.UniqueConstraint(
                fields=['candidate', 'job'],
                condition=models.Q(is_archived=False),
                name='unique_active_candidate_job',
            ),
        ),
    ]
