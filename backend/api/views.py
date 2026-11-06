from decimal import Decimal
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from decimal import Decimal
from django.utils import timezone

from .models import AppUser, Device, Food, Measurement, Profile
from .serializers import (
    AppUserSerializer,
    DeviceSerializer,
    FoodSerializer,
    MeasurementCreateSerializer,
    MeasurementIngestSerializer,
    MeasurementLightSerializer,
    MeasurementSerializer,
    ProfileSerializer,
)

def home(request):
    return HttpResponse("API para o Projeto de SE")

class FoodViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Food.objects.all().order_by('name')
    serializer_class = FoodSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'updated_at', 'carbs_per_100g']

class AppUserViewSet(viewsets.ModelViewSet):
    queryset = AppUser.objects.all().prefetch_related('profile__icr_windows')
    serializer_class = AppUserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username']

    def perform_create(self, serializer):
        user = serializer.save()
        Profile.objects.get_or_create(
            user=user,
            defaults={'sensitivity_factor': Decimal('50.0'), 'name': 'Perfil Principal'},
        )

    @action(detail=True, methods=['get', 'put', 'patch'])
    def profile(self, request, pk=None):
        instance = self.get_object() 
        profile, _created = Profile.objects.get_or_create(
            user=instance,
            defaults={'sensitivity_factor': Decimal('50.0'), 'name': 'Perfil Principal'},
        )

        if request.method.lower() == 'get':
            return Response(ProfileSerializer(profile).data)  

        partial = request.method.lower() == 'patch'
         
        serializer = ProfileSerializer(profile, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.select_related('user', 'current_food').all()
    serializer_class = DeviceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['user']
    search_fields = ['device_name']

    @action(detail=True, methods=['post'])
    def ping(self, request, pk=None):
        device = self.get_object()
        battery = request.data.get('battery_level')
        device.last_seen = timezone.now()
        update_fields = ['last_seen']
        if battery is not None:
            device.battery_level = battery
            update_fields.append('battery_level')
        device.save(update_fields=update_fields)
        return Response({'status': 'ok', 'last_seen': device.last_seen})
    
    # Atualizar peso em tempo real
    @action(detail=True, methods=['post'])
    def update_weight(self, request, pk=None):
        """
        POST /api/v1/devices/{id}/update_weight/
        Atualiza o peso atual da balança SEM criar medição
        Corpo: {"weight_g": 132.5}
        """
        device = self.get_object()
        weight = request.data.get('weight_g')
        
        if weight is not None:
            device.current_weight_g = weight
            device.last_seen = timezone.now()
            device.save(update_fields=['current_weight_g', 'last_seen'])
            
            return Response({
                'device_id': device.id,
                'current_weight_g': float(device.current_weight_g) if device.current_weight_g else 0,
                'last_seen': device.last_seen
            })
        
        return Response(
            {'error': 'weight_g é obrigatório'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obter peso atual
    @action(detail=True, methods=['get'])
    def current_weight(self, request, pk=None):
        """
        GET /api/v1/devices/{id}/current_weight/
        Retorna o peso atual da balança
        """
        device = self.get_object()
        return Response({
            'device_id': device.id,
            'current_weight_g': float(device.current_weight_g) if device.current_weight_g else 0,
            'last_seen': device.last_seen
        })

    @action(detail=True, methods=['post'])
    def request_tare(self, request, pk=None):
        """Marca um pedido de tara para o dispositivo.

        Endpoint usado pelo frontend/servidor para sinalizar ao dispositivo que
        deve executar uma tara. Não cria ou altera medições históricas — apenas
        define o flag `pending_tare` e repõe o peso atual a zero até que o
        dispositivo confirme a tara.

        Retorna um JSON simples com o `status` e o `device_id`.
        """
        # Obter a instância do dispositivo (lança 404 se não existir)
        device = self.get_object()

        # Marcar que o dispositivo tem um pedido de tara pendente
        device.pending_tare = True

        # Zerar o peso atual armazenado para evitar leituras inválidas
        device.current_weight_g = Decimal('0')

        # Atualizar o timestamp do último contacto
        device.last_seen = timezone.now()

        # Guardar apenas os campos modificados para eficiência
        device.save(update_fields=['pending_tare', 'current_weight_g', 'last_seen'])

        # Responder com um objeto simples indicando que a tara foi solicitada
        return Response({'status': 'tare_requested', 'device_id': device.id})

    @action(detail=True, methods=['post'])
    def confirm_tare(self, request, pk=None):
        """Confirma a tara executada pelo dispositivo e limpa o pedido.

        Este endpoint é normalmente chamado pelo dispositivo após executar a
        tara. Ele limpa o flag `pending_tare`, garante que o peso atual está a
        zero e atualiza o `last_seen`.

        Retorna um JSON com o `status` e o `device_id`.
        """
        # Recuperar o dispositivo associado à rota
        device = self.get_object()

        # Limpar o pedido de tara (o dispositivo já executou a tara fisicamente)
        device.pending_tare = False

        # Garantir que o peso atual fica a zero após a tara
        device.current_weight_g = Decimal('0')

        # Atualizar o timestamp do último contacto
        device.last_seen = timezone.now()

        # Persistir apenas os campos alterados
        device.save(update_fields=['pending_tare', 'current_weight_g', 'last_seen'])

        # Responder confirmando a tara
        return Response({'status': 'tare_confirmed', 'device_id': device.id})

class MeasurementViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = (
        Measurement.objects.select_related('device', 'food', 'profile__user')
        .all()
        .order_by('-measured_at')
    )
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['device', 'food', 'profile']
    ordering_fields = ['measured_at', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(profile__user_id=user_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return MeasurementCreateSerializer
        return MeasurementSerializer

    @action(detail=False, methods=['get'])
    def latest(self, request):
        user_id = request.query_params.get('user_id')
        device_id = request.query_params.get('device_id')

        qs = self.get_queryset()
        if user_id:
            qs = qs.filter(profile__user_id=user_id)
        if device_id:
            qs = qs.filter(device_id=device_id)

        measurement = qs.order_by('-measured_at').first()
        if not measurement:
            return Response({'detail': 'Nenhuma medição encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(MeasurementSerializer(measurement).data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Retorna as últimas N medições (padrão: 20)."""
        user_id = request.query_params.get('user_id')
        device_id = request.query_params.get('device_id')
        limit_param = request.query_params.get('limit')

        try:
            limit = int(limit_param) if limit_param is not None else 15
        except ValueError:
            limit = 15

        limit = max(1, min(limit, 50)) 

        qs = Measurement.objects.select_related('device', 'food').only(
            'id', 'weight_g', 'carbs_estimated_g', 'dose_carbs_units',
            'dose_correction_units', 'dose_total_units', 'measured_at',
            'device__id', 'device__device_name',
            'food__id', 'food__name',
            'profile_id',
        )
        if user_id:
            qs = qs.filter(profile__user_id=user_id)
        if device_id:
            qs = qs.filter(device_id=device_id)

        measurements = qs.order_by('-measured_at')[:limit]
        serializer = MeasurementLightSerializer(measurements, many=True)
        return Response(serializer.data)

class MeasurementIngestView(APIView):
    """
    Endpoint para criar medicoes (usado pelo Raspberry e Frontend)
    POST: device_id, user_id, food_id, weight_g
    """
    
    def post(self, request):
        device_id = request.data.get('device_id')
        user_id = request.data.get('user_id')
        food_id = request.data.get('food_id')
        weight_g = request.data.get('weight_g')
        
        if not all([device_id, user_id, food_id, weight_g]):
            return Response(
                {'error': 'Campos obrigatorios: device_id, user_id, food_id, weight_g'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            device = Device.objects.get(id=device_id)
            user = AppUser.objects.get(id=user_id)
            food = Food.objects.get(id=food_id)
            profile = user.profile
            
            serializer = MeasurementIngestSerializer(data=request.data)
            
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            measurement = serializer.save()
            
            return Response({
                'id': measurement.id,
                'weight_g': float(measurement.weight_g),
                'carbs_estimated_g': float(measurement.carbs_estimated_g),
                'dose_carbs_units': float(measurement.dose_carbs_units),
                'dose_correction_units': float(measurement.dose_correction_units),
                'dose_total_units': float(measurement.dose_total_units),
                'measured_at': measurement.measured_at.isoformat(),
            }, status=status.HTTP_201_CREATED)
            
        except Device.DoesNotExist:
            return Response({'error': 'Device nao encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except AppUser.DoesNotExist:
            return Response({'error': 'User nao encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except Food.DoesNotExist:
            return Response({'error': 'Food nao encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
