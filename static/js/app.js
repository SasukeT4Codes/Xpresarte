// static/js/app.js
document.addEventListener('DOMContentLoaded', () => {
  const API = '/api/assets/';
  const renderOrder = ['base','nariz','boca','ojos','barba','ropa','peinado','orejas','cejas'];
  const container = document.getElementById('preview-canvas');
  const SIZE = 1024; // resolución lógica para composición (ajústala para export si hace falta)

  // referencias a botones/inputs (según tu plantilla)
  const categories = ['base','boca','barba','cejas','nariz','ojos','orejas','peinado','ropa'];
  const selectBtns = {};
  const colorInputs = {};
  categories.forEach(c=>{
    selectBtns[c] = document.getElementById(`select-${c}`);
    colorInputs[c] = document.getElementById(`color-${c}`);
  });

  // canvas de previsualización
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  container.innerHTML = '';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // estado de la app: para cada categoría guardamos el item seleccionado { id, lineart, fondo }
  const state = {};
  categories.forEach(c => state[c] = null);
  let assets = null;   // JSON completo desde la API
  let guideURL = null; // URL de la guía compartida (si existe)

  // helper: convierte hex "#rrggbb" a objeto {r,g,b}
  function hexToRgb(hex) {
    hex = (hex || '').replace('#','');
    if (hex.length === 3) hex = hex.split('').map(h=>h+h).join('');
    return {
      r: parseInt(hex.substring(0,2) || '0',16),
      g: parseInt(hex.substring(2,4) || '0',16),
      b: parseInt(hex.substring(4,6) || '0',16)
    };
  }

  // helper: convierte r,g,b a string hex "#rrggbb"
  function rgbToHex(r,g,b) {
    const toHex = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // helper: oscurece un color hex un porcentaje (ej. 0.06 = 6%)
  function darkenHex(hex, percent) {
    const c = hexToRgb(hex);
    const factor = 1 - percent;
    return rgbToHex(c.r * factor, c.g * factor, c.b * factor);
  }

  // Obtener assets desde la API y construir la UI
  fetch(API).then(r => r.json()).then(json => {
    assets = json;
    guideURL = (json.meta && json.meta.guide) ? json.meta.guide : null;

    // Para cada categoría: seleccionar variante por defecto y crear dropdown de miniaturas
    categories.forEach(cat => {
      const list = (json[cat] || []);
      const btn = selectBtns[cat];
      const colorInp = colorInputs[cat];

      if(!btn) return;

      if(list.length){
        // seleccion por defecto: primera variante
        state[cat] = list[0];
        btn.textContent = `${displayName(list[0])} ▾`;
      } else {
        state[cat] = null;
        btn.textContent = `— ▾`;
      }

      // al hacer click en el botón abrimos un dropdown con thumbnails
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeAllDropdowns();
        const box = document.createElement('div');
        box.className = 'ctrl-thumbs active';
        (list.length ? list : []).forEach(item => {
          const row = document.createElement('div');
          row.className = 'ctrl-thumb-row';
          const img = document.createElement('img');
          // usamos lineart para la miniatura; si no existe usamos fondo
          img.src = item.lineart || item.fondo || '';
          img.alt = item.name || item.id || '';
          const label = document.createElement('div');
          label.className = 'thumb-label';
          label.textContent = displayName(item);
          row.appendChild(img);
          row.appendChild(label);
          row.addEventListener('click', () => {
            // al seleccionar actualizamos el state y re-renderizamos
            state[cat] = item;
            btn.textContent = `${displayName(item)} ▾`;
            box.remove();
            renderPreview();
          });
          box.appendChild(row);
        });

        document.body.appendChild(box);
        // colocación simple debajo del botón (puedes mejorar esto)
        const rect = btn.getBoundingClientRect();
        box.style.left = `${Math.max(8, rect.left)}px`;
        box.style.top = `${rect.bottom + window.scrollY + 6}px`;
      });

      // cambios de color en inputs (todos excepto 'base' usan el listener directo)
      if(colorInp && cat !== 'base') {
        colorInp.addEventListener('input', () => renderPreview());
      }
    });

    // sincronización especial: cuando cambia la base se propaga a nariz/orejas y boca recibe versión más oscura
    if (colorInputs['base']) {
      colorInputs['base'].addEventListener('input', (ev) => {
        const baseColor = ev.target.value;
        // copiar color base a nariz y orejas (si existen)
        if (colorInputs['nariz']) {
          colorInputs['nariz'].value = baseColor;
        }
        if (colorInputs['orejas']) {
          colorInputs['orejas'].value = baseColor;
        }
        // aplicar a boca un tono ligeramente más oscuro (6%)
        const mouthDarker = darkenHex(baseColor, 0.06);
        if (colorInputs['boca']) {
          colorInputs['boca'].value = mouthDarker;
        }
        renderPreview();
      });
    }

    // click global para cerrar dropdowns al hacer click fuera
    document.addEventListener('click', (e) => {
      if(!e.target.closest('.ctrl-select') && !e.target.closest('.ctrl-thumbs')) closeAllDropdowns();
    });

    // render inicial
    renderPreview();
  }).catch(err => {
    console.error('Error fetching assets', err);
  });

  // helpers de UI
  function displayName(item){
    if(!item) return '—';
    return item.name || (item.lineart ? item.lineart.split('/').pop() : item.fondo ? item.fondo.split('/').pop() : 'item');
  }

  function closeAllDropdowns(){
    document.querySelectorAll('.ctrl-thumbs.active').forEach(n => n.remove());
  }

  // renderPreview: dibuja guía (si existe), y luego para cada capa del renderOrder dibuja
  // primero el fondo (tintado) y después el lineart encima
  async function renderPreview(){
    // limpiar canvas
    ctx.clearRect(0,0,SIZE,SIZE);

    // dibujar guía primero (capa inmutable de referencia)
    if(guideURL){
      await drawImageSafe(guideURL);
    }

    // recorrer el orden de capas (de abajo hacia arriba)
    for(const layer of renderOrder){
      const sel = state[layer];
      if(!sel) continue;

      // 1) fondo: si existe, aplicar tintado según el input de color correspondiente
      const fondoURL = sel.fondo || null;
      if(fondoURL){
        await drawImageWithTintIfNeeded(fondoURL, colorInputs[layer]);
      }

      // 2) lineart: dibujar encima (sin tintar)
      const lineartURL = sel.lineart || null;
      if(lineartURL){
        await drawImageSafe(lineartURL);
      }
    }
  }

  // dibuja una imagen en el canvas principal; resuelve incluso si hay error de carga
  function drawImageSafe(src){
    return new Promise(res => {
      if(!src){ res(); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        res();
      };
      img.onerror = () => { console.warn('img load error', src); res(); };
      img.src = src;
    });
  }

  // dibuja la imagen en un canvas temporal, aplica tintado (si colorInput tiene valor)
  // y luego compone ese resultado sobre el canvas principal
  function drawImageWithTintIfNeeded(src, colorInput){
    return new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if(colorInput && colorInput.value){
          // canvas temporal: dibujamos la capa, luego rellenamos con el color usando source-atop
          const tmp = document.createElement('canvas');
          tmp.width = SIZE; tmp.height = SIZE;
          const tctx = tmp.getContext('2d');
          tctx.clearRect(0,0,SIZE,SIZE);
          tctx.drawImage(img, 0, 0, SIZE, SIZE);
          tctx.globalCompositeOperation = 'source-atop';
          tctx.fillStyle = colorInput.value;
          tctx.fillRect(0,0,SIZE,SIZE);
          tctx.globalCompositeOperation = 'source-over';
          // compositamos el resultado en el canvas principal
          ctx.drawImage(tmp, 0, 0, SIZE, SIZE);
          res();
        } else {
          // si no hay color, dibujamos la imagen tal cual
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          res();
        }
      };
      img.onerror = () => { console.warn('fondo load error', src); res(); };
      img.src = src;
    });
  }

  // botones: actualizar y reset
  const btnPreview = document.getElementById('btn-preview');
  const btnReset = document.getElementById('btn-reset');
  if(btnPreview) btnPreview.addEventListener('click', () => renderPreview());
  if(btnReset) btnReset.addEventListener('click', () => {
    // reset: devolver a la primera variante por categoría y colores en blanco
    if(!assets) return;
    categories.forEach(cat => {
      const list = (assets[cat] || []);
      const btn = selectBtns[cat];
      state[cat] = list.length ? list[0] : null;
      if(btn) btn.textContent = state[cat] ? `${displayName(state[cat])} ▾` : '— ▾';
      const color = colorInputs[cat];
      if(color) color.value = '#ffffff';
    });
    renderPreview();
  });

  // helper público para descargar la previsualización actual como PNG (client-side)
  window.downloadPreviewPNG = function(filename='xpresarte.png', size=512){
    // crear canvas de salida a la resolución deseada
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const outCtx = out.getContext('2d');
    // dibujar el canvas visible escalado a la resolución de salida
    outCtx.drawImage(canvas, 0, 0, size, size);
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  };
});
