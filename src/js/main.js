// JS del tema Horizonte Diario (vanilla, sin dependencias). tools/build.mjs lo empaqueta con
// esbuild en un IIFE minificado y lo inserta al final del <body> de theme.xml.
// Cada módulo es independiente: si uno falla, los demás siguen funcionando.
import { initTheme } from './modules/theme.js';
import { initMenu } from './modules/menu.js';
import { initStickyNav, initActiveSection } from './modules/nav.js';
import { initSearch } from './modules/search.js';
import { initTicker } from './modules/ticker.js';
import { initCover, initArticleReadtime, initToc, initProgress, initShare } from './modules/article.js';
import { initLoadMore, initHomeSections, initRelated, initCardReadtimes, initDates } from './modules/lists.js';
import { initToday, initLabelLinks, initNewsletter } from './modules/misc.js';

const steps = [
  // primero lo que cambia texto visible (evita saltos tardíos)
  ['fecha de hoy', initToday],
  ['fechas', initDates],
  ['portada del artículo', initCover],
  ['tiempo de lectura', initArticleReadtime],
  ['enlaces de etiqueta', initLabelLinks],
  // interacción
  ['tema', initTheme],
  ['menú', initMenu],
  ['barra fija', initStickyNav],
  ['sección activa', initActiveSection],
  ['búsqueda', initSearch],
  ['sumario', initToc],
  ['progreso', initProgress],
  ['compartir', initShare],
  ['boletín', initNewsletter],
  // contenido que llega del feed
  ['última hora', initTicker],
  ['cargar más', initLoadMore],
  ['bloques de portada', initHomeSections],
  ['relacionadas', initRelated],
  ['lectura en tarjetas', initCardReadtimes],
];

function boot() {
  for (const [name, fn] of steps) {
    try {
      const r = fn();
      if (r && typeof r.catch === 'function') r.catch((err) => console.error(`[Horizonte] ${name}:`, err));
    } catch (err) {
      console.error(`[Horizonte] ${name}:`, err);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
