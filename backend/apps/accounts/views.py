from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from apps.core.permissions import IsAdmin
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, UserDropdownSerializer, CustomTokenObtainPairSerializer


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
    queryset = User.objects.select_related('department').all()
    permission_classes = [IsAdmin]
    search_fields = ['full_name', 'email']
    filterset_fields = ['role', 'is_active', 'department']
    ordering_fields = ['full_name', 'created_at']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.select_related('department').all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]


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
