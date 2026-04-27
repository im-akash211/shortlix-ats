from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.accounts.auth_urls')),
    path('api/v1/users/', include('apps.accounts.user_urls')),
    path('api/v1/roles/', include('apps.accounts.role_urls')),
    path('api/v1/departments/', include('apps.departments.urls')),
    path('api/v1/requisitions/', include('apps.requisitions.urls')),
    path('api/v1/jobs/', include('apps.jobs.urls')),
    path('api/v1/candidates/', include('apps.candidates.urls')),
    path('api/v1/interviews/', include('apps.interviews.urls')),
    path('api/v1/dashboard/', include('apps.dashboard.urls')),
    path('api/v1/resume/', include('apps.resumes.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/employee/', include('apps.candidates.employee_urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

# Serve uploaded media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
