from django.apps import AppConfig


class RequisitionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.requisitions'
    verbose_name = 'Requisitions'

    def ready(self):
        import apps.requisitions.signals  # noqa: F401
