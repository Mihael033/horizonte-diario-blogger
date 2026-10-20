// Búsqueda en panel: abrir = quitar hidden + is-open; cerrar = al revés. Resultados rápidos del
// feed mientras se escribe (tarjetas compactas); Intro envía el formulario a /search?q= de Blogger.
// Teclado: Esc cierra, ↓/↑ recorren los resultados, el foco queda dentro del panel abierto.
import { js, jsAll, trapFocus, lockScroll, debounce, reducedMotion, siteRoot } from './dom.js';
import { fetchFeed } from './feed.js';
import { fillList } from './cards.js';

const MIN_CHARS = 2;
const MAX_RESULTS = 6;

export function initSearch() {
  const panel = js('search');
  const input = js('search-input');
  if (!panel || !input) return;
  const toggles = jsAll('search-toggle');
  const status = js('search-status');
  const results = js('search-results');
  const scrim = js('scrim');
  let release = null;
  let lastToggle = null;
  let seq = 0;

  const isOpen = () => !panel.hidden;

  function open(trigger) {
    lastToggle = trigger || toggles[0] || null;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    for (const t of toggles) t.setAttribute('aria-expanded', 'true');
    if (scrim) scrim.hidden = false;
    lockScroll(true);
    release = trapFocus(panel);
    input.focus();
    input.select();
  }

  function close() {
    if (!isOpen()) return;
    panel.classList.remove('is-open');
    for (const t of toggles) t.setAttribute('aria-expanded', 'false');
    if (scrim && !js('menu')?.classList.contains('is-open')) scrim.hidden = true;
    lockScroll(false);
    release?.();
    release = null;
    const finish = () => { panel.hidden = true; };
    if (reducedMotion()) finish(); else setTimeout(finish, 250);
    lastToggle?.focus();
  }

  for (const t of toggles) t.addEventListener('click', () => (isOpen() ? close() : open(t)));
  for (const c of jsAll('search-close')) c.addEventListener('click', close);
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  scrim?.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); }
    // Atajo "/" para abrir la búsqueda, salvo si ya se está escribiendo en un campo.
    if (e.key === '/' && !isOpen() && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) {
      e.preventDefault();
      open();
    }
  });

  // Navegación con flechas entre el campo y los enlaces de resultados.
  const resultLinks = () => (results ? Array.from(results.querySelectorAll('a[data-slot="url"], a[data-js="search-all"]')).filter((a) => a.getAttribute('aria-hidden') !== 'true' && a.getAttribute('tabindex') !== '-1') : []);
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = resultLinks();
    if (!links.length) return;
    const i = links.indexOf(/** @type {HTMLAnchorElement} */ (document.activeElement));
    if (e.key === 'ArrowDown') { e.preventDefault(); links[Math.min(i + 1, links.length - 1)].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) input.focus(); else links[i - 1].focus(); }
  });

  if (!results) return;
  const say = (text) => { if (status) status.textContent = text; };

  const run = debounce(async () => {
    const q = input.value.trim();
    const mine = ++seq;
    if (q.length < MIN_CHARS) { results.replaceChildren(); results.hidden = true; say(''); return; }
    say('Buscando…');
    results.setAttribute('aria-busy', 'true');
    try {
      const { posts, total } = await fetchFeed({ q, max: MAX_RESULTS, summary: true });
      if (mine !== seq) return; // llegó tarde: ya hay otra búsqueda
      if (!posts.length) {
        results.replaceChildren();
        results.hidden = true;
        say(`No hay resultados para «${q}».`);
        return;
      }
      fillList(results, posts);
      if (total > posts.length) {
        const all = document.createElement('a');
        all.className = 'c-search__all';
        all.dataset.js = 'search-all';
        all.href = `${siteRoot()}search?q=${encodeURIComponent(q)}`;
        all.textContent = `Ver los ${total} resultados`;
        results.appendChild(all);
      }
      results.hidden = false;
      say(total === 1 ? '1 resultado.' : `${total} resultados. Usa las flechas para recorrerlos.`);
    } catch (err) {
      if (mine !== seq) return;
      console.warn('[Horizonte] Búsqueda:', err);
      say('No se pudo buscar ahora. Pulsa Intro para buscar en la página de resultados.');
    } finally {
      if (mine === seq) results.removeAttribute('aria-busy');
    }
  }, 250);
  input.addEventListener('input', run);
}
