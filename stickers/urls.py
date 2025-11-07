# stickers/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('api/assets/', views.list_assets, name='api_assets'),
    # otras rutas de la app...
]
