from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AppUserViewSet,
    DeviceViewSet,
    FoodViewSet,
    MeasurementIngestView,
    MeasurementViewSet,
)

router = DefaultRouter()
router.register(r'foods', FoodViewSet)
router.register(r'users', AppUserViewSet)
router.register(r'devices', DeviceViewSet)
router.register(r'measurements', MeasurementViewSet, basename='measurement')

urlpatterns = [
    path('', include(router.urls)),
    path('ingest/', MeasurementIngestView.as_view(), name='ingest'),
]
