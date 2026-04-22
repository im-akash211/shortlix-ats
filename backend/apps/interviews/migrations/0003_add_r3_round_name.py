from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interviews', '0002_interview_round_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='interview',
            name='round_name',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('R1', 'Round 1'),
                    ('R2', 'Round 2'),
                    ('R3', 'Round 3'),
                    ('CLIENT', 'Client Round'),
                    ('CDO', 'CDO Round'),
                    ('MGMT', 'Management Round'),
                ],
                null=True,
                blank=True,
            ),
        ),
    ]
