// Redimensionado de imágenes de Blogger por URL (como hace resizeImage en el tema).
import { IMAGE_WIDTHS } from './config.js';

const GOOGLE_HOST = /^(https?:)?\/\/([\w-]+\.)*(bp\.blogspot\.com|blogger\.googleusercontent\.com|googleusercontent\.com|ggpht\.com)\//;
const YOUTUBE = /^(https?:)?\/\/(i\d?\.ytimg\.com|img\.youtube\.com)\/vi\/([\w-]+)\//;

const preview = () => (typeof window !== 'undefined' && window.HD_PREVIEW) || null;

/**
 * URL de la imagen al ancho pedido (y con recorte al ratio, p. ej. "16:9").
 * Las imágenes que no son de Google se devuelven igual.
 */
export function resizeImage(url, width, ratio = '16:9') {
  if (!url) return '';
  const p = preview();
  if (p && typeof p.resize === 'function') return p.resize(url, width);
  const yt = YOUTUBE.exec(url);
  if (yt) return `https://i.ytimg.com/vi/${yt[3]}/${width > 480 ? 'maxresdefault' : 'hqdefault'}.jpg`;
  if (!GOOGLE_HOST.test(url)) return url;
  let size = `w${width}`;
  if (ratio) {
    const [rw, rh] = String(ratio).split(':').map(Number);
    if (rw > 0 && rh > 0) size = `w${width}-h${Math.round((width * rh) / rw)}-p-k-no-nu`;
  }
  if (/\/(s|w|h)\d+[^/]*\//.test(url)) return url.replace(/\/(s|w|h)\d+[^/]*\//, `/${size}/`);
  if (/=(s|w|h)\d+[\w-]*$/.test(url)) return url.replace(/=(s|w|h)\d+[\w-]*$/, `=${size}`);
  if (/googleusercontent\.com/.test(url) && !url.includes('=')) return `${url}=${size}`;
  return url;
}

/** srcset con los anchos estándar del tema. */
export function srcset(url, ratio = '16:9', widths = IMAGE_WIDTHS) {
  if (!url) return '';
  const candidates = widths.map((w) => [resizeImage(url, w, ratio), w]);
  // Imagen que no se puede redimensionar: sin srcset (todas las URL serían la misma).
  if (new Set(candidates.map(([u]) => u)).size < 2) return '';
  return candidates.map(([u, w]) => `${u} ${w}w`).join(', ');
}
