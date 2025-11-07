// static/js/app-actions.js
// Funciones de "acciones": outline, generación A4 y handler que se ejecuta solo al hacer click en Actualizar.
// Depende de que app-ui.js haya creado el <canvas> de previsualización y exponga referencias necesarias.

(function(){
  // createOutlinedCanvas corregida: contorno negro exterior + fondo blanco interior
  function createOutlinedCanvas(srcCanvas, outlinePx = 3) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');

    // 1) fondo blanco (interior)
    octx.fillStyle = '#ffffff';
    octx.fillRect(0,0,w,h);

    // 2) crear máscara (alpha) del src: dibujamos el src en un canvas 'mask'
    const mask = document.createElement('canvas');
    mask.width = w; mask.height = h;
    const mctx = mask.getContext('2d');
    mctx.clearRect(0,0,w,h);
    mctx.drawImage(srcCanvas, 0, 0, w, h);

    // 3) crear outline dibujando la máscara desplazada y rellenándola de negro
    const offsets = [
      [-outlinePx, 0],[outlinePx,0],[0,-outlinePx],[0,outlinePx],
      [-outlinePx,-outlinePx],[-outlinePx,outlinePx],[outlinePx,-outlinePx],[outlinePx,outlinePx]
    ];

    offsets.forEach(([dx,dy]) => {
      octx.save();
      // dibujamos la máscara desplazada en el canvas de salida
      octx.globalCompositeOperation = 'source-over';
      octx.drawImage(mask, dx, dy, w, h);
      // rellenamos solo donde hay alpha (la máscara) con negro usando source-in
      octx.globalCompositeOperation = 'source-in';
      octx.fillStyle = '#000000';
      octx.fillRect(0,0,w,h);
      octx.restore();
    });

    // 4) dibujar la imagen original encima del outline
    octx.drawImage(mask, 0, 0, w, h);

    return out;
  }

  // createA4CanvasFrom ajustada para reducir 1% y evitar overflow que genere hoja extra
  function createA4CanvasFrom(srcCanvas, rows=4, cols=3) {
    // A4 @300dpi: 2480 x 3508 px
    const A4_W = 2480, A4_H = 3508;
    const out = document.createElement('canvas');
    out.width = A4_W; out.height = A4_H;
    const octx = out.getContext('2d');

    // fondo blanco
    octx.fillStyle = '#ffffff';
    octx.fillRect(0,0,A4_W,A4_H);

    const padding = 36; // px margen entre celdas
    const cellW = Math.floor((A4_W - padding*(cols+1)) / cols);
    const cellH = Math.floor((A4_H - padding*(rows+1)) / rows);
    let cellSize = Math.min(cellW, cellH); // cuadrado

    // reducir 1% para evitar overflow que genere una segunda hoja
    cellSize = Math.floor(cellSize * 0.99);

    for (let r=0; r<rows; r++){
      for (let c=0; c<cols; c++){
        const x = padding + c*(cellSize + padding);
        const y = padding + r*(cellSize + padding);
        octx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, x, y, cellSize, cellSize);
      }
    }

    return out;
  }

  // Manejador principal que se expone para que app-ui lo invoque
  async function handlePreviewClick(options) {
    // options: { canvas, accionesSectionId, btnDownloadId, btnPrintId, previewHolderId, outlinePx, rows, cols }
    if(!options || !options.canvas) return;
    const canvas = options.canvas;
    const accionesSection = document.getElementById(options.accionesSectionId || 'acciones');
    const btnDownloadImage = document.getElementById(options.btnDownloadId || 'btn-download-image');
    const btnPrintSheet = document.getElementById(options.btnPrintId || 'btn-print-sheet');
    const previewHolderId = options.previewHolderId || 'acciones-preview';
    const outlinePx = (typeof options.outlinePx === 'number') ? options.outlinePx : 3;
    const rows = options.rows || 4;
    const cols = options.cols || 3;

    // 1) crear outline (sin pasar por imagen externa, trabajamos sobre canvas)
    const outlineCanvas = await (async () => {
      try {
        return createOutlinedCanvas(canvas, outlinePx);
      } catch (e) {
        console.error('createOutlinedCanvas error', e);
        // fallback: devolver copia simple
        const copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        copy.getContext('2d').drawImage(canvas, 0, 0);
        return copy;
      }
    })();

    // 2) mostrar sección acciones y habilitar botones
    if(accionesSection) accionesSection.style.display = 'block';
    if(btnDownloadImage) btnDownloadImage.disabled = false;
    if(btnPrintSheet) btnPrintSheet.disabled = false;

    // 3) actualizar mini-preview si existe
    const previewHolder = document.getElementById(previewHolderId);
    if (previewHolder) {
      previewHolder.innerHTML = '';
      const thumb = document.createElement('img');
      thumb.src = outlineCanvas.toDataURL('image/png');
      thumb.alt = 'Preview';
      thumb.style.width = '100%';
      thumb.style.height = '100%';
      thumb.style.objectFit = 'contain';
      previewHolder.appendChild(thumb);
    }

    // 4) asignar comportamiento botones
    if (btnDownloadImage) {
      btnDownloadImage.onclick = () => {
        const url = outlineCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'xpresarte-sticker-outline.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
    }

    // 5) preparar A4 (reducción aplicada dentro de createA4CanvasFrom)
    const a4Canvas = createA4CanvasFrom(outlineCanvas, rows, cols);

    if (btnPrintSheet) {
      btnPrintSheet.onclick = () => {
        const dataUrl = a4Canvas.toDataURL('image/png');
        const win = window.open('');
        if (!win) return alert('No se pudo abrir la ventana de impresión (popup bloqueado)');
        win.document.write(`
          <html><head><title>Hoja A4 - Xpresarte</title>
            <style>html,body{margin:0;height:100%}img{width:100%;height:auto;display:block}</style>
          </head>
          <body><img src="${dataUrl}" alt="Hoja A4"></body></html>
        `);
        win.document.close();
        win.onload = () => { win.focus(); win.print(); };
      };
    }

    // devolver referencias por si alguien las necesita
    return { outlineCanvas, a4Canvas };
  }

  // exponer en global
  window.AppActions = {
    handlePreviewClick,
    createOutlinedCanvas,
    createA4CanvasFrom
  };
})();
