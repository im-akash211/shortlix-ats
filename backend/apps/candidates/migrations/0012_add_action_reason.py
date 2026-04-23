from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0011_add_candidate_tags'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidatejobmapping',
            name='action_reason',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
