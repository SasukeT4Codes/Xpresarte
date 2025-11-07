import re
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render

# Añadimos 'espalda' y 'accesorio' aquí
CATEGORIES = ["espalda", "base", "boca", "barba", "cejas", "nariz", "ojos", "orejas", "peinado", "ropa", "accesorio"]

def home(request):
    return render(request, "home.html")

def list_assets(request):
    base_static = Path(settings.BASE_DIR) / "static" / "assets"
    out = {}

    for cat in CATEGORIES:
        folder = base_static / cat
        grouped = {}
        if folder.exists() and folder.is_dir():
            # Tomamos .png (puedes ajustar si necesitas .svg)
            for f in sorted(folder.glob("*.png")):
                name = f.name  # ejemplo: peinado-07.png o peinado-fondo-07.png
                # Buscamos el sufijo numérico antes de .png
                m = re.search(r'-(\d+)\.png$', name)
                key = m.group(1) if m else name
                if '-fondo-' in name:
                    grouped.setdefault(key, {}).update({"fondo": f"/static/assets/{cat}/{name}"})
                else:
                    grouped.setdefault(key, {}).update({"lineart": f"/static/assets/{cat}/{name}", "name": name})
        # Convertir grouped a lista ordenada por clave
        items = []
        for k in sorted(grouped.keys(), key=lambda x: int(x) if str(x).isdigit() else x):
            item = {
                "id": str(k),
                "name": grouped[k].get("name"),
                "lineart": grouped[k].get("lineart"),
                "fondo": grouped[k].get("fondo")
            }
            items.append(item)
        out[cat] = items

    # meta: guía compartida
    guide_path = base_static / "_shared" / "base-guia.png"
    out_meta = {}
    if guide_path.exists():
        out_meta["guide"] = f"/static/assets/_shared/{guide_path.name}"
    out["meta"] = out_meta

    return JsonResponse(out)
