// Tarjetas creadas desde el feed: se clona <template id="tpl-card"> (marcado) y se
// rellenan sus huecos data-slot. Nunca se crea marcado de tarjeta a mano.
import { resizeImage, srcset } from './images.js';
import { formatNewsDate, formatDateTime, readingLabel, truncate } from './format.js';
import { siteRoot } from './dom.js';

const labelUrl = (label) => `${siteRoot()}search/label/${encodeURIComponent(label)}`;

/**
 * @param {import('./feed.js').FeedPost} post
 * @param {string} [variant] lead | secondary | standard | list | compact | rail…
 * @returns {HTMLElement | null}
 */
export function renderCard(post, variant) {
  const tpl = document.getElementById('tpl-card');
  if (!tpl || !('content' in tpl)) return null;
  const card = /** @type {HTMLElement} */ (tpl.content.firstElementChild.cloneNode(true));
  const slot = (name) => Array.from(card.querySelectorAll(`[data-slot="${name}"]`));
  card.dataset.postId = post.id;
  if (post.section) card.dataset.section = post.section;
  if (variant) card.classList.add(`c-card--${variant}`);

  for (const a of slot('url')) a.setAttribute('href', post.url);
  for (const t of slot('title')) t.textContent = post.title;
  for (const p of slot('excerpt')) p.textContent = truncate(post.excerpt, 140);

  for (const img of slot('img')) {
    if (post.image) {
      img.setAttribute('src', resizeImage(post.image, 800));
      const set = srcset(post.image);
      if (set) img.setAttribute('srcset', set); else img.removeAttribute('srcset');
      img.setAttribute('alt', '');
    } else {
      const box = img.parentElement;
      if (box && box !== card && box.children.length === 1) box.remove(); else img.remove();
      card.classList.add('has-no-image');
    }
  }
  for (const s of slot('section')) {
    if (post.section) {
      s.textContent = post.section;
      s.setAttribute('href', labelUrl(post.section));
    } else {
      s.remove();
    }
  }
  for (const time of slot('date')) {
    time.setAttribute('datetime', post.published);
    time.setAttribute('title', formatDateTime(post.published));
    time.textContent = formatNewsDate(post.published);
  }
  for (const r of slot('readtime')) {
    if (post.minutes) r.textContent = readingLabel(post.minutes); else r.remove();
  }
  return card;
}

/**
 * Vacía (esqueletos incluidos) y rellena un contenedor [data-js=card-list] / [data-js=post-list].
 * Respeta data-card (variante) y data-card-first (variante de la primera tarjeta).
 */
export function fillList(container, posts, { append = false } = {}) {
  if (!append) container.replaceChildren();
  const variant = container.dataset.card;
  const first = container.dataset.cardFirst;
  const frag = document.createDocumentFragment();
  posts.forEach((post, i) => {
    const card = renderCard(post, !append && i === 0 && first ? first : variant);
    if (card) frag.appendChild(card);
  });
  const added = Array.from(frag.children);
  container.appendChild(frag);
  return added;
}

/** Ids de las noticias que ya están en la página (para no repetirlas). */
export const visiblePostIds = (root = document) => new Set(Array.from(root.querySelectorAll('[data-post-id]')).map((el) => el.dataset.postId).filter(Boolean));
