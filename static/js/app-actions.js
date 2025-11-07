// static/js/app-actions.js
// Acciones: genera outlines (blanco -> negro), conserva "Tomate" (PNG con doble outline y transparencia)
// y "Malvavisco" (misma imagen pero con fondo blanco) y prepara descarga e impresión A4 4x3.
// Depende de que app-ui.js haya creado el <canvas> de previsualización y exponga referencias necesarias.

(function(){
  // util: bounding box de píxeles no transparentes
  function getOpaqueBounds(canvas) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i+3] !== 0) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return null;
    return { x: minX, y: minY, w: (maxX - minX + 1), h: (maxY - minY + 1) };
  }

  // dibuja un outline de color dado alrededor del contenido alfa de srcCanvas
  // devuelve canvas del mismo tamaño que srcCanvas con outline (transparente fuera del contenido)
  function drawColoredOutline(srcCanvas, outlinePx, color) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const mctx = mask.getContext('2d');
    mctx.clearRect(0,0,w,h);
    mctx.drawImage(srcCanvas, 0, 0, w, h);

    const outline = document.createElement('canvas');
    outline.width = w; outline.height = h;
    const octx = outline.getContext('2d');

    const offsets = [
      [-outlinePx, 0],[outlinePx,0],[0,-outlinePx],[0,outlinePx],
      [-outlinePx,-outlinePx],[-outlinePx,outlinePx],[outlinePx,-outlinePx],[outlinePx,outlinePx]
    ];

    offsets.forEach(([dx,dy]) => {
      octx.save();
      octx.globalCompositeOperation = 'source-over';
      octx.drawImage(mask, dx, dy, w, h);
      octx.globalCompositeOperation = 'source-in';
      octx.fillStyle = color;
      octx.fillRect(0,0,w,h);
      octx.restore();
    });

    return outline;
  }

  // Combina imagen base con outlineCanvas encima (outlineCanvas puede tener only outline)
  function combineOutlineAndBase(baseCanvas, outlineCanvas) {
    const w = Math.max(baseCanvas.width, outlineCanvas.width);
    const h = Math.max(baseCanvas.height, outlineCanvas.height);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(outlineCanvas, 0, 0, outlineCanvas.width, outlineCanvas.height);
    ctx.drawImage(baseCanvas, 0, 0, baseCanvas.width, baseCanvas.height);
    return out;
  }

  // tight-crop canvas to content alpha and (optionally) fill cropped background with white
  function tightCropCanvas(srcCanvas, fillWhiteInsideCrop = false) {
    const bounds = getOpaqueBounds(srcCanvas);
    if (!bounds) {
      // no content: return a same-size copy with optional white fill
      const copy = document.createElement('canvas');
      copy.width = srcCanvas.width; copy.height = srcCanvas.height;
      const cc = copy.getContext('2d');
      if (fillWhiteInsideCrop) {
        cc.fillStyle = '#ffffff';
        cc.fillRect(0,0,copy.width, copy.height);
      } else {
        cc.clearRect(0,0,copy.width, copy.height);
      }
      cc.drawImage(srcCanvas, 0, 0);
      return copy;
    }
    const cropped = document.createElement('canvas');
    cropped.width = bounds.w; cropped.height = bounds.h;
    const cctx = cropped.getContext('2d');
    if (fillWhiteInsideCrop) {
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(0,0,bounds.w,bounds.h);
    } else {
      cctx.clearRect(0,0,bounds.w,bounds.h);
    }
    cctx.drawImage(srcCanvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    return cropped;
  }

  // crea hoja A4 con grid rows x cols usando srcCanvas (ya debe tener fondo blanco si se quiere)
  // reduce ligeramente cada celda para evitar overflow (factor 0.99)
  function createA4CanvasFrom(srcCanvas, rows = 4, cols = 3, reduction = 0.99) {
    const A4_W = 2480, A4_H = 3508;
    const out = document.createElement('canvas');
    out.width = A4_W; out.height = A4_H;
    const octx = out.getContext('2d');

    // hoja blanca
    octx.fillStyle = '#ffffff';
    octx.fillRect(0,0,A4_W,A4_H);

    const padding = 36;
    const totalHGap = padding * (cols + 1);
    const totalVGap = padding * (rows + 1);
    const cellW = Math.floor((A4_W - totalHGap) / cols);
    const cellH = Math.floor((A4_H - totalVGap) / rows);
    const cellSize = Math.floor(Math.min(cellW, cellH) * reduction);

    for (let r=0; r<rows; r++){
      for (let c=0; c<cols; c++){
        const x = padding + c * (cellSize + padding);
        const y = padding + r * (cellSize + padding);

        const sw = srcCanvas.width, sh = srcCanvas.height;
        const scale = Math.min(cellSize / sw, cellSize / sh);
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        const dx = x + Math.round((cellSize - dw) / 2);
        const dy = y + Math.round((cellSize - dh) / 2);

        octx.drawImage(srcCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
      }
    }

    return out;
  }

  // main handler implementing requested steps
  async function handlePreviewClick(options) {
    if (!options || !options.canvas) return;
    const canvas = options.canvas; // preview canvas (transparent background)
    const accionesSection = document.getElementById(options.accionesSectionId || 'acciones');
    const btnDownloadImage = document.getElementById(options.btnDownloadId || 'btn-download-image');
    const btnPrintSheet = document.getElementById(options.btnPrintId || 'btn-print-sheet');
    const previewHolderId = options.previewHolderId || 'acciones-preview';
    const outlinePx = (typeof options.outlinePx === 'number') ? options.outlinePx : 3;
    const rows = options.rows || 4;
    const cols = options.cols || 3;

    // show section
    if (accionesSection) accionesSection.style.display = 'block';

    // 2.1: save preview (transparent copy)
    const srcCopy = document.createElement('canvas');
    srcCopy.width = canvas.width; srcCopy.height = canvas.height;
    const sctx = srcCopy.getContext('2d');
    sctx.clearRect(0,0,srcCopy.width, srcCopy.height);
    sctx.drawImage(canvas, 0, 0);

    // 2.2: white outline (only outline)
    const whiteOutlineOnly = drawColoredOutline(srcCopy, outlinePx, '#ffffff');

    // 2.3: combine white outline + original -> whiteOutlinedCombined
    const whiteOutlinedCombined = combineOutlineAndBase(srcCopy, whiteOutlineOnly);

    // 2.4: black outline around whiteOutlinedCombined
    const blackOutlineOnly = drawColoredOutline(whiteOutlinedCombined, outlinePx, '#000000');

    // combine black outline + whiteOutlinedCombined => double-outlined
    const doubleOutlined = combineOutlineAndBase(whiteOutlinedCombined, blackOutlineOnly);

    // 2.5: Tomate = tight crop doubleOutlined, keep transparency outside crop
    const tomate = tightCropCanvas(doubleOutlined, false);

    // 2.6: Malvavisco = tight crop doubleOutlined but fill white inside crop
    const malvavisco = tightCropCanvas(doubleOutlined, true);

    // expose for debug
    window.AppActions_internal = window.AppActions_internal || {};
    window.AppActions_internal.Tomate = tomate;
    window.AppActions_internal.Malvavisco = malvavisco;

    // preview: show Tomate (double outline with transparent outside)
    const previewHolder = document.getElementById(previewHolderId);
    if (previewHolder) {
      previewHolder.innerHTML = '';
      const img = document.createElement('img');
      img.src = tomate.toDataURL('image/png');
      img.alt = 'Preview Tomate';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      previewHolder.appendChild(img);
    }

    // wire download button -> Tomate
    if (btnDownloadImage) {
      btnDownloadImage.disabled = false;
      btnDownloadImage.onclick = () => {
        const url = tomate.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = (options.downloadFilename || 'xpresarte-sticker-outline.png');
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
    }

    // wire print button -> A4 of Malvavisco
    if (btnPrintSheet) {
      btnPrintSheet.disabled = false;
      btnPrintSheet.onclick = () => {
        const a4Canvas = createA4CanvasFrom(malvavisco, rows, cols, options.a4Reduction || 0.99);
        const dataUrl = a4Canvas.toDataURL('image/png');

        // HTML compacto (estilo similar al fragmento document.write) pero creado como Blob
        const html = `
          <html>
            <head>
              <title>Hoja A4 - Xpresarte</title>
              <meta charset="utf-8"/>
              <style>
                html,body{margin:0;height:100%;background:#ffffff}
                img{background:#ffffff;display:block;width:100%;height:auto;object-fit:contain}
              </style>
            </head>
            <body>
              <img id="xpres-img" src="${dataUrl}" alt="Hoja A4"/>
              <script>
                (function(){
                  var img = document.getElementById('xpres-img');
                  function doPrint(){ try{ window.focus(); window.print(); }catch(e){} }
                  if(img.complete && img.naturalWidth !== 0){ setTimeout(doPrint, 60); }
                  else { img.addEventListener('load', function(){ setTimeout(doPrint, 60); }); img.addEventListener('error', function(){ setTimeout(doPrint, 120); }); }
                })();
              </script>
            </body>
          </html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url);
        if (!win) {
          URL.revokeObjectURL(url);
          return alert('No se pudo abrir la ventana de impresión (popup bloqueado)');
        }
        // revocar luego para limpiar
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      };
    }

    return { Tomate: tomate, Malvavisco: malvavisco };
  }


  // expose API
  window.AppActions = {
    handlePreviewClick,
    _helpers: {
      getOpaqueBounds,
      drawColoredOutline,
      combineOutlineAndBase,
      tightCropCanvas,
      createA4CanvasFrom
    }
  };
})();
