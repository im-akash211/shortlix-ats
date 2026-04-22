from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('interviews', '0003_add_r3_round_name'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='interview',
            name='unique_interview_round',
        ),
    ]
