from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0016_resume_file_hash'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidatejobmapping',
            name='rejected_from_stage',
            field=models.CharField(blank=True, max_length=15),
        ),
    ]
