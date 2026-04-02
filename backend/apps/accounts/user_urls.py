from django.urls import path
from .views import UserListCreateView, UserDetailView, UserActivateView, UserDeactivateView

urlpatterns = [
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('<uuid:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:pk>/activate/', UserActivateView.as_view(), name='user-activate'),
    path('<uuid:pk>/deactivate/', UserDeactivateView.as_view(), name='user-deactivate'),
]
