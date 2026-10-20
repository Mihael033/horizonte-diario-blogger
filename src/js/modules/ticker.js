// "Última hora". Si el gadget trae su lista (ul > li > a) se usa tal cual; si no, se rellena con
// las últimas entradas del feed. Para el desplazamiento continuo se duplica la lista una vez
// (copia con aria-hidden y enlaces fuera del orden de tabulación). Pausa: aria-pressed + is-paused.
import { js, reducedMotion } from './dom.js';
import { fetchFeed } from './feed.js';

const MAX_ITEMS = 8;

function buildList(posts) {
  const ul = document.createElement('ul');
  ul.className = 'c-ticker__list';
  for (const p of posts) {
    const li = document.createElement('li');
    li.className = 'c-ticker__item';
    const a = document.createElement('a');
    a.className = 'c-ticker__link';
    a.href = p.url;
    a.textContent = p.title;
    li.appendChild(a);
    ul.appendChild(li);
  }
  return ul;
}

/**
 * Bucle continuo: los <li> se duplican DENTRO de la misma lista (una sola fila); el CSS la desplaza
 * hasta -50 %, donde empiezan las copias. Las copias van con aria-hidden y fuera del tabulador.
 */
function startLoop(ticker, track) {
  const list = track.querySelector('ul');
  if (!list || list.children.length < 2 || reducedMotion()) return;
  const width = list.scrollWidth;
  for (const li of Array.from(list.children)) {
    const copy = /** @type {HTMLElement} */ (li.cloneNode(true));
    copy.setAttribute('aria-hidden', 'true');
    for (const a of copy.querySelectorAll('a')) a.setAttribute('tabindex', '-1');
    list.appendChild(copy);
  }
  // Duración proporcional al texto (~80 px/s). El CSS la lee de --ticker-duration.
  const seconds = Math.max(20, Math.round(width / 80));
  ticker.style.setProperty('--ticker-duration', `${seconds}s`);
  ticker.classList.add('is-running');
}

export async function initTicker() {
  const ticker = js('ticker');
  const track = js('ticker-track');
  if (!ticker || !track) return;
  const pause = js('ticker-pause', ticker);
  pause?.addEventListener('click', () => {
    const paused = pause.getAttribute('aria-pressed') !== 'true';
    // El nombre del botón no cambia: aria-pressed ya anuncia si está en pausa.
    pause.setAttribute('aria-pressed', String(paused));
    ticker.classList.toggle('is-paused', paused);
  });

  const curated = track.querySelector('ul a[href]');
  if (curated) {
    track.querySelector('ul').classList.add('c-ticker__list');
    startLoop(ticker, track);
    return;
  }
  ticker.setAttribute('aria-busy', 'true');
  try {
    const { posts } = await fetchFeed({ max: MAX_ITEMS, summary: true });
    if (!posts.length) { ticker.hidden = true; return; }
    track.replaceChildren(buildList(posts));
    startLoop(ticker, track);
  } catch (err) {
    console.warn('[Horizonte] Última hora:', err);
    ticker.hidden = true;
  } finally {
    ticker.removeAttribute('aria-busy');
  }
}
