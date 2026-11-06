from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

class TimeStampedModel(models.Model):
    """Common audit fields for domain entities."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class AppUser(TimeStampedModel):
    id = models.AutoField(primary_key=True, db_column='user_id')
    username = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = 'app_user'
        ordering = ['username']

    def __str__(self) -> str:
        return self.username

class Food(TimeStampedModel):
    id = models.AutoField(primary_key=True, db_column='food_id')
    name = models.CharField(max_length=100, unique=True)
    carbs_per_100g = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    image_url = models.URLField(blank=True, null=True)

    class Meta:
        db_table = 'food'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name

class Profile(TimeStampedModel):
    id = models.AutoField(primary_key=True, db_column='profile_id')
    user = models.OneToOneField(AppUser, related_name='profile', on_delete=models.CASCADE)
    name = models.CharField(max_length=100, default='Perfil Principal')
    sensitivity_factor = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text='mg/dL reduzidos por 1U de insulina',
    )

    class Meta:
        db_table = 'profile'
        ordering = ['user__username']

    def __str__(self) -> str:
        return f"{self.user.username} - {self.name}"

    def icr_for_time(self, when):
        """Return the insulin-to-carb ratio window for a given datetime/time input."""
        if hasattr(when, 'time'):
            clock = when.time()  
        else:
            clock = when  
        
        if hasattr(clock, 'replace') and clock.tzinfo is not None:
            clock = clock.replace(tzinfo=None)
        
        for window in self.icr_windows.order_by('start_time'):
            if window.contains_time(clock):
                return window
        
        return self.icr_windows.order_by('start_time').first()


class ProfileICRWindow(TimeStampedModel):
    id = models.AutoField(primary_key=True, db_column='window_id')
    profile = models.ForeignKey(
        Profile,
        related_name='icr_windows',
        on_delete=models.CASCADE,
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    grams_per_unit = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
    )
    target_min_mgdl = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(299)]
    )
    target_max_mgdl = models.PositiveIntegerField(
        validators=[MinValueValidator(2), MaxValueValidator(300)]
    )

    class Meta:
        db_table = 'profile_icr_window'
        unique_together = ('profile', 'start_time', 'end_time')
        ordering = ['profile', 'start_time']

    def __str__(self) -> str:
        return f"{self.profile} {self.start_time}-{self.end_time}"

    def contains_time(self, current_time) -> bool:
        start = self.start_time
        end = self.end_time
        if start <= end:
            return start <= current_time < end
        return current_time >= start or current_time < end

class Device(TimeStampedModel):
    updated_at = None  
    id = models.AutoField(primary_key=True, db_column='device_id')
    device_name = models.CharField(max_length=100, default='Raspberry Pi')
    user = models.ForeignKey(
        AppUser,
        related_name='devices',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    current_food = models.ForeignKey(
        Food,
        related_name='devices',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    
    # Peso atual em tempo real (não persistido como medição)
    current_weight_g = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Peso atual lido pela balança (tempo real)"
    )
    pending_tare = models.BooleanField(
        default=False,
        help_text="Indica se existe um pedido de tara em aberto"
    )
    
    last_seen = models.DateTimeField(default=timezone.now)
    battery_level = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'device'
        ordering = ['device_name']

    def __str__(self) -> str:
        return self.device_name

class Measurement(TimeStampedModel):
    updated_at = None  
    id = models.AutoField(primary_key=True, db_column='measurement_id')
    device = models.ForeignKey(
        Device,
        related_name='measurements',
        on_delete=models.PROTECT,
    )
    food = models.ForeignKey(
        Food,
        related_name='measurements',
        on_delete=models.PROTECT,
    )
    profile = models.ForeignKey(
        Profile,
        related_name='measurements',
        on_delete=models.PROTECT,
    )
    weight_g = models.DecimalField(max_digits=10, decimal_places=3)
    carbs_estimated_g = models.DecimalField(max_digits=10, decimal_places=3)
    dose_carbs_units = models.DecimalField(max_digits=10, decimal_places=3)
    dose_correction_units = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    dose_total_units = models.DecimalField(max_digits=10, decimal_places=3)
    measured_at = models.DateTimeField()
    params_snapshot = models.JSONField(blank=True, null=True)

    class Meta:
        db_table = 'measurement'
        ordering = ['-measured_at']
        indexes = [
            models.Index(fields=['device', '-measured_at'], name='idx_meas_device_time'),
            models.Index(fields=['food', '-measured_at'], name='idx_meas_food_time'),
            models.Index(fields=['profile', '-measured_at'], name='idx_meas_profile_time'),
            models.Index(fields=['-created_at'], name='idx_meas_created'),
        ]

    def __str__(self) -> str:
        return f"{self.device} {self.measured_at:%Y-%m-%d %H:%M}"
