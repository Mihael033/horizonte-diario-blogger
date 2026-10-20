// Montaje (assemble), motor del preview (engine), mock y rutas del servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expandIncludes, expandMacros, applyInjections, wrapScript, wrapSkin } from '../tools/lib/assemble.mjs';
import { parseXml } from '../tools/lib/xml.mjs';
import { renderDocument, applySkinVariables } from '../tools/lib/engine.mjs';
import { raw } from '../tools/lib/expr.mjs';
import { buildMock, insertAfterLede } from '../tools/lib/mock.mjs';
import { resolveRoute } from '../tools/serve.mjs';

test('@include recursivo con mapa de líneas, y detección de ciclos', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hd-asm-'));
  await mkdir(path.join(dir, 'parts'));
  await writeFile(path.join(dir, 'main.xml'), '<a>\n  <!-- @include parts/b.xml -->\n</a>');
  await writeFile(path.join(dir, 'parts', 'b.xml'), '<b/>\n<c/>\n');
  const lines = await expandIncludes(path.join(dir, 'main.xml'), { root: dir });
  assert.deepEqual(lines.map((l) => l.text), ['<a>', '<b/>', '<c/>', '</a>']);
  assert.deepEqual(lines[2].origin, { file: 'parts/b.xml', line: 2 });
  await writeFile(path.join(dir, 'parts', 'b.xml'), '<!-- @include main.xml -->');
  await assert.rejects(expandIncludes(path.join(dir, 'main.xml'), { root: dir }), /circular/);
});

test('@include que no ocupa su línea es un error', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hd-asm-'));
  await writeFile(path.join(dir, 'main.xml'), '<a><!-- @include b.xml --></a>');
  await assert.rejects(expandIncludes(path.join(dir, 'main.xml'), { root: dir }), /solo en su línea/);
});

test('macros SECTIONS / SECTION_OF y macros desconocidas', () => {
  const src = [{ text: "<b:with value='{{SECTION_OF:post}}' var='section'>", origin: { file: 'x', line: 1 } }, { text: "cond='data:l.name in {{SECTIONS}}'", origin: { file: 'x', line: 2 } }];
  const out = expandMacros(src, { sections: ['Actualidad', 'Economía'] });
  assert.match(out[0].text, /data:post\.labels any \(l => l\.name in \{"Actualidad", "Economía"\}\) \? data:post\.labels first/);
  assert.equal(out[1].text, `cond='data:l.name in {"Actualidad", "Economía"}'`);
  assert.throws(() => expandMacros([{ text: '{{OTRA}}', origin: { file: 'x', line: 3 } }], { sections: ['A'] }), /macro desconocida/);
});

test('@inject: sustituye, exige contenido y detecta marcadores sobrantes', () => {
  const lines = [{ text: '<head><!-- @inject:js --></head>', origin: { file: 't', line: 1 } }];
  assert.equal(applyInjections(lines, { js: '<script/>' }).text, '<head><script/></head>\n');
  assert.throws(() => applyInjections(lines, {}), /sin contenido/);
  assert.throws(() => applyInjections(lines, { js: 'x', css: 'y' }), /faltan en la plantilla: css/);
});

test('los envoltorios rechazan "]]>" y "</script"', () => {
  assert.throws(() => wrapScript('a[b[0]]>1'), /\]\]>/);
  assert.throws(() => wrapScript('"</script>"'), /<\/script/);
  assert.throws(() => wrapSkin('a{}]]>'), /\]\]>/);
  assert.match(wrapScript('x()'), /^<script>\/\/<!\[CDATA\[\nx\(\)\n\/\/\]\]><\/script>$/);
});

test('motor: secciones, widgets, includables, b:if, b:loop, b:attr, b:class, data: y expr:', () => {
  const xml = `<html xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr' b:version='2'><head><b:skin><![CDATA[/* <Variable name="c" description="d" type="color" default="#000" value="#123"/> */ a{color:$(c)}]]></b:skin></head><body>
<b:class cond='data:view.isPost' name='p-post'/>
<b:section id='s' class='zona'><b:widget id='Blog1' type='Blog' version='2'>
<b:includable id='main'><b:loop index='i' values='data:posts' var='post'><b:include data='post' name='card'/></b:loop></b:includable>
<b:includable id='card' var='post'><article expr:data-id='data:post.id'><b:attr cond='data:post.id == "2"' name='aria-current' value='true'/><b:class cond='data:post.id == "1"' name='primero'/><b:if cond='data:post.id == "1"'>uno<b:elseif cond='data:post.id == "2"'/>dos<b:else/>otro</b:if> <data:post.title/> <data:post.body/></article></b:includable>
</b:widget></b:section></body></html>`;
  const { doc } = parseXml(xml);
  const html = renderDocument(doc, {
    globals: { view: { isPost: true } },
    widgetData: () => ({ posts: [{ id: '1', title: 'A & B', body: raw('<p>x</p>') }, { id: '2', title: 'C', body: raw('') }] }),
  });
  assert.match(html, /<body class="p-post">/);
  assert.match(html, /<div class="section zona" id="s"><div class="widget Blog" data-version="2" id="Blog1">/);
  assert.match(html, /<article data-id="1" class="primero">uno A &amp; B <p>x<\/p><\/article>/);
  assert.match(html, /<article data-id="2" aria-current="true">dos C <\/article>/);
  assert.match(html, /<style>a\{color:#123\}<\/style>/);
});

test('b:skin: variables anidadas y bloque de definiciones fuera', () => {
  const css = '/* <Variable name="a" description="" type="color" default="#111" value="$(b)"/>\n<Variable name="b" description="" type="color" default="#222"/> */ x{color:$(a)} /* nota */';
  assert.equal(applySkinVariables(css), 'x{color:#222} /* nota */');
});

test('mock: etiquetas en orden alfabético (como Blogger) e imagen tras la entradilla', () => {
  const mock = buildMock({
    posts: [{ slug: 'a', title: 'A', section: 'Economía', tags: ['Barrios', 'Consumo'], author: { name: 'X' }, date: '2026-10-19T08:00:00+02:00', image: { alt: 'alt', credit: 'Pexels' }, bodyHtml: '<p>Uno</p><p>Dos</p>' }],
    base: 'http://localhost:4173/',
    sections: ['Economía'],
  });
  assert.deepEqual(mock.posts[0].labels.map((l) => l.name), ['Barrios', 'Consumo', 'Economía']);
  assert.equal(String(mock.posts[0].url), 'http://localhost:4173/2026/10/a.html');
  // (empieza por la directiva que excluye de html-validate el marcado del editor de Blogger)
  assert.match(String(mock.posts[0].body), /^<!-- \[html-validate-disable-block [^\]]+\] -->\n<p>Uno<\/p>\n<table[^>]*tr-caption-container/);
  assert.equal(insertAfterLede('<aside><p>demo</p></aside><p>Lede</p><p>Más</p>', '[IMG]'), '<aside><p>demo</p></aside><p>Lede</p>\n[IMG]\n<p>Más</p>');
});

test('serve: rutas de Blogger → archivos del preview', () => {
  const q = (s) => new URLSearchParams(s);
  assert.equal(resolveRoute('/', q('')), '/index.html');
  assert.equal(resolveRoute('/search', q('q=tren')), '/search.html');
  assert.equal(resolveRoute('/search', q('updated-max=2026&max-results=9')), '/search/older.html');
  assert.equal(resolveRoute('/search/label/Econom%C3%ADa', q('')), '/search/label/Economía.html');
  assert.equal(resolveRoute('/2026/10/a.html', q('')), '/2026/10/a.html');
  assert.equal(resolveRoute('/feeds/posts/default', q('alt=json')), '/feeds/posts/default.json');
  assert.equal(resolveRoute('/../secreto', q('')), null);
});

test('mock bajo subcarpeta (GitHub Pages): archivos relativos a la base y enlaces de raíz reescritos', () => {
  const base = 'https://usuario.github.io/horizonte-diario-blogger/';
  const mock = buildMock({
    posts: [{ slug: 'a', title: 'A', section: 'Economía', tags: [], author: { name: 'X' }, date: '2026-10-19T08:00:00+02:00', image: {}, bodyHtml: '<p>Uno</p>' }],
    base,
    sections: ['Economía'],
  });
  const files = mock.views.map((v) => v.file);
  assert.ok(files.includes('2026/10/a.html'), files.join(', '));
  assert.ok(files.includes('2026/10/index.html'));
  const nav = mock.widgetData(mock.views[0])({ type: 'LinkList', id: 'LinkList1', settings: { 'text-0': 'Economía', 'link-0': '/search/label/Econom%C3%ADa', 'text-1': 'X', 'link-1': 'https://x.com/' } });
  assert.deepEqual(nav.links.map((l) => l.target), [`${base}search/label/Econom%C3%ADa`, 'https://x.com/']);
});
