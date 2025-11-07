// static/js/app-renderer.js
// Encapsula carga de imágenes, tintado y render. Usa window.AppCore para estado/datos.
// Expondrá AppRenderer.render(ctx) y utilidades de color.

(function(){
  const core = window.AppCore;
  if(!core) {
    console.error('AppRenderer: AppCore no cargado');
    return;
  }
  const SIZE = core.SIZE;

  // ---- utilidades de color ----
  function hexToRgb(hex) {
    hex = (hex||'').replace('#','');
    if(hex.length === 3) hex = hex.split('').map(h=>h+h).join('');
    return {
      r: parseInt(hex.substring(0,2) || '0', 16),
      g: parseInt(hex.substring(2,4) || '0', 16),
      b: parseInt(hex.substring(4,6) || '0', 16)
    };
  }
  function rgbToHex(r,g,b){
    const toHex = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function darkenHex(hex, percent) {
    const c = hexToRgb(hex);
    const f = 1 - percent;
    return rgbToHex(c.r * f, c.g * f, c.b * f);
  }

  // ---- carga de imágenes (robusta) ----
  function loadImage(src){
    return new Promise(res => {
      if(!src){ res(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => { console.warn('loadImage error', src); res(null); };
      img.src = src;
    });
  }

  async function drawImageSafe(ctx, src){
    const img = await loadImage(src);
    if(!img) return;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  }

  async function drawImageWithTint(ctx, src, colorValue){
    const img = await loadImage(src);
    if(!img) return;
    if(colorValue){
      const tmp = document.createElement('canvas');
      tmp.width = SIZE; tmp.height = SIZE;
      const tctx = tmp.getContext('2d');
      tctx.clearRect(0,0,SIZE,SIZE);
      tctx.drawImage(img, 0, 0, SIZE, SIZE);
      tctx.globalCompositeOperation = 'source-atop';
      tctx.fillStyle = colorValue;
      tctx.fillRect(0,0,SIZE,SIZE);
      tctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0, SIZE, SIZE);
    } else {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
    }
  }

  // ---- render principal ----
  async function render(ctx){
    if(!ctx) return;
    ctx.clearRect(0,0,SIZE,SIZE);

    // guía global si existe
    const guide = core.guideHolder();
    if(guide) await drawImageSafe(ctx, guide);

    // preparar candidata espalda si peinado tiene id y existe assets.espalda
    const assets = core.assetsHolder();
    const peinadoSel = core.state['peinado'];
    let espaldaCandidate = null;
    if(peinadoSel && assets && assets['espalda']){
      espaldaCandidate = assets['espalda'].find(it => it.id === peinadoSel.id) || null;
    }

    for(const layer of core.renderOrder){
      let sel = null;
      if(layer === 'espalda') sel = espaldaCandidate;
      else sel = core.state[layer];
      if(!sel) continue;

      // determinar color a usar para la capa:
      // la UI puede haber colocado sel._colorValue (string hex) si quiere; si no existe, será undefined.
      let colorValue = (sel && sel._colorValue) ? sel._colorValue : null;

      // especiales: si layer es 'espalda' y no tenemos colorValue,
      // intentar derivar de peinado (-7%) si peinado tiene _colorValue
      if(layer === 'espalda' && !colorValue){
        const p = core.state['peinado'];
        if(p && p._colorValue){
          colorValue = darkenHex(p._colorValue, 0.07);
        }
      }

      // Si layer es 'espalda' o cualquier otro, aplicamos fondo tintado primero
      if(sel.fondo) await drawImageWithTint(ctx, sel.fondo, colorValue);
      if(sel.lineart) await drawImageSafe(ctx, sel.lineart);
    }
  }

  // Exponer renderer y utilidades
  window.AppRenderer = {
    render,
    darkenHex,
    hexToRgb,
    rgbToHex,
    _internal: { drawImageSafe, drawImageWithTint, loadImage }
  };
})();
