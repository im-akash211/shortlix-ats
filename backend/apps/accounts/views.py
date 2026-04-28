from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from apps.core.permissions import IsAdmin, rbac_perm
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, UserDropdownSerializer, CustomTokenObtainPairSerializer


class UserLookupView(generics.ListAPIView):
    """Search users by email or role — accessible to any authenticated user."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = User.objects.select_related('department').filter(is_active=True)
        email = self.request.query_params.get('email', '')
        role = self.request.query_params.get('role', '')
        if email:
            qs = qs.filter(email__icontains=email)
        if role:
            qs = qs.filter(role=role)
        return qs[:20]


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class RefreshTokenView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutView(APIView):
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserDropdownListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserDropdownSerializer

    def get_queryset(self):
        return User.objects.filter(is_active=True).only('id', 'full_name', 'role').order_by('full_name')


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.select_related('department').filter(is_active=True).order_by('full_name')
    search_fields = ['full_name', 'email']
    filterset_fields = ['role', 'is_active', 'department']
    ordering_fields = ['full_name', 'created_at']
    pagination_class = None  # return all users — settings page needs the full list

    def get_permissions(self):
        if self.request.method == 'POST':
            return [rbac_perm('MANAGE_USERS')()]
        return [rbac_perm('MANAGE_USERS')()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.select_related('department').all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]


class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/ — self-service, requires current password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not old_password or not new_password:
            return Response(
                {'detail': 'Both old_password and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not request.user.check_password(old_password):
            return Response(
                {'detail': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 6:
            return Response(
                {'detail': 'New password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})


class AdminChangePasswordView(APIView):
    """PATCH /api/v1/users/<pk>/password/ — admin only, no old-password verification."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        new_password = request.data.get('new_password', '').strip()

        if len(new_password) < 6:
            return Response(
                {'detail': 'New password must be at least 6 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})


class UserActivateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response(UserSerializer(user).data)


class UserDeactivateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(UserSerializer(user).data)
