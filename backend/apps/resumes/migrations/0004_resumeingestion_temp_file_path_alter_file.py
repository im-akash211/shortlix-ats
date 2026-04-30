from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resumes', '0003_alter_resumeingestion_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='resumeingestion',
            name='temp_file',
            field=models.FileField(
                blank=True,
                upload_to='ats/temp_resumes/',
                help_text='Staging file — moved to ats/resumes/ on convert, deleted on discard',
            ),
        ),
        migrations.AlterField(
            model_name='resumeingestion',
            name='file',
            field=models.FileField(upload_to='ats/resumes/', blank=True),
        ),
    ]
