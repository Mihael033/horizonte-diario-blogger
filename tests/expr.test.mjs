// Expresiones de Blogger: parser y evaluador (tools/lib/expr.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpr, evaluate, dataPaths, Rich, raw, toStr, resizeGoogleImage, snippetText } from '../tools/lib/expr.mjs';

const data = {
  view: { isHomepage: false, isPost: true, search: { label: 'Economía', query: '' }, url: new Rich('https://x.blogspot.com/2026/10/a.html?m=1') },
  blog: { title: 'Horizonte & Diario', pageType: 'item' },
  post: {
    id: '123',
    title: 'Un "titular" <raro>',
    labels: [{ name: 'Barrios', url: '/l/b' }, { name: 'Economía', url: '/l/e' }],
    featuredImage: 'https://blogger.googleusercontent.com/img/b/R29v/s1600/foto.jpg',
    date: new Rich('19 de octubre de 2026', { iso8601: '2026-10-19T08:30:00+02:00' }),
  },
  posts: [{ n: 1 }, { n: 2 }, { n: 3 }],
  i: 2,
};
const ev = (src, extra = {}) => evaluate(src, { lookup: (k) => ({ ...data, ...extra })[k] });

test('literales, rutas y operadores básicos', () => {
  assert.equal(ev('data:blog.pageType == "item"'), true);
  assert.equal(ev("data:blog.pageType != 'index'"), true);
  assert.equal(ev('data:view.isHomepage or data:view.isPost'), true);
  assert.equal(ev('data:view.isHomepage and data:view.isPost'), false);
  assert.equal(ev('!data:view.isHomepage'), true);
  assert.equal(ev('not data:view.isHomepage'), true);
  assert.equal(ev('data:i >= 3'), false);
  assert.equal(ev('data:i == 2'), true);
  assert.equal(ev('data:i lt 3'), true);
  assert.equal(ev('1 + 2 * 3'), 7);
  assert.equal(ev('"post-" + data:post.id'), 'post-123');
});

test('in / not in con conjuntos y rangos', () => {
  assert.equal(ev('data:i in {1, 2}'), true);
  assert.equal(ev('data:blog.pageType in {"index", "archive"}'), false);
  assert.equal(ev('data:blog.pageType not in {"index", "archive"}'), true);
  assert.deepEqual(ev('1 to 3'), [1, 2, 3]);
});

test('ternario y objetos', () => {
  assert.equal(ev('data:view.isPost ? "article" : "website"'), 'article');
  assert.deepEqual(ev('{length: 150, links: false}'), { length: 150, links: false });
});

test('propiedades virtuales: escaped, jsonEscaped, canonical, iso8601, first, size, empty', () => {
  assert.equal(toStr(ev('data:blog.title.escaped')), 'Horizonte &amp; Diario');
  assert.equal(ev('data:blog.title.escaped').__raw, true);
  assert.equal(toStr(ev('data:post.title.jsonEscaped')), 'Un \\"titular\\" \\u003craro\\u003e');
  assert.equal(ev('data:view.url.canonical'), 'https://x.blogspot.com/2026/10/a.html');
  assert.equal(ev('data:post.date.iso8601'), '2026-10-19T08:30:00+02:00');
  assert.equal(ev('data:post.labels.first.name'), 'Barrios');
  assert.equal(ev('data:posts.size'), 3);
  assert.equal(ev('data:posts.empty'), false);
  assert.equal(ev('data:post.featuredImage.isResizable'), true);
});

test('operadores lambda (la macro SECTION_OF depende de any/first)', () => {
  const set = '{"Actualidad", "Economía"}';
  const expr = `data:post.labels any (l => l.name in ${set}) ? data:post.labels first (l => l.name in ${set}) : data:post.labels.first`;
  assert.equal(ev(expr).name, 'Economía');
  const noSection = { post: { labels: [{ name: 'Barrios' }, { name: 'Zoo' }] } };
  assert.equal(ev(expr, noSection).name, 'Barrios');
  assert.equal(ev('data:posts count (p => p.n > 1)'), 2);
  assert.deepEqual(ev('data:posts map (p => p.n)'), [1, 2, 3]);
  assert.deepEqual(ev('data:posts filter (p => p.n != 2)').map((p) => p.n), [1, 3]);
  assert.equal(ev('data:posts all (p => p.n > 0)'), true);
  assert.equal(ev('data:posts none (p => p.n > 5)'), true);
  assert.deepEqual(ev('data:posts take 2').map((p) => p.n), [1, 2]);
});

test('funciones resizeImage / sourceSet / snippet', () => {
  assert.equal(ev('resizeImage(data:post.featuredImage, 800, "16:9")'), 'https://blogger.googleusercontent.com/img/b/R29v/w800-h450-p-k-no-nu/foto.jpg');
  assert.match(ev('sourceSet(data:post.featuredImage, [400, 800], "16:9")'), /w400-h225-p-k-no-nu\/foto\.jpg 400w, .*w800-h450-p-k-no-nu\/foto\.jpg 800w$/);
  assert.equal(ev('resizeImage("https://example.com/a.jpg", 800)'), 'https://example.com/a.jpg');
  assert.equal(ev('snippet("<p>Hola <b>mundo</b> bonito y largo</p>", {length: 11})'), 'Hola mundo…');
});

test('reescritura de URLs de Google (path y sufijo =s)', () => {
  assert.equal(resizeGoogleImage('https://1.bp.blogspot.com/-a/b/s72-c/x.png', 400, '1:1'), 'https://1.bp.blogspot.com/-a/b/w400-h400-p-k-no-nu/x.png');
  assert.equal(resizeGoogleImage('https://blogger.googleusercontent.com/img/a/AVvX=s1600', 800), 'https://blogger.googleusercontent.com/img/a/AVvX=w800');
});

test('snippet: quita etiquetas y entidades, corta por palabra', () => {
  assert.equal(snippetText('<p>Uno &amp; dos</p><script>x()</script>'), 'Uno & dos');
  assert.equal(snippetText('palabra '.repeat(40), { length: 30 }).endsWith('…'), true);
});

test('errores de sintaxis claros', () => {
  assert.throws(() => parseExpr('data:a = 1'), /"=="/);
  assert.throws(() => parseExpr('data:a ==' ), /incompleta/);
  assert.throws(() => parseExpr('"sin cerrar'), /sin cerrar/);
  assert.throws(() => parseExpr('(data:a'), /"\)"/);
  assert.throws(() => parseExpr('data:a data:b'), /Sobra/);
});

test('dataPaths ignora variables lambda', () => {
  assert.deepEqual(dataPaths(parseExpr('data:post.labels any (l => l.name == data:view.search.label)')), ['post.labels', 'view.search.label']);
});

test('raw() marca HTML que no se escapa', () => {
  assert.equal(raw('<b>x</b>').__raw, true);
  assert.equal(toStr(raw('<b>x</b>')), '<b>x</b>');
});
