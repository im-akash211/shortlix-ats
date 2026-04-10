from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resumes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='resumeingestion',
            name='file_hash',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='SHA-256 hex digest of file contents — used for exact duplicate detection',
                max_length=64,
                null=True,
                unique=True,
            ),
        ),
    ]
