from django.db import migrations
import django.contrib.postgres.fields


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0010_add_candidate_job_comment'),
        ('candidates', '0010_candidatenote_edit_history'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidate',
            name='tags',
            field=django.contrib.postgres.fields.ArrayField(
                base_field=django.db.models.CharField(max_length=100),
                blank=True,
                default=list,
                size=None,
            ),
        ),
    ]
