// static/js/app.js
document.addEventListener('DOMContentLoaded', () => {
  const API = '/api/assets/';
  const renderOrder = ['base','nariz','boca','ojos','barba','ropa','peinado','orejas','cejas'];
  const container = document.getElementById('preview-canvas');
  const SIZE = 1024; // resolución lógica para composición (ajusta al export si hace falta)

  // referencias a botones/inputs (de tu template)
  const categories = ['base','boca','barba','cejas','nariz','ojos','orejas','peinado','ropa'];
  const selectBtns = {};
  const colorInputs = {};
  categories.forEach(c=>{
    selectBtns[c] = document.getElementById(`select-${c}`);
    colorInputs[c] = document.getElementById(`color-${c}`);
  });

  // preview canvas
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  container.innerHTML = '';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // app state: for each category store selected id and urls { id, lineart, fondo }
  const state = {};
  categories.forEach(c => state[c] = null);
  let assets = null;   // full JSON from API
  let guideURL = null;

  // fetch assets and build UI
  fetch(API).then(r => r.json()).then(json => {
    assets = json;
    guideURL = (json.meta && json.meta.guide) ? json.meta.guide : null;

    // Populate each category: set default selection (first item) and attach dropdown
    categories.forEach(cat => {
      const list = (json[cat] || []);
      const btn = selectBtns[cat];
      const colorInp = colorInputs[cat];

      if(!btn) return;

      if(list.length){
        // pick first variant as default
        state[cat] = list[0];
        btn.textContent = `${displayName(list[0])} ▾`;
      } else {
        state[cat] = null;
        btn.textContent = `— ▾`;
      }

      // click opens thumbnail dropdown
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeAllDropdowns();
        const box = document.createElement('div');
        box.className = 'ctrl-thumbs active';
        // build rows
        (list.length ? list : []).forEach(item => {
          const row = document.createElement('div');
          row.className = 'ctrl-thumb-row';
          const img = document.createElement('img');
          // prefer lineart for thumb; fallback to fondo if missing
          img.src = item.lineart || item.fondo || '';
          img.alt = item.name || item.id || '';
          const label = document.createElement('div');
          label.className = 'thumb-label';
          label.textContent = displayName(item);
          row.appendChild(img);
          row.appendChild(label);
          row.addEventListener('click', () => {
            state[cat] = item;
            btn.textContent = `${displayName(item)} ▾`;
            box.remove();
            renderPreview();
          });
          box.appendChild(row);
        });

        document.body.appendChild(box);
        // position under button, simple placement (improve if needed)
        const rect = btn.getBoundingClientRect();
        box.style.left = `${Math.max(8, rect.left)}px`;
        box.style.top = `${rect.bottom + window.scrollY + 6}px`;
      });

      // color input change -> immediate render
      if(colorInp) colorInp.addEventListener('input', () => renderPreview());
    });

    // global click to close dropdowns
    document.addEventListener('click', (e) => {
      if(!e.target.closest('.ctrl-select') && !e.target.closest('.ctrl-thumbs')) closeAllDropdowns();
    });

    // initial render
    renderPreview();
  }).catch(err => {
    console.error('Error fetching assets', err);
  });

  // helpers
  function displayName(item){
    if(!item) return '—';
    return item.name || (item.lineart ? item.lineart.split('/').pop() : item.fondo ? item.fondo.split('/').pop() : 'item');
  }

  function closeAllDropdowns(){
    document.querySelectorAll('.ctrl-thumbs.active').forEach(n => n.remove());
  }

  // renderPreview: draw guide, then for each category in renderOrder draw fondo (tinted) then lineart
  async function renderPreview(){
    // clear
    ctx.clearRect(0,0,SIZE,SIZE);

    // draw guide first if present
    if(guideURL){
      await drawImageSafe(guideURL);
    }

    // iterate renderOrder (de abajo hacia arriba)
    for(const layer of renderOrder){
      const sel = state[layer];
      if(!sel) continue;

      // 1) draw fondo if exists (apply tint if color input present)
      const fondoURL = sel.fondo || null;
      if(fondoURL){
        await drawImageWithTintIfNeeded(fondoURL, colorInputs[layer]);
      }

      // 2) draw selected lineart (on top)
      const lineartURL = sel.lineart || null;
      if(lineartURL){
        await drawImageSafe(lineartURL);
      }
    }
  }

  // draw image safely (returns a Promise that resolves when done or on error)
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

  // draw image then tint it if color input exists (applies tint only to the image area)
  function drawImageWithTintIfNeeded(src, colorInput){
    return new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if(colorInput && colorInput.value){
          // draw to temp canvas, tint and composite onto main ctx
          const tmp = document.createElement('canvas');
          tmp.width = SIZE; tmp.height = SIZE;
          const tctx = tmp.getContext('2d');
          tctx.clearRect(0,0,SIZE,SIZE);
          tctx.drawImage(img, 0, 0, SIZE, SIZE);
          tctx.globalCompositeOperation = 'source-atop';
          tctx.fillStyle = colorInput.value;
          tctx.fillRect(0,0,SIZE,SIZE);
          tctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(tmp, 0, 0, SIZE, SIZE);
          res();
        } else {
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          res();
        }
      };
      img.onerror = () => { console.warn('fondo load error', src); res(); };
      img.src = src;
    });
  }

  // Buttons: preview/update and reset
  const btnPreview = document.getElementById('btn-preview');
  const btnReset = document.getElementById('btn-reset');
  if(btnPreview) btnPreview.addEventListener('click', () => renderPreview());
  if(btnReset) btnReset.addEventListener('click', () => {
    // reset to first item per category
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

  // Export helpers (client-side basic download for current canvas)
  window.downloadPreviewPNG = function(filename='xpresarte.png', size=512){
    // create export canvas at desired resolution
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const outCtx = out.getContext('2d');
    // draw current canvas scaled
    outCtx.drawImage(canvas, 0, 0, size, size);
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  };
});
