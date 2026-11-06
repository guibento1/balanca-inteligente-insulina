from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AppUser,
    Device,
    Food,
    Measurement,
    Profile,
    ProfileICRWindow,
)

class FoodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Food
        fields = ['id', 'name', 'carbs_per_100g', 'image_url', 'created_at', 'updated_at']

class ProfileICRWindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfileICRWindow
        fields = [
            'id',
            'start_time',
            'end_time',
            'grams_per_unit',
            'target_min_mgdl',
            'target_max_mgdl',
            'created_at',
            'updated_at',
        ]

class ProfileSerializer(serializers.ModelSerializer):
    icr_windows = ProfileICRWindowSerializer(many=True, required=False)

    class Meta:
        model = Profile
        fields = ['id', 'user', 'name', 'sensitivity_factor', 'icr_windows', 'created_at', 'updated_at']
        read_only_fields = ['user']

    def create(self, validated_data):
        windows_data = validated_data.pop('icr_windows', [])
        profile = Profile.objects.create(**validated_data)
        for payload in windows_data:
            profile.icr_windows.create(**payload)
        return profile

    def update(self, instance, validated_data):
        windows_data = validated_data.pop('icr_windows', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if windows_data is not None:
            sanitized_windows = [{k: v for k, v in payload.items() if k != 'id'} for payload in windows_data]
            with transaction.atomic():
                instance.icr_windows.all().delete()
                for payload in sanitized_windows:
                    instance.icr_windows.create(**payload)

        return instance

class AppUserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = AppUser
        fields = ['id', 'username', 'profile', 'created_at', 'updated_at']

class DeviceSerializer(serializers.ModelSerializer):
    user = AppUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        source='user', queryset=AppUser.objects.all(), write_only=True, required=False, allow_null=True
    )
    current_food = FoodSerializer(read_only=True)
    current_food_id = serializers.PrimaryKeyRelatedField(
        source='current_food', queryset=Food.objects.all(), write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Device
        fields = [
            'id',
            'device_name',
            'user',
            'user_id',
            'current_food',
            'current_food_id',
            'current_weight_g',  
            'pending_tare',
            'last_seen',
            'battery_level',
            'is_active',
            'created_at',
        ]

class MeasurementSerializer(serializers.ModelSerializer):
    device = DeviceSerializer(read_only=True)
    food = FoodSerializer(read_only=True)
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = Measurement
        fields = [
            'id',
            'device',
            'food',
            'profile',
            'weight_g',
            'carbs_estimated_g',
            'dose_carbs_units',
            'dose_correction_units',
            'dose_total_units',
            'measured_at',
            'params_snapshot',
            'created_at',
        ]


class MeasurementLightSerializer(serializers.ModelSerializer):
    """Serializer leve para listagens rápidas (evita nested queries)."""
    device = serializers.SerializerMethodField()
    food = serializers.SerializerMethodField()

    class Meta:
        model = Measurement
        fields = [
            'id',
            'device',
            'food',
            'weight_g',
            'carbs_estimated_g',
            'dose_carbs_units',
            'dose_correction_units',
            'dose_total_units',
            'measured_at',
        ]

    def get_device(self, obj):
        return {'id': obj.device_id, 'device_name': obj.device.device_name} if obj.device else None

    def get_food(self, obj):
        return {'id': obj.food_id, 'name': obj.food.name} if obj.food else None

class MeasurementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Measurement
        fields = [
            'id',
            'device',
            'food',
            'profile',
            'weight_g',
            'carbs_estimated_g',
            'dose_carbs_units',
            'dose_correction_units',
            'dose_total_units',
            'measured_at',
            'params_snapshot',
        ]

class MeasurementIngestSerializer(serializers.Serializer):
    device_id = serializers.PrimaryKeyRelatedField(source='device', queryset=Device.objects.all())
    profile_id = serializers.PrimaryKeyRelatedField(
        source='profile', queryset=Profile.objects.all(), required=False, allow_null=True
    )
    user_id = serializers.IntegerField(required=False)
    food_id = serializers.PrimaryKeyRelatedField(source='food', queryset=Food.objects.all())
    weight_g = serializers.DecimalField(max_digits=10, decimal_places=3)
    current_glucose_mgdl = serializers.IntegerField(required=False, allow_null=True)
    measured_at = serializers.DateTimeField(required=False)
    battery_level = serializers.DecimalField(
        max_digits=4,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
        max_value=100,
    )
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        profile = attrs.get('profile')
        user_id = self.initial_data.get('user_id')

        if profile is None:
            if not user_id:
                raise serializers.ValidationError('profile_id ou user_id são obrigatórios.')
            try:
                profile = Profile.objects.get(user_id=user_id)
            except Profile.DoesNotExist as exc:
                raise serializers.ValidationError('Perfil não encontrado para o utilizador.') from exc
            attrs['profile'] = profile

        return attrs

    def create(self, validated_data):
        device = validated_data['device']
        profile = validated_data['profile']
        food = validated_data['food']
        weight_g = Decimal(str(validated_data['weight_g']))
        measured_at = validated_data.get('measured_at') or timezone.now()
        current_glucose = validated_data.get('current_glucose_mgdl')
        battery_level = validated_data.get('battery_level')
        notes = validated_data.get('notes')

        icr_window = profile.icr_for_time(measured_at)
        grams_per_unit = Decimal(str(icr_window.grams_per_unit)) if icr_window else Decimal('15')
        target_max = Decimal(str(icr_window.target_max_mgdl)) if icr_window else Decimal('140')

        carbs_per_100g = Decimal(str(food.carbs_per_100g))
        # CÁLCULO - 6 PASSOS (resumo): 1)ICR 2)HC(g) 3)dose_HC 4)correção 5)total 6)quantizar
        # 1) ICR já foi obtido em `grams_per_unit` e `target_max` acima
        carbs_estimated = (weight_g * carbs_per_100g) / Decimal('100')  # 2) HC estimados (g)
        dose_carbs = carbs_estimated / grams_per_unit  # 3) dose por HC (unidades)

        dose_correction = Decimal('0')
        if current_glucose and icr_window:
            delta = Decimal(current_glucose) - Decimal(icr_window.target_max_mgdl)  # diferença (mg/dL)
            if delta > 0:
                sensitivity = Decimal(str(profile.sensitivity_factor))  # sensibilidade (mg/dL por unidade)
                dose_correction = delta / sensitivity  # 4) dose de correção (unidades)

        dose_total = dose_carbs + dose_correction  # 5) dose total (unidades)

        quantizer = Decimal('0.001')
        carbs_estimated = carbs_estimated.quantize(quantizer)  # 6) quantizar HC
        dose_carbs = dose_carbs.quantize(quantizer)  # quantizar dose por HC
        dose_correction = dose_correction.quantize(quantizer)  # quantizar correção
        dose_total = dose_total.quantize(quantizer)  # quantizar total

        params_snapshot = {
            'grams_per_unit': str(grams_per_unit),
            'target_max_mgdl': str(target_max),
            'sensitivity_factor': str(profile.sensitivity_factor),
            'current_glucose_mgdl': current_glucose,
            'notes': notes,
        }

        measurement = Measurement.objects.create(
            device=device,
            food=food,
            profile=profile,
            weight_g=weight_g,
            carbs_estimated_g=carbs_estimated,
            dose_carbs_units=dose_carbs,
            dose_correction_units=dose_correction,
            dose_total_units=dose_total,
            measured_at=measured_at,
            params_snapshot=params_snapshot,
        )

        device.last_seen = timezone.now()
        fields_to_update = ['last_seen', 'current_food']
        device.current_food = food
        if battery_level is not None:
            device.battery_level = battery_level
            fields_to_update.append('battery_level')
        device.save(update_fields=fields_to_update)

        return measurement
