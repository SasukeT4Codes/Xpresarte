// static/js/app-core.js
// Minimal: estado compartido y carga inicial de assets.
// No dibuja ni toca el DOM. Expone AppCore.

(function(){
  const API = '/api/assets/';
  const SIZE = 1024;
  const renderOrder = ['espalda','base','nariz','boca','ojos','barba','ropa','peinado','orejas','cejas','accesorio'];
  const categories = ['espalda','base','boca','barba','cejas','nariz','ojos','orejas','peinado','ropa','accesorio'];

  // Estado inicial
  const state = {};
  categories.forEach(c => state[c] = null);
  let assets = null;
  let guideURL = null;

  async function loadAssets(){
    try {
      const res = await fetch(API);
      assets = await res.json();
      guideURL = (assets && assets.meta && assets.meta.guide) ? assets.meta.guide : null;
      return assets;
    } catch(err){
      console.error('AppCore: error cargando assets', err);
      assets = null; guideURL = null;
      return null;
    }
  }

  function assetsHolder(){ return assets; }
  function guideHolder(){ return guideURL; }

  // Exponer API mínima
  window.AppCore = {
    SIZE,
    renderOrder,
    categories,
    state,
    loadAssets,
    assetsHolder,
    guideHolder
  };
})();
