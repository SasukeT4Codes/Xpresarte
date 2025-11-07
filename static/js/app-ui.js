// static/js/app-ui.js
// UI: binding DOM, dropdowns, inputs y sincronizaciones.
// Depende de AppCore y AppRenderer. (AppActions se carga después y se invoca desde aquí.)

document.addEventListener('DOMContentLoaded', async () => {
  const core = window.AppCore;
  const renderer = window.AppRenderer;
  if(!core || !renderer){ console.error('AppUI: dependencias faltantes'); return; }

  // contenedor y canvas
  const container = document.getElementById('preview-canvas');
  if(!container){ console.error('AppUI: #preview-canvas no encontrado'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = core.SIZE; canvas.height = core.SIZE;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  container.innerHTML = '';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // referencias DOM por convención select-<cat> y color-<cat>
  const selectBtns = {};
  const colorInputs = {};
  core.categories.forEach(c=>{
    selectBtns[c] = document.getElementById(`select-${c}`);
    colorInputs[c] = document.getElementById(`color-${c}`);
  });

  // cargar assets y poblar estado
  const assets = await core.loadAssets();
  core.categories.forEach(cat => {
    const list = (assets && assets[cat]) ? assets[cat] : [];
    core.state[cat] = list.length ? list[0] : null;
    if(core.state[cat]) {
      // inyectar valor de color si el control existe (solo para uso interno)
      const ci = colorInputs[cat];
      core.state[cat]._colorValue = ci ? ci.value : undefined;
    }
  });

  function displayName(item){
    if(!item) return '—';
    return item.name || (item.lineart ? item.lineart.split('/').pop() : item.fondo ? item.fondo.split('/').pop() : 'item');
  }

  function closeAllDropdowns(){ document.querySelectorAll('.ctrl-thumbs.active').forEach(n=>n.remove()); }

  function openThumbs(cat, list, btn){
    closeAllDropdowns();
    const box = document.createElement('div');
    box.className = 'ctrl-thumbs active';
    (list || []).forEach(item=>{
      const row = document.createElement('div'); row.className = 'ctrl-thumb-row';
      const img = document.createElement('img'); img.src = item.lineart || item.fondo || '';
      const label = document.createElement('div'); label.className = 'thumb-label'; label.textContent = displayName(item);
      row.appendChild(img); row.appendChild(label);
      row.addEventListener('click', () => {
        core.state[cat] = item;
        // actualizar valor de color guardado interno del item
        if(colorInputs[cat]) core.state[cat]._colorValue = colorInputs[cat].value;
        if(btn) btn.textContent = `${displayName(item)} ▾`;
        box.remove();

        // si cambiamos peinado, sincronizar espalda color (si input existe)
        if(cat === 'peinado'){
          const pColor = colorInputs['peinado'] ? colorInputs['peinado'].value : null;
          if(pColor && colorInputs['espalda']){
            colorInputs['espalda'].value = renderer.darkenHex(pColor, 0.07);
            // actualizar valor interno de estado espalda si existe
            if(core.state['espalda']) core.state['espalda']._colorValue = colorInputs['espalda'].value;
          }
        }

        renderer.render(ctx);
      });
      box.appendChild(row);
    });
    document.body.appendChild(box);
    const rect = (btn && btn.getBoundingClientRect()) || {left:8, bottom:0};
    box.style.left = `${Math.max(8, rect.left)}px`;
    box.style.top = `${rect.bottom + window.scrollY + 6}px`;
  }

  // llenar botones y listeners
  core.categories.forEach(cat => {
    const list = (assets && assets[cat]) ? assets[cat] : [];
    const btn = selectBtns[cat];
    const ci = colorInputs[cat];
    if(!btn) return;
    btn.textContent = list.length ? `${displayName(list[0])} ▾` : '— ▾';
    btn.addEventListener('click', (e) => { e.preventDefault(); openThumbs(cat, list, btn); });

    // color input listeners
    if(ci){
      // base special: propagate to nariz/orejas and darker boca
      if(cat === 'base'){
        ci.addEventListener('input', (ev) => {
          const val = ev.target.value;
          if(colorInputs['nariz']) colorInputs['nariz'].value = val;
          if(colorInputs['orejas']) colorInputs['orejas'].value = val;
          if(colorInputs['boca']) colorInputs['boca'].value = renderer.darkenHex(val, 0.06);

          // actualizar state._color_value para capas afectadas
          ['base','nariz','orejas','boca'].forEach(k=>{
            if(core.state[k]) core.state[k]._colorValue = colorInputs[k] ? colorInputs[k].value : undefined;
          });
          renderer.render(ctx);
        });
      } else if(cat === 'peinado'){
        // peinado special: update espalda color (-7%) when peinado color changes
        ci.addEventListener('input', (ev) => {
          const val = ev.target.value;
          if(colorInputs['espalda']) {
            colorInputs['espalda'].value = renderer.darkenHex(val, 0.07);
            if(core.state['espalda']) core.state['espalda']._colorValue = colorInputs['espalda'].value;
          }
          if(core.state['peinado']) core.state['peinado']._colorValue = val;
          renderer.render(ctx);
        });
      } else {
        // general: update internal color and re-render
        ci.addEventListener('input', () => {
          if(core.state[cat]) core.state[cat]._colorValue = ci.value;
          renderer.render(ctx);
        });
      }
    }
  });

  // botones actualizar y reset
  const btnPreview = document.getElementById('btn-preview');
  const btnReset = document.getElementById('btn-reset');

  // Referencias a la sección acciones y botones dentro de ella
  const accionesSection = document.getElementById('acciones');
  const btnDownloadImage = document.getElementById('btn-download-image');
  const btnPrintSheet = document.getElementById('btn-print-sheet');
  // asegurar que inicialmente estén deshabilitados / ocultos según tu HTML
  if (accionesSection) accionesSection.style.display = accionesSection.style.display || 'none';
  if (btnDownloadImage) btnDownloadImage.disabled = true;
  if (btnPrintSheet) btnPrintSheet.disabled = true;

  // Listener de Reset (mantiene comportamiento previo)
  if(btnReset) btnReset.addEventListener('click', () => {
    if(!assets) return;
    core.categories.forEach(cat => {
      const list = (assets && assets[cat]) ? assets[cat] : [];
      core.state[cat] = list.length ? list[0] : null;
      if(selectBtns[cat]) selectBtns[cat].textContent = core.state[cat] ? `${displayName(core.state[cat])} ▾` : '— ▾';
      if(colorInputs[cat]) colorInputs[cat].value = '#ffffff';
      if(core.state[cat]) core.state[cat]._colorValue = colorInputs[cat] ? colorInputs[cat].value : undefined;
    });
    renderer.render(ctx);
  });

  // Listener de Actualizar: render + delega a AppActions para mostrar sección y preparar descargas
  if (btnPreview) {
    btnPreview.addEventListener('click', async () => {
      // 1) render normal
      await renderer.render(ctx);

      // 2) delegar en AppActions si está disponible (mostrará la sección y preparará botones)
      const actionsModule = window.AppActions;
      if (actionsModule && actionsModule.handlePreviewClick) {
        try {
          await actionsModule.handlePreviewClick({
            canvas: canvas,
            accionesSectionId: 'acciones',
            btnDownloadId: 'btn-download-image',
            btnPrintId: 'btn-print-sheet',
            previewHolderId: 'acciones-preview',
            outlinePx: 3,
            rows: 4,
            cols: 3
          });
        } catch (err) {
          console.error('AppActions error', err);
          // fallback: mostrar la sección sin generar archivos
          if (accionesSection) accionesSection.style.display = 'block';
          if (btnDownloadImage) btnDownloadImage.disabled = false;
          if (btnPrintSheet) btnPrintSheet.disabled = false;
        }
      } else {
        // fallback simple si AppActions no está cargado
        if (accionesSection) accionesSection.style.display = 'block';
        if (btnDownloadImage) btnDownloadImage.disabled = false;
        if (btnPrintSheet) btnPrintSheet.disabled = false;
      }
    });
  }

  document.addEventListener('click', (e) => {
    if(!e.target.closest('.ctrl-select') && !e.target.closest('.ctrl-thumbs')) closeAllDropdowns();
  });

  // render inicial
  renderer.render(ctx);

  // export helper cliente (opcional)
  window.downloadPreviewPNG = function(filename='xpresarte.png', size=512){
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const outCtx = out.getContext('2d');
    outCtx.drawImage(canvas, 0, 0, size, size);
    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  };
});
