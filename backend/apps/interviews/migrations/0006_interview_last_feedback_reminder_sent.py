from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interviews', '0005_add_end_time_computed_status_decision'),
    ]

    operations = [
        migrations.AddField(
            model_name='interview',
            name='last_feedback_reminder_sent',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
