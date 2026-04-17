# Data migration: maps old flat stage values to new macro stages.
#
# Mapping:
#   pending     → APPLIED
#   shortlisted → SHORTLISTED
#   interview   → INTERVIEW  (current_interview_round=NULL)
#   on_hold     → INTERVIEW  (current_interview_round=NULL)
#   selected    → SHORTLISTED (safe default — ambiguous whether offer-ready)
#   rejected    → DROPPED    (drop_reason=REJECTED)
#   offered     → OFFERED    (offer_status=OFFER_SENT)
#   joined      → JOINED
#   <unknown>   → DROPPED    (drop_reason=REJECTED fallback)

from django.db import migrations


STAGE_MAP = {
    'pending':     ('APPLIED',     {}),
    'shortlisted': ('SHORTLISTED', {}),
    'interview':   ('INTERVIEW',   {}),
    'on_hold':     ('INTERVIEW',   {}),
    'selected':    ('SHORTLISTED', {}),
    'rejected':    ('DROPPED',     {'drop_reason': 'REJECTED'}),
    'offered':     ('OFFERED',     {'offer_status': 'OFFER_SENT'}),
    'joined':      ('JOINED',      {}),
}


def migrate_stages_forward(apps, schema_editor):
    CandidateJobMapping = apps.get_model('candidates', 'CandidateJobMapping')

    for old_stage, (new_stage, extra_fields) in STAGE_MAP.items():
        qs = CandidateJobMapping.objects.filter(macro_stage=old_stage)
        update_kwargs = {'macro_stage': new_stage}
        update_kwargs.update(extra_fields)
        qs.update(**update_kwargs)

    # Fallback: any record still holding an unrecognised old value → DROPPED
    known_new_stages = {'APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'JOINED', 'DROPPED'}
    CandidateJobMapping.objects.exclude(macro_stage__in=known_new_stages).update(
        macro_stage='DROPPED',
        drop_reason='REJECTED',
    )


def migrate_stages_backward(apps, schema_editor):
    # Best-effort reverse: new macro → closest old stage
    CandidateJobMapping = apps.get_model('candidates', 'CandidateJobMapping')
    REVERSE_MAP = {
        'APPLIED':     'pending',
        'SHORTLISTED': 'shortlisted',
        'INTERVIEW':   'interview',
        'OFFERED':     'offered',
        'JOINED':      'joined',
        'DROPPED':     'rejected',
    }
    for new_stage, old_stage in REVERSE_MAP.items():
        CandidateJobMapping.objects.filter(macro_stage=new_stage).update(macro_stage=old_stage)


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0005_pipeline_macro_stages'),
    ]

    operations = [
        migrations.RunPython(migrate_stages_forward, reverse_code=migrate_stages_backward),
    ]
