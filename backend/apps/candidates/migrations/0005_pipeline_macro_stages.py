# Renames PipelineStageLog → PipelineStageHistory, renames stage → macro_stage,
# renames from_stage/to_stage → from_macro_stage/to_macro_stage, updates choices,
# adds new fields (offer_status, drop_reason, current_interview_round,
# next_interview_date, priority), and replaces the composite index.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0004_remove_expected_ctc'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ------------------------------------------------------------------
        # 1. Rename the audit-log model
        # ------------------------------------------------------------------
        migrations.RenameModel(
            old_name='PipelineStageLog',
            new_name='PipelineStageHistory',
        ),

        # ------------------------------------------------------------------
        # 2. Rename stage → macro_stage on CandidateJobMapping
        # ------------------------------------------------------------------
        migrations.RenameField(
            model_name='candidatejobmapping',
            old_name='stage',
            new_name='macro_stage',
        ),

        # ------------------------------------------------------------------
        # 3. Update macro_stage choices & max_length
        # ------------------------------------------------------------------
        migrations.AlterField(
            model_name='candidatejobmapping',
            name='macro_stage',
            field=models.CharField(
                choices=[
                    ('APPLIED', 'Applied'),
                    ('SHORTLISTED', 'Shortlisted'),
                    ('INTERVIEW', 'Interview'),
                    ('OFFERED', 'Offered'),
                    ('JOINED', 'Joined'),
                    ('DROPPED', 'Dropped'),
                ],
                default='APPLIED',
                db_index=True,
                max_length=15,
            ),
        ),

        # ------------------------------------------------------------------
        # 4. Rename audit-log stage fields
        # ------------------------------------------------------------------
        migrations.RenameField(
            model_name='pipelinestagehistory',
            old_name='from_stage',
            new_name='from_macro_stage',
        ),
        migrations.RenameField(
            model_name='pipelinestagehistory',
            old_name='to_stage',
            new_name='to_macro_stage',
        ),

        # ------------------------------------------------------------------
        # 5. Rename audit-log notes → remarks, changed_by → moved_by
        # ------------------------------------------------------------------
        migrations.RenameField(
            model_name='pipelinestagehistory',
            old_name='notes',
            new_name='remarks',
        ),
        migrations.RenameField(
            model_name='pipelinestagehistory',
            old_name='changed_by',
            new_name='moved_by',
        ),

        # ------------------------------------------------------------------
        # 6. Update max_length of audit-log stage fields
        # ------------------------------------------------------------------
        migrations.AlterField(
            model_name='pipelinestagehistory',
            name='from_macro_stage',
            field=models.CharField(blank=True, max_length=15),
        ),
        migrations.AlterField(
            model_name='pipelinestagehistory',
            name='to_macro_stage',
            field=models.CharField(max_length=15),
        ),

        # ------------------------------------------------------------------
        # 7. Add new fields to CandidateJobMapping
        # ------------------------------------------------------------------
        migrations.AddField(
            model_name='candidatejobmapping',
            name='offer_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('OFFER_SENT', 'Offer Sent'),
                    ('OFFER_ACCEPTED', 'Offer Accepted'),
                    ('OFFER_DECLINED', 'Offer Declined'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='candidatejobmapping',
            name='drop_reason',
            field=models.CharField(
                blank=True,
                choices=[
                    ('REJECTED', 'Rejected'),
                    ('CANDIDATE_DROP', 'Candidate Drop'),
                    ('NO_SHOW', 'No Show'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='candidatejobmapping',
            name='current_interview_round',
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
            model_name='candidatejobmapping',
            name='next_interview_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='candidatejobmapping',
            name='priority',
            field=models.CharField(
                choices=[
                    ('LOW', 'Low'),
                    ('MEDIUM', 'Medium'),
                    ('HIGH', 'High'),
                ],
                default='MEDIUM',
                max_length=10,
            ),
        ),

        # ------------------------------------------------------------------
        # 8. Replace composite index (job, stage) → (job, macro_stage)
        # ------------------------------------------------------------------
        migrations.RemoveIndex(
            model_name='candidatejobmapping',
            name='cjm_job_stage_idx',
        ),
        migrations.AddIndex(
            model_name='candidatejobmapping',
            index=models.Index(fields=['job', 'macro_stage'], name='cjm_job_macro_stage_idx'),
        ),
    ]
