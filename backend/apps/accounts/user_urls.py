from django.urls import path
from .views import UserListCreateView, UserDetailView, UserActivateView, UserDeactivateView, UserLookupView, UserDropdownListView
from .role_views import UserRoleChangeView, UserStatusChangeView, UserDeleteView

urlpatterns = [
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('lookup/', UserLookupView.as_view(), name='user-lookup'),
    path('dropdown/', UserDropdownListView.as_view(), name='user-dropdown'),
    path('<uuid:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:pk>/activate/', UserActivateView.as_view(), name='user-activate'),
    path('<uuid:pk>/deactivate/', UserDeactivateView.as_view(), name='user-deactivate'),
    path('<uuid:pk>/role/', UserRoleChangeView.as_view(), name='user-role-change'),
    path('<uuid:pk>/status/', UserStatusChangeView.as_view(), name='user-status-change'),
    path('<uuid:pk>/remove/', UserDeleteView.as_view(), name='user-remove'),
]
