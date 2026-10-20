// Feed JSON público de Blogger (/feeds/posts/default?alt=json). La API JSON v2.0 dejó de
// funcionar el 30/09/2024; el feed sigue siendo la vía para leer entradas desde el navegador.
import { SECTIONS } from './config.js';
import { stripHtml, readingMinutes } from './format.js';
import { siteRoot } from './dom.js';

/**
 * @typedef {{ label?: string, q?: string, start?: number, max?: number, summary?: boolean }} FeedQuery
 * @typedef {{ id: string, title: string, url: string, published: string, labels: string[], section: string,
 *   image: string, excerpt: string, minutes: number | null, author: string, comments: number }} FeedPost
 * @typedef {{ total: number, posts: FeedPost[] }} FeedPage
 */

/** URL del feed para una consulta. `origin` = protocolo + dominio del blog. */
export function feedUrl(origin, { label, q, start = 1, max = 10, summary = false } = {}) {
  const kind = summary ? 'summary' : 'default';
  const path = label ? `/feeds/posts/${kind}/-/${encodeURIComponent(label)}` : `/feeds/posts/${kind}`;
  const params = new URLSearchParams({ alt: 'json', orderby: 'published', 'max-results': String(max), 'start-index': String(start) });
  if (q) params.set('q', q);
  return `${origin.replace(/\/$/, '')}${path}?${params}`;
}

/** Sección de una entrada: la primera etiqueta que sea sección (Blogger las ordena alfabéticamente). */
export function sectionOf(labels, sections = SECTIONS) {
  return labels.find((l) => sections.includes(l)) || labels[0] || '';
}

/** Solo URLs http(s) (o relativas al protocolo): nunca javascript:, data:… venidas del feed. */
export const safeUrl = (url) => (/^(https?:)?\/\//i.test(String(url || '').trim()) ? String(url).trim() : '');

const firstImg = (html) => {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '');
  return m ? m[1] : '';
};

/** Convierte una entrada GData en un objeto simple. */
export function normalizeEntry(entry, sections = SECTIONS) {
  const t = (o) => (o && typeof o.$t === 'string' ? o.$t : '');
  const html = t(entry.content);
  const id = (/post-(\d+)$/.exec(t(entry.id)) || [])[1] || t(entry.id);
  const labels = (entry.category || []).map((c) => c.term).filter(Boolean);
  const alt = (entry.link || []).find((l) => l.rel === 'alternate');
  const image = (entry.media$thumbnail && entry.media$thumbnail.url) || firstImg(html);
  return {
    id,
    title: t(entry.title) || '(Sin título)',
    url: alt ? safeUrl(alt.href) : '',
    published: t(entry.published),
    labels,
    section: sectionOf(labels, sections),
    image: safeUrl(image),
    excerpt: stripHtml(entry.summary ? t(entry.summary) : html),
    minutes: html ? readingMinutes(html) : null,
    author: entry.author && entry.author[0] ? t(entry.author[0].name) : '',
    comments: Number(t(entry.thr$total) || 0),
  };
}

/** @returns {FeedPage} */
export function parseFeed(json, sections = SECTIONS) {
  const feed = (json && json.feed) || {};
  const total = Number((feed['openSearch$totalResults'] || {}).$t || 0);
  // Sin URL válida no hay tarjeta que enlazar.
  return { total, posts: (feed.entry || []).map((e) => normalizeEntry(e, sections)).filter((p) => p.url) };
}

/**
 * Aplica una consulta a un feed completo (lo usa el preview, que sirve un JSON estático).
 * Imita a Blogger: filtro por etiqueta, búsqueda de texto sin distinguir mayúsculas ni tildes,
 * orden por fecha de publicación y paginación por start-index (base 1).
 */
export function queryFeedJson(json, { label, q, start = 1, max = 10 } = {}) {
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let entries = [...((json.feed && json.feed.entry) || [])];
  if (label) entries = entries.filter((e) => (e.category || []).some((c) => c.term === label));
  if (q) {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    entries = entries.filter((e) => {
      const hay = fold(`${(e.title || {}).$t} ${stripHtml((e.content || e.summary || {}).$t)}`);
      return terms.every((term) => hay.includes(term));
    });
  }
  entries.sort((a, b) => new Date(b.published.$t) - new Date(a.published.$t));
  const page = entries.slice(start - 1, start - 1 + max);
  return { feed: { ...json.feed, 'openSearch$totalResults': { $t: String(entries.length) }, 'openSearch$startIndex': { $t: String(start) }, entry: page } };
}

// ---------------------------------------------------------------- red

const cache = new Map();
let jsonpSeq = 0;

function jsonp(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cb = `__hdFeed${++jsonpSeq}`;
    const script = document.createElement('script');
    const done = () => { delete window[cb]; script.remove(); clearTimeout(timer); };
    const timer = setTimeout(() => { done(); reject(new Error('Tiempo de espera agotado')); }, timeout);
    window[cb] = (data) => { done(); resolve(data); };
    script.onerror = () => { done(); reject(new Error('No se pudo cargar el feed')); };
    script.src = `${url.replace('alt=json', 'alt=json-in-script')}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

async function getJson(url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Plan B (p. ej. dominio propio con redirecciones raras): JSONP, que Blogger admite.
    if (typeof document !== 'undefined') return jsonp(url);
    throw err;
  }
}

/**
 * Pide una página del feed (con caché por URL).
 * @param {FeedQuery} query
 * @returns {Promise<FeedPage>}
 */
export function fetchFeed(query) {
  const p = typeof window !== 'undefined' && window.HD_PREVIEW;
  const origin = typeof document !== 'undefined' ? siteRoot() : '';
  const key = p ? `preview:${JSON.stringify(query)}` : feedUrl(origin, query);
  if (!cache.has(key)) {
    const promise = p
      ? getStatic(p.feed).then((json) => parseFeed(queryFeedJson(json, query)))
      : getJson(key).then((json) => parseFeed(json));
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return cache.get(key);
}

let staticFeed = null;
function getStatic(url) {
  if (!staticFeed) staticFeed = fetch(url).then((r) => r.json());
  return staticFeed;
}
