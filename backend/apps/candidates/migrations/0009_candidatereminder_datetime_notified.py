from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0008_candidate_education_hr_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='candidatereminder',
            name='remind_at',
            field=models.DateTimeField(),
        ),
        migrations.AddField(
            model_name='candidatereminder',
            name='notified',
            field=models.BooleanField(default=False),
        ),
    ]
