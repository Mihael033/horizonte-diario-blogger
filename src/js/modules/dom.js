// Utilidades DOM. El JS solo toca elementos con data-js (nunca clases de estilo) y aria-*.

/** Primer elemento [data-js=name] dentro de root. */
export const js = (name, root = document) => root.querySelector(`[data-js="${name}"]`);
/** Todos los [data-js=name]. */
export const jsAll = (name, root = document) => Array.from(root.querySelectorAll(`[data-js="${name}"]`));

/**
 * Raíz del blog («https://blog.example/», terminada en /), tomada de <body data-home> (homepageUrl
 * de Blogger). Sirve también si el sitio vive en una subcarpeta (preview en GitHub Pages). Si el
 * dominio coincide con el de la página, se usa su protocolo (evita contenido mixto http/https).
 */
export function siteRoot() {
  try {
    const u = new URL(document.body?.dataset.home || '/', location.href);
    if (u.host === location.host) u.protocol = location.protocol;
    u.search = '';
    u.hash = '';
    return u.href.endsWith('/') ? u.href : `${u.href}/`;
  } catch {
    return `${location.origin}/`;
  }
}

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ejecuta cuando el navegador está libre (o en el siguiente tick). */
export const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1));

/** Llama a fn cuando el elemento se acerca al viewport (una vez). */
export function whenNear(el, fn, margin = '600px') {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(el);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Elementos enfocables y visibles dentro de root. */
export const focusables = (root) => Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

/** Mantiene el foco dentro de root mientras esté activo. Devuelve la función para soltarlo. */
export function trapFocus(root) {
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = focusables(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

let overlays = 0;
/** Bloquea el scroll (html.has-overlay) mientras haya algún panel abierto (menú o búsqueda). */
export function lockScroll(on) {
  overlays = Math.max(0, overlays + (on ? 1 : -1));
  document.documentElement.classList.toggle('has-overlay', overlays > 0);
}

let toastTimer = 0;
/** Mensaje breve en el [data-js=toast] (role=status: lo leen los lectores de pantalla). */
export function toast(message) {
  const el = js('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-open'), 4000);
}

export const debounce = (fn, ms) => {
  let t = 0;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
