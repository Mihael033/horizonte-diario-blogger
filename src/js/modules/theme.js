// Modo oscuro: botón [data-js=theme-toggle] (aria-pressed = oscuro activo).
// Sin elección guardada manda prefers-color-scheme; head.js aplica la guardada antes del CSS.
import { js, reducedMotion } from './dom.js';
import { STORAGE_THEME, THEME_COLORS } from './config.js';

const root = document.documentElement;
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export const currentTheme = () => root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');

function syncUi(btn) {
  const dark = currentTheme() === 'dark';
  if (btn) btn.setAttribute('aria-pressed', String(dark));
  const explicit = root.getAttribute('data-theme');
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const own = /dark/.test(meta.getAttribute('media') || '') ? THEME_COLORS.dark : THEME_COLORS.light;
    meta.setAttribute('content', explicit ? THEME_COLORS[explicit] : own);
  }
}

function apply(theme, btn) {
  root.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_THEME, theme); } catch { /* modo privado */ }
  syncUi(btn);
}

export function initTheme() {
  const btn = js('theme-toggle');
  syncUi(btn);
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => syncUi(btn));
  }
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (typeof document.startViewTransition !== 'function' || reducedMotion()) { apply(next, btn); return; }
    // Centro del botón: el CSS hace la revelación circular desde ahí.
    const r = btn.getBoundingClientRect();
    root.style.setProperty('--vt-x', `${Math.round(r.left + r.width / 2)}px`);
    root.style.setProperty('--vt-y', `${Math.round(r.top + r.height / 2)}px`);
    const update = () => apply(next, btn);
    try {
      document.startViewTransition({ update, types: ['theme'] });
    } catch {
      document.startViewTransition(update);
    }
  });
}
