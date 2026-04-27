from django.urls import path
from .role_views import RoleListView, RolePermissionsUpdateView

urlpatterns = [
    path('', RoleListView.as_view(), name='role-list'),
    path('<uuid:pk>/permissions/', RolePermissionsUpdateView.as_view(), name='role-permissions-update'),
]
