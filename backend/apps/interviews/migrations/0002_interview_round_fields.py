# Adds round_name, round_status, and round_result to Interview.
# All three are nullable so existing interview records are unaffected.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interviews', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='interview',
            name='round_name',
            field=models.CharField(
                blank=True,
                choices=[
                    ('R1', 'Round 1'),
                    ('R2', 'Round 2'),
                    ('CLIENT', 'Client Round'),
                    ('CDO', 'CDO Round'),
                    ('MGMT', 'Management Round'),
                ],
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='interview',
            name='round_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('SCHEDULED', 'Scheduled'),
                    ('COMPLETED', 'Completed'),
                    ('ON_HOLD', 'On Hold'),
                ],
                max_length=15,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='interview',
            name='round_result',
            field=models.CharField(
                blank=True,
                choices=[
                    ('PASS', 'Pass'),
                    ('FAIL', 'Fail'),
                    ('ON_HOLD', 'On Hold'),
                ],
                max_length=10,
                null=True,
            ),
        ),
    ]
