// Página de noticia: portada (sin duplicar la 1ª imagen), tiempo de lectura, sumario (TOC),
// barra de progreso y botones de compartir.
import { js, jsAll, toast } from './dom.js';
import { readingMinutes, readingLabel, slugify } from './format.js';

// ---------------------------------------------------------------- portada

/** ¿Es este nodo solo una imagen (con o sin pie)? Formatos del editor de Blogger y <figure>. */
function imageBlock(el) {
  if (!el || !el.matches('table.tr-caption-container, .separator, figure, p, div, a, img')) return null;
  const imgs = el.matches('img') ? [el] : Array.from(el.querySelectorAll('img'));
  if (imgs.length !== 1) return null;
  const captionEl = el.querySelector('.tr-caption, figcaption');
  const caption = captionEl ? captionEl.textContent.trim() : '';
  const rest = el.textContent.replace(caption, '').trim();
  return rest ? null : { img: imgs[0], caption };
}

/** Bloques con contenido (Blogger a veces deja <div><br></div> sueltos). */
function contentBlocks(body) {
  return Array.from(body.children).filter((el) => !el.matches('script, style') && (el.textContent.trim() || el.querySelector('img, iframe, video')));
}

/** La portada es la 1ª imagen de la entrada; si está al principio (en los 3 primeros bloques, p. ej.
 * tras la entradilla) se oculta en el cuerpo para que no salga dos veces. Más abajo, se respeta. */
const COVER_LOOKAHEAD = 3;

export function initCover() {
  const body = js('post-body');
  const cover = js('cover-img');
  if (!body || !cover) return;
  const blocks = contentBlocks(body).slice(0, COVER_LOOKAHEAD);
  const firstWithImage = blocks.find((el) => el.matches('img') || el.querySelector('img'));
  const block = firstWithImage && imageBlock(firstWithImage);
  if (!block) return;
  if (!cover.getAttribute('alt') && block.img.alt) cover.setAttribute('alt', block.img.alt);
  const figcaption = js('cover-caption');
  if (figcaption && block.caption) {
    figcaption.textContent = block.caption;
    figcaption.hidden = false;
  }
  firstWithImage.hidden = true;
}

// ---------------------------------------------------------------- tiempo de lectura

export function initArticleReadtime() {
  const body = js('post-body');
  if (!body) return;
  const article = body.closest('article');
  const minutes = readingMinutes(body.textContent);
  for (const el of jsAll('readtime', article || document)) {
    if (el.closest('[data-post-id]') !== article) continue;
    el.textContent = readingLabel(minutes);
    el.hidden = false;
  }
}

// ---------------------------------------------------------------- sumario

const MIN_HEADINGS = 3;

function hasNoTocMarker(body) {
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim().toLowerCase() === 'notoc') return true;
  return false;
}

export function initToc() {
  const body = js('post-body');
  const toc = js('toc');
  const list = js('toc-list');
  if (!body || !toc || !list || hasNoTocMarker(body)) return;
  const headings = Array.from(body.querySelectorAll('h2, h3')).filter((h) => h.textContent.trim() && !h.closest('[hidden]'));
  if (headings.length < MIN_HEADINGS) return;

  const used = new Set(Array.from(document.querySelectorAll('[id]')).map((el) => el.id));
  const links = new Map();
  for (const h of headings) {
    if (!h.id) {
      let id = slugify(h.textContent);
      for (let n = 2; used.has(id); n++) id = `${slugify(h.textContent)}-${n}`;
      h.id = id;
      used.add(id);
    }
    h.setAttribute('tabindex', '-1');
    const li = document.createElement('li');
    li.dataset.level = h.tagName === 'H3' ? '3' : '2';
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent.trim();
    li.appendChild(a);
    list.appendChild(li);
    links.set(h, a);
  }
  toc.hidden = false;

  // Enlace activo según la lectura (aria-current="location").
  if (!('IntersectionObserver' in window)) return;
  let current = null;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const a = links.get(e.target);
      if (a && a !== current) {
        current?.removeAttribute('aria-current');
        a.setAttribute('aria-current', 'location');
        current = a;
      }
    }
  }, { rootMargin: '0px 0px -70% 0px' });
  headings.forEach((h) => io.observe(h));
}

// ---------------------------------------------------------------- progreso

export function initProgress() {
  const bar = js('progress');
  const body = js('post-body');
  if (!bar || !body) return;
  // Con scroll-driven animations el CSS lo resuelve solo.
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: scroll()')) return;
  let top = 0;
  let height = 0;
  let ticking = false;
  const measure = () => {
    const r = body.getBoundingClientRect();
    top = r.top + window.scrollY;
    height = body.offsetHeight;
  };
  const update = () => {
    ticking = false;
    const span = Math.max(1, height - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, (window.scrollY - top) / span));
    bar.style.setProperty('--progress', ratio.toFixed(4));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  measure();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); });
  window.addEventListener('load', () => { measure(); onScroll(); });
}

// ---------------------------------------------------------------- compartir

export function shareLinks(url, title) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    x: `https://x.com/intent/post?url=${u}&text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  };
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy');
}

export function initShare() {
  for (const box of jsAll('share')) {
    const url = box.dataset.url || location.href.split('#')[0];
    const title = box.dataset.title || document.title;
    const links = shareLinks(url, title);
    for (const a of box.querySelectorAll('a[data-network]')) {
      const href = links[a.dataset.network];
      if (href) a.href = href;
    }
    const copy = js('share-copy', box);
    if (copy) {
      copy.hidden = false;
      copy.addEventListener('click', async () => {
        try {
          await copyText(url);
          toast('Enlace copiado');
        } catch {
          toast('No se pudo copiar el enlace');
        }
      });
    }
    const native = js('share-native', box);
    if (native && typeof navigator.share === 'function') {
      native.hidden = false;
      native.addEventListener('click', () => {
        navigator.share({ title, url }).catch(() => { /* el lector canceló */ });
      });
    }
  }
}
