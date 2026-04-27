import environ
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env()
_env_file = BASE_DIR / '.env'
if _env_file.exists():
    environ.Env.read_env(_env_file)

SECRET_KEY = env('SECRET_KEY')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')

DATABASES = {'default': env.db('DATABASE_URL')}
DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True

INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'rest_framework_simplejwt.token_blacklist',
    'corsheaders', 'django_filters', 'drf_spectacular',
    'storages',
    'apps.accounts', 'apps.departments', 'apps.requisitions',
    'apps.jobs', 'apps.candidates', 'apps.interviews',
    'apps.dashboard', 'apps.core', 'apps.resumes', 'apps.notifications',
]

AUTH_USER_MODEL = 'accounts.User'

ROOT_URLCONF = 'config.urls'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS')

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardResultsPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'TOKEN_OBTAIN_SERIALIZER': 'apps.accounts.serializers.CustomTokenObtainPairSerializer',
}

SPECTACULAR_SETTINGS = {'TITLE': 'ATS API', 'VERSION': '1.0.0'}

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ── S3 file storage ────────────────────────────────────────────────────────────
STORAGES = {
    'default': {
        'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        'OPTIONS': {
            'access_key': env('AWS_ACCESS_KEY_ID', default=''),
            'secret_key': env('AWS_SECRET_ACCESS_KEY', default=''),
            'bucket_name': env('AWS_S3_BUCKET', default=''),
            'region_name': env('AWS_REGION', default='us-west-2'),
            'default_acl': 'private',
            'file_overwrite': False,
            'querystring_auth': True,
        },
    },
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}

# ── Gemini AI ──────────────────────────────────────────────────────────────────
# Supports both single key (GEMINI_API_KEY) and multi-key rotation (GEMINI_API_KEYS)
_gemini_single = env('GEMINI_API_KEY', default='')
GEMINI_API_KEYS = env.list('GEMINI_API_KEYS', default=[_gemini_single] if _gemini_single else [])
GEMINI_MODEL_NAME = env('GEMINI_MODEL_NAME', default='gemini-2.0-flash')

# ── Resume upload limits ───────────────────────────────────────────────────────
RESUME_MAX_FILE_SIZE_MB = int(env('RESUME_MAX_FILE_SIZE_MB', default='10'))

# ── Celery ─────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'send-feedback-reminders-hourly': {
        'task': 'interviews.send_feedback_reminders',
        # Runs at the top of every hour; the task itself enforces the 24h gap
        'schedule': crontab(minute=0),
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Email (Gmail SMTP) ─────────────────────────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:3000')
