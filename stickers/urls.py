# stickers/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),              # /  -> home.html
    path('api/assets/', views.list_assets, name='api_assets'),
    # otras rutas de la app...
]
