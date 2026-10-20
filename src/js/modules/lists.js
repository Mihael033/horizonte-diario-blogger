// Listados: "cargar más" (feed), bloques por sección de la portada, relacionadas, tiempo de
// lectura de las tarjetas que pinta Blogger y fechas en español.
import { js, jsAll, whenNear, idle, toast } from './dom.js';
import { fetchFeed } from './feed.js';
import { fillList, visiblePostIds } from './cards.js';
import { formatNewsDate, formatDateTime, readingLabel } from './format.js';

/** Consulta del listado actual según la URL de Blogger (/search/label/X, /search?q=…, portada). */
export function listingQuery(loc = location) {
  // Sin anclar al principio: el blog (o el preview) puede vivir en una subcarpeta.
  const label = /\/search\/label\/([^/?#]+)/.exec(loc.pathname);
  if (label) return { label: decodeURIComponent(label[1]) };
  const q = new URLSearchParams(loc.search).get('q');
  return q ? { q } : {};
}

/** ¿Página 2+ de Blogger (updated-max)? Ahí se deja la paginación nativa. */
const isDeepPage = (loc = location) => new URLSearchParams(loc.search).has('updated-max');

// ---------------------------------------------------------------- cargar más

export function initLoadMore() {
  const trigger = js('load-more');
  const list = js('post-list');
  if (!trigger || !list || isDeepPage()) return;
  const query = listingQuery();
  const blog = document.getElementById('Blog1') || document;
  const batch = Math.min(12, Math.max(6, blog.querySelectorAll('[data-post-id]').length));
  let loading = false;

  // El texto del enlace es del tema (marcado): aquí solo cambian estado y aria.
  trigger.setAttribute('role', 'button');
  trigger.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); trigger.click(); } });
  trigger.addEventListener('click', async (e) => {
    e.preventDefault();
    if (loading) return;
    loading = true;
    trigger.setAttribute('aria-busy', 'true');
    trigger.classList.add('is-loading');
    try {
      const shown = visiblePostIds(blog);
      const start = blog.querySelectorAll('[data-post-id]').length + 1;
      const { posts, total } = await fetchFeed({ ...query, start, max: batch });
      const fresh = posts.filter((p) => !shown.has(p.id));
      const added = fillList(list, fresh, { append: true });
      const done = start - 1 + posts.length >= total || posts.length < batch;
      if (added.length) {
        toast(added.length === 1 ? 'Se ha cargado 1 noticia más' : `Se han cargado ${added.length} noticias más`);
        added[0].querySelector('a[data-slot="url"]:not([tabindex="-1"])')?.focus({ preventScroll: false });
      }
      if (done) {
        trigger.remove();
        if (!added.length) toast('No hay más noticias');
      }
    } catch (err) {
      console.warn('[Horizonte] Cargar más:', err);
      // Sin feed: se sigue la paginación normal de Blogger.
      window.location.href = trigger.getAttribute('href');
    } finally {
      loading = false;
      if (trigger.isConnected) {
        trigger.removeAttribute('aria-busy');
        trigger.classList.remove('is-loading');
      }
    }
  });
}

// ---------------------------------------------------------------- bloques que rellena el feed

/**
 * Rellena un [data-js=home-section] o [data-js=related] con tarjetas del feed.
 * Evita repetir lo que ya se ve, salvo que eso deje el bloque con menos de 2 tarjetas.
 */
async function fillBlock(block, { exclude = new Set() } = {}) {
  const list = js('card-list', block);
  if (!list) return;
  const count = Number(block.dataset.count) || 4;
  const label = block.dataset.label || '';
  block.setAttribute('aria-busy', 'true');
  try {
    const { posts } = await fetchFeed(label ? { label, max: count + 12 } : { max: count + 12 });
    const fresh = posts.filter((p) => !exclude.has(p.id));
    const pick = (fresh.length >= Math.min(2, count) ? fresh : posts.filter((p) => !block.dataset.exclude || p.id !== block.dataset.exclude)).slice(0, count);
    if (!pick.length) { block.hidden = true; return; }
    fillList(list, pick);
  } catch (err) {
    console.warn(`[Horizonte] Bloque "${label || 'últimas'}":`, err);
    block.hidden = true;
  } finally {
    block.removeAttribute('aria-busy');
  }
}

export function initHomeSections() {
  const blocks = jsAll('home-section');
  if (!blocks.length) return;
  // Se reparten en orden: cada bloque evita lo que ya tienen la portada y los bloques anteriores.
  let chain = Promise.resolve();
  for (const block of blocks) {
    whenNear(block, () => {
      chain = chain.then(() => fillBlock(block, { exclude: visiblePostIds() }));
    });
  }
}

export function initRelated() {
  const article = document.querySelector('article[data-post-id]');
  for (const block of jsAll('related')) {
    const current = article ? article.dataset.postId : '';
    if (current) block.dataset.exclude = current;
    whenNear(block, () => fillBlock(block, { exclude: new Set([current]) }));
  }
}

// ---------------------------------------------------------------- tiempo de lectura en tarjetas

/** Las tarjetas que pinta Blogger no traen el texto completo: se calcula con el feed del listado. */
export function initCardReadtimes() {
  const body = js('post-body');
  const article = body ? body.closest('[data-post-id]') : null; // su tiempo lo calcula article.js
  const targets = jsAll('readtime').filter((el) => {
    const card = el.closest('[data-post-id]');
    return el.hidden && card && card !== article;
  });
  if (!targets.length) return;
  idle(async () => {
    try {
      const ids = new Set(targets.map((el) => el.closest('[data-post-id]').dataset.postId));
      const { posts } = await fetchFeed({ ...listingQuery(), max: Math.min(50, ids.size + 6) });
      const minutes = new Map(posts.map((p) => [p.id, p.minutes]));
      for (const el of targets) {
        const m = minutes.get(el.closest('[data-post-id]').dataset.postId);
        if (m) { el.textContent = readingLabel(m); el.hidden = false; }
      }
    } catch (err) {
      console.warn('[Horizonte] Tiempo de lectura:', err);
    }
  });
}

// ---------------------------------------------------------------- fechas

export function initDates(now = new Date()) {
  for (const time of jsAll('date')) {
    const iso = time.getAttribute('datetime');
    if (!iso) continue;
    const text = formatNewsDate(iso, now);
    if (!text) continue;
    if (!time.title) time.title = formatDateTime(iso);
    time.textContent = text;
  }
}
