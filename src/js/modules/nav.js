// Barra de secciones: is-stuck cuando queda fija arriba y sección activa en las noticias.
import { js } from './dom.js';

export function initStickyNav() {
  const nav = js('nav');
  const sentinel = js('nav-sentinel');
  if (!nav || !sentinel || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    nav.classList.toggle('is-stuck', !entry.isIntersecting);
  }).observe(sentinel);
}

/** En una noticia, marca en el menú la sección a la que pertenece (is-active; no es la página actual). */
export function initActiveSection() {
  const article = document.querySelector('article[data-post-id][data-section]');
  const menu = js('menu');
  if (!article || !menu || !js('post-body')) return;
  const section = article.dataset.section;
  for (const link of menu.querySelectorAll('a[data-section]')) {
    if (link.dataset.section === section && !link.hasAttribute('aria-current')) link.classList.add('is-active');
  }
}
