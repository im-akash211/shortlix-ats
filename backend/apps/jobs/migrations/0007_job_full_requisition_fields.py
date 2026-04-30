from django.db import migrations, models
import django.contrib.postgres.fields
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0006_rename_job_codes_sht_format'),
        ('departments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='sub_vertical_1',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='jobs_sv1', to='departments.subvertical',
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='sub_vertical_2',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='jobs_sv2', to='departments.subvertical',
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='designation',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='job',
            name='priority',
            field=models.CharField(
                choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical')],
                default='medium', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='employment_type',
            field=models.CharField(
                choices=[('permanent', 'Permanent'), ('contract', 'Contract'), ('internship', 'Internship')],
                default='permanent', max_length=15,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='requisition_type',
            field=models.CharField(
                choices=[('new', 'New'), ('backfill', 'Backfill')],
                default='new', max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='work_mode',
            field=models.CharField(
                blank=True, default='',
                choices=[('hybrid', 'Hybrid'), ('remote', 'Remote'), ('office', 'Office')],
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='positions_count',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='job',
            name='skills_desirable',
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.CharField(max_length=100),
                blank=True, default=list, size=None,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='min_qualification',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='job',
            name='project_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='job',
            name='client_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='job',
            name='expected_start_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='tat_days',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='budget_min',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='budget_max',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        # Candidate signals — Educational
        migrations.AddField(model_name='job', name='iit_grad', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='nit_grad', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='iim_grad', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='top_institute', field=models.BooleanField(default=False)),
        # Candidate signals — Company
        migrations.AddField(model_name='job', name='unicorn_exp', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='top_internet_product', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='top_software_product', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='top_it_services_mnc', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='job', name='top_consulting_mnc', field=models.BooleanField(default=False)),
    ]
