// Formato de fechas, tiempo de lectura y texto. Funciones puras (se prueban en Node).
import { LOCALE, TIME_ZONE, WORDS_PER_MINUTE } from './config.js';

const longDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE });
const longDateTime = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const weekdayDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE });
const isoDay = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE });
const relative = typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' }) : null;

export const capitalize = (s) => (s ? s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1) : s);

const toDate = (value) => (value instanceof Date ? value : new Date(value));
const valid = (d) => !Number.isNaN(d.getTime());

/** «19 de octubre de 2026» */
export function formatDate(value) {
  const d = toDate(value);
  return valid(d) ? longDate.format(d) : '';
}

/** «19 de octubre de 2026, 08:30» (para title). */
export function formatDateTime(value) {
  const d = toDate(value);
  return valid(d) ? longDateTime.format(d) : '';
}

/** «Lunes, 19 de octubre de 2026» y su valor ISO (AAAA-MM-DD) en hora de Madrid. */
export function formatToday(now = new Date()) {
  return { text: capitalize(weekdayDate.format(now)), iso: isoDay.format(now) };
}

/**
 * Fecha para una noticia: relativa si tiene menos de 24 h («Hace 3 horas»), absoluta si no.
 * Una fecha futura (reloj del lector desajustado) se muestra absoluta.
 */
export function formatNewsDate(value, now = new Date()) {
  const d = toDate(value);
  if (!valid(d)) return '';
  const minutes = Math.round((now.getTime() - d.getTime()) / 60000);
  if (relative && minutes >= 0 && minutes < 24 * 60) {
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return capitalize(relative.format(-minutes, 'minute'));
    return capitalize(relative.format(-Math.floor(minutes / 60), 'hour'));
  }
  return formatDate(d);
}

/** Texto plano de un HTML (sin etiquetas, scripts ni estilos). */
export function stripHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export const countWords = (text) => (String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

/** Minutos de lectura (mínimo 1). Acepta HTML o texto. */
export function readingMinutes(htmlOrText) {
  const words = countWords(stripHtml(htmlOrText));
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export const readingLabel = (minutes) => `${minutes} min de lectura`;

/** Recorta en un límite de palabra y añade «…». */
export function truncate(text, max = 140) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  return `${cut.replace(/[\s,;:.–-]+$/, '')}…`;
}

/** Slug para ids de encabezados: «¿Qué pasa en Économie?» → «que-pasa-en-economie». */
export function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'seccion';
}
