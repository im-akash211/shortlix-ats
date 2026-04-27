"""
Convenience runner — delegates to the seed_dev management command.
Usage:  python seed.py
        (or) python manage.py seed_dev
"""
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from django.core.management import call_command
call_command('seed_dev')
