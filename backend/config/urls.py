"""
Root URL configuration for the ATS project.

API versioning: /api/v1/...
Docs:           /api/docs/   (Swagger UI)
                /api/redoc/  (ReDoc)
Health:         /api/health/ (no auth required)
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Liveness probe — returns 200 when the Django app is running and can
    reach the database.
    """
    from django.db import connection
    try:
        connection.ensure_connection()
        db_status = 'ok'
    except Exception as e:
        db_status = f'error: {e}'

    return Response({
        'status': 'ok',
        'service': 'ATS API',
        'version': '1.0.0',
        'database': db_status,
    })


urlpatterns = [
    # ── Django admin ──────────────────────────────────────────────────────────
    path('admin/', admin.site.urls),

    # ── Health check (no auth) ────────────────────────────────────────────────
    path('api/health/', health_check, name='health-check'),

    # ── OpenAPI schema & interactive docs ─────────────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ── API v1 routes (uncommented progressively per phase) ───────────────────
    # Phase 1 — Auth & Users
    # path('api/v1/auth/',        include('apps.accounts.urls')),
    # path('api/v1/users/',       include('apps.accounts.user_urls')),

    # Phase 2 — Departments / Admin settings
    # path('api/v1/departments/', include('apps.departments.urls')),

    # Phase 3 — Requisitions
    # path('api/v1/requisitions/', include('apps.requisitions.urls')),

    # Phase 4 — Jobs
    # path('api/v1/jobs/',        include('apps.jobs.urls')),

    # Phase 5 — Candidates
    # path('api/v1/candidates/',  include('apps.candidates.urls')),

    # Phase 7 — Interviews
    # path('api/v1/interviews/',  include('apps.interviews.urls')),

    # Phase 8 — Dashboard
    # path('api/v1/dashboard/',   include('apps.dashboard.urls')),

    # Phase 9 — AI
    # path('api/v1/ai/',          include('apps.ai_services.urls')),
]

# ── Serve media files in development ─────────────────────────────────────────
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
