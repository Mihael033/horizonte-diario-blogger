// Módulos puros del JS del tema (src/js/modules): formato, imágenes y feed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatNewsDate, formatToday, readingMinutes, readingLabel, stripHtml, truncate, slugify, countWords } from '../src/js/modules/format.js';
import { resizeImage, srcset } from '../src/js/modules/images.js';
import { feedUrl, sectionOf, normalizeEntry, parseFeed, queryFeedJson, safeUrl } from '../src/js/modules/feed.js';

test('fechas en español (Europe/Madrid)', () => {
  assert.equal(formatDate('2026-10-19T08:30:00+02:00'), '19 de octubre de 2026');
  assert.equal(formatDate('2026-10-18T23:30:00Z'), '19 de octubre de 2026'); // 01:30 en Madrid
  assert.equal(formatDate('no es fecha'), '');
  const t = formatToday(new Date('2026-10-19T10:00:00+02:00'));
  assert.deepEqual(t, { text: 'Lunes, 19 de octubre de 2026', iso: '2026-10-19' });
});

test('fecha de noticia: relativa < 24 h, absoluta después o en el futuro', () => {
  const now = new Date('2026-10-19T12:00:00+02:00');
  assert.equal(formatNewsDate('2026-10-19T11:59:40+02:00', now), 'Ahora mismo');
  assert.equal(formatNewsDate('2026-10-19T11:35:00+02:00', now), 'Hace 25 minutos');
  assert.equal(formatNewsDate('2026-10-19T08:30:00+02:00', now), 'Hace 3 horas');
  assert.equal(formatNewsDate('2026-10-17T08:30:00+02:00', now), '17 de octubre de 2026');
  assert.equal(formatNewsDate('2026-10-20T08:30:00+02:00', now), '20 de octubre de 2026');
});

test('tiempo de lectura (200 palabras/min, mínimo 1)', () => {
  assert.equal(readingMinutes('<p>hola</p>'), 1);
  assert.equal(readingMinutes(`<p>${'palabra '.repeat(1000)}</p>`), 5);
  assert.equal(readingLabel(4), '4 min de lectura');
  assert.equal(countWords('¿Qué tal, señor Núñez? 3 años.'), 6);
});

test('texto: stripHtml, truncate, slugify', () => {
  assert.equal(stripHtml('<p>Uno&nbsp;&amp; <b>dos</b></p><style>x{}</style>'), 'Uno & dos');
  assert.equal(truncate('uno dos tres cuatro cinco seis', 15), 'uno dos tres…');
  assert.equal(truncate('corto', 15), 'corto');
  assert.equal(slugify('¿Qué pasa en Économie?'), 'que-pasa-en-economie');
  assert.equal(slugify('¡¡!!'), 'seccion');
});

test('imágenes de Blogger: tamaño, recorte y srcset', () => {
  const s72 = 'https://blogger.googleusercontent.com/img/b/R29v/s72-c/foto.jpg';
  assert.equal(resizeImage(s72, 800), 'https://blogger.googleusercontent.com/img/b/R29v/w800-h450-p-k-no-nu/foto.jpg');
  assert.equal(resizeImage('https://blogger.googleusercontent.com/img/a/AVvX=s72-c', 400, '1:1'), 'https://blogger.googleusercontent.com/img/a/AVvX=w400-h400-p-k-no-nu');
  assert.equal(resizeImage('https://img.youtube.com/vi/abc123/default.jpg', 800), 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg');
  assert.equal(resizeImage('https://example.com/x.jpg', 800), 'https://example.com/x.jpg');
  assert.equal(srcset('https://example.com/x.jpg'), '');
  assert.equal(srcset(s72).split(', ').length, 4);
});

const entry = (id, title, labels, published, content = '<p>texto de prueba</p>') => ({
  id: { $t: `tag:blogger.com,1999:blog-1.post-${id}` },
  published: { $t: published },
  title: { $t: title },
  content: { $t: content },
  category: labels.map((term) => ({ term })),
  link: [{ rel: 'alternate', href: `https://x.blogspot.com/${id}.html` }],
  author: [{ name: { $t: 'Ana' } }],
  'media$thumbnail': { url: 'https://blogger.googleusercontent.com/img/b/x/s72-c/a.jpg' },
  'thr$total': { $t: '2' },
});
const feed = { feed: { 'openSearch$totalResults': { $t: '3' }, entry: [
  entry('1', 'Tren de cercanías', ['Actualidad', 'Movilidad'], '2026-10-18T10:00:00+02:00'),
  entry('2', 'El mercado', ['Barrios', 'Economía'], '2026-10-19T10:00:00+02:00', '<p>Precios y puestos</p>'),
  entry('3', 'Fútbol base', ['Deportes'], '2026-10-17T10:00:00+02:00'),
] } };

test('feedUrl: etiqueta codificada, orden por publicación, búsqueda', () => {
  assert.equal(feedUrl('https://x.blogspot.com', { label: 'Economía', max: 4 }), 'https://x.blogspot.com/feeds/posts/default/-/Econom%C3%ADa?alt=json&orderby=published&max-results=4&start-index=1');
  assert.match(feedUrl('https://x.blogspot.com/', { q: 'tren', summary: true, start: 7 }), /\/feeds\/posts\/summary\?.*start-index=7&q=tren$/);
});

test('sección = primera etiqueta que es sección (Blogger ordena alfabéticamente)', () => {
  assert.equal(sectionOf(['Barrios', 'Consumo', 'Economía'], ['Actualidad', 'Economía']), 'Economía');
  assert.equal(sectionOf(['Barrios'], ['Economía']), 'Barrios');
  assert.equal(sectionOf([], ['Economía']), '');
});

test('normalizeEntry / parseFeed', () => {
  const p = normalizeEntry(feed.feed.entry[1]);
  assert.equal(p.id, '2');
  assert.equal(p.section, 'Economía');
  assert.equal(p.url, 'https://x.blogspot.com/2.html');
  assert.equal(p.excerpt, 'Precios y puestos');
  assert.equal(p.minutes, 1);
  assert.equal(p.comments, 2);
  assert.equal(parseFeed(feed).total, 3);
  assert.equal(parseFeed({}).posts.length, 0);
});

test('URLs del feed saneadas: fuera javascript: y data:', () => {
  const evil = entry('9', 'X', [], '2026-10-19T10:00:00+02:00');
  evil.link = [{ rel: 'alternate', href: 'javascript:alert(1)' }];
  evil['media$thumbnail'] = { url: 'data:image/svg+xml,<svg onload=alert(1)>' };
  const p = normalizeEntry(evil);
  assert.equal(p.url, '');
  assert.equal(p.image, '');
  assert.equal(parseFeed({ feed: { entry: [evil] } }).posts.length, 0);
  assert.equal(safeUrl('//x.blogspot.com/a.html'), '//x.blogspot.com/a.html');
  assert.equal(safeUrl(' https://x.com/a '), 'https://x.com/a');
});

test('queryFeedJson imita al feed: etiqueta, búsqueda sin tildes, orden y paginación', () => {
  const ids = (j) => j.feed.entry.map((e) => /post-(\d+)/.exec(e.id.$t)[1]);
  assert.deepEqual(ids(queryFeedJson(feed, {})), ['2', '1', '3']);
  assert.deepEqual(ids(queryFeedJson(feed, { label: 'Economía' })), ['2']);
  assert.deepEqual(ids(queryFeedJson(feed, { q: 'FUTBOL' })), ['3']);
  assert.deepEqual(ids(queryFeedJson(feed, { start: 2, max: 1 })), ['1']);
  assert.equal(queryFeedJson(feed, { q: 'zzz' }).feed['openSearch$totalResults'].$t, '0');
});

test('listingQuery reconoce etiqueta y búsqueda también bajo subcarpeta', async () => {
  const { listingQuery } = await import('../src/js/modules/lists.js');
  assert.deepEqual(listingQuery({ pathname: '/search/label/Econom%C3%ADa', search: '' }), { label: 'Economía' });
  assert.deepEqual(listingQuery({ pathname: '/horizonte-diario-blogger/search/label/Cultura', search: '' }), { label: 'Cultura' });
  assert.deepEqual(listingQuery({ pathname: '/search', search: '?q=tren' }), { q: 'tren' });
  assert.deepEqual(listingQuery({ pathname: '/', search: '' }), {});
});
