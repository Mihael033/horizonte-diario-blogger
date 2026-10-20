// Validador del tema (tools/lib/validate.mjs) y el theme.xml real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTheme } from '../tools/lib/validate.mjs';
import { build } from '../tools/build.mjs';

const NS = "xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'";
const theme = (body, { head = '', html = "b:version='2' lang='es'" } = {}) => `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html ${html} ${NS}>
<head>
<b:skin><![CDATA[/*
<Variable name="c.text" description="Texto" type="color" default="#111" value="#111"/>
*/
body { color: $(c.text); }]]></b:skin>
<b:template-skin><![CDATA[body#layout { }]]></b:template-skin>
${head}
</head>
<body>
${body}
</body>
</html>`;
const blog = (inner = "<b:includable id='main'><b:loop values='data:posts' var='post'><h2><data:post.title/></h2></b:loop></b:includable>") =>
  `<b:section id='main'><b:widget id='Blog1' type='Blog' version='2' title='Entradas' locked='true' visible='true'>${inner}</b:widget></b:section>`;
const errorsOf = (xml) => validateTheme(xml).errors.map((e) => e.msg);
const warningsOf = (xml) => validateTheme(xml).warnings.map((e) => e.msg);

test('un tema mínimo correcto pasa sin errores ni avisos', () => {
  const r = validateTheme(theme(blog()));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('XML mal formado: etiqueta sin cerrar, & suelto, &nbsp;', () => {
  assert.match(errorsOf(theme(`${blog()}<div><p>hola</div>`)).join(), /XML mal formado/);
  assert.match(errorsOf(theme(`${blog()}<p>a & b</p>`)).join(), /XML mal formado/);
  assert.match(errorsOf(theme(`${blog()}<p>a&nbsp;b</p>`)).join(), /&#160;/);
});

test('&nbsp; dentro de CDATA (JS/CSS) no es error', () => {
  assert.deepEqual(errorsOf(theme(blog(), { head: '<script>//<![CDATA[\nvar a = "&nbsp;";\n//]]></script>' })), []);
});

test('namespaces y b:skin obligatorios', () => {
  assert.match(errorsOf(theme(blog()).replace("xmlns:expr='http://www.google.com/2005/gml/expr'", "xmlns:expr='http://x'")).join(), /xmlns:expr/);
  const noSkin = theme(blog()).replace(/<b:skin>[\s\S]*?<\/b:skin>/, '');
  assert.match(errorsOf(noSkin).join(), /exactamente un <b:skin>/);
});

test('exactamente un widget Blog', () => {
  assert.match(errorsOf(theme('<b:section id="s"></b:section>')).join(), /exactamente un widget Blog/);
  const two = theme(`${blog()}<b:section id='x'><b:widget id='Blog2' type='Blog' version='2'/></b:section>`);
  assert.match(errorsOf(two).join(), /exactamente un widget Blog \(hay 2\)/);
});

test('widgets: dentro de b:section, ids únicos y patrón TipoN', () => {
  assert.match(errorsOf(theme(`${blog()}<div><b:widget id='HTML1' type='HTML' version='2'/></div>`)).join(), /hijo directo de un <b:section>/);
  assert.match(errorsOf(theme(`${blog()}<b:section id='x'><b:widget id='Caja' type='HTML' version='2'/></b:section>`)).join(), /patrón TipoN/);
  assert.match(errorsOf(theme(`${blog()}<b:section id='x'><b:widget id='HTML1' type='HTML' version='2'/><b:widget id='HTML1' type='HTML' version='2'/></b:section>`)).join(), /repetido/);
  assert.match(errorsOf(theme(`${blog()}<b:section id='x' maxwidgets='1'><b:widget id='HTML1' type='HTML' version='2'/><b:widget id='HTML2' type='HTML' version='2'/></b:section>`)).join(), /maxwidgets/);
});

test('includables: main obligatorio si se definen, sin repetir', () => {
  assert.match(errorsOf(theme(blog("<b:includable id='otro'/>"))).join(), /no 'main'/);
  assert.match(errorsOf(theme(blog("<b:includable id='main'/><b:includable id='main'/>"))).join(), /repetido/);
});

test('b:if / b:elseif / b:else bien encadenados', () => {
  const bad = blog("<b:includable id='main'><b:if cond='data:view.isPost'>a<b:else/>b<b:elseif cond='data:view.isPage'/>c</b:if></b:includable>");
  assert.match(errorsOf(theme(bad)).join(), /<b:elseif> después de <b:else\/>/);
  const notEmpty = blog("<b:includable id='main'><b:if cond='data:view.isPost'>a<b:else>b</b:else></b:if></b:includable>");
  assert.match(errorsOf(theme(notEmpty)).join(), /debe ser vacío/);
});

test('expresiones con error de sintaxis', () => {
  const bad = blog("<b:includable id='main'><b:if cond='data:view.isPost = true'>x</b:if></b:includable>");
  assert.match(errorsOf(theme(bad)).join(), /cond de <b:if>.*"=="/);
  const badExpr = blog("<b:includable id='main'><a expr:href='data:blog.url +'>x</a></b:includable>");
  assert.match(errorsOf(theme(badExpr)).join(), /expr:href/);
});

test('elementos b: desconocidos y data: con contenido', () => {
  assert.match(errorsOf(theme(`${blog()}<b:iff cond='x'/>`)).join(), /desconocido <b:iff>/);
  assert.match(errorsOf(theme(blog("<b:includable id='main'><data:blog.title>x</data:blog.title></b:includable>"))).join(), /vacío/);
});

test('variables del b:skin: sin definir, repetidas o sin type', () => {
  const undef = theme(blog()).replace('body { color: $(c.text); }', 'body { color: $(c.text); background: $(c.bg); }');
  assert.match(errorsOf(undef).join(), /\$\(c\.bg\) sin <Variable>/);
  const noType = theme(blog()).replace(' type="color"', '');
  assert.match(errorsOf(noType).join(), /sin type/);
});

test('referencias data: desconocidas avisan; las dudosas van a "por confirmar"', () => {
  const unknown = blog("<b:includable id='main'><b:loop values='data:posts' var='post'><data:post.titulo/></b:loop></b:includable>");
  assert.match(warningsOf(theme(unknown)).join(), /data:post\.titulo desconocida/);
  const doubtful = blog("<b:includable id='main'><b:loop values='data:posts' var='post'><data:post.author.aboutMe/></b:loop></b:includable>");
  assert.ok(validateTheme(theme(doubtful)).confirm.has('data:post.author.aboutMe'));
});

test('calidad: img sin alt, target=_blank sin noopener, button sin type', () => {
  const w = warningsOf(theme(`${blog()}<img src='a.png'/><a href='x' target='_blank'>x</a><button>b</button>`)).join();
  assert.match(w, /sin alt/);
  assert.match(w, /noopener/);
  assert.match(w, /sin type/);
});

test('el theme.xml del proyecto se construye y valida sin errores ni avisos', async () => {
  const { ok, report } = await build({ log: () => {} });
  assert.equal(ok, true, report.errors.map((e) => `${e.where} ${e.msg}`).join('\n'));
  assert.deepEqual(report.warnings.map((w) => `${w.where} ${w.msg}`), []);
  const text = await readFile(new URL('../theme/theme.xml', import.meta.url), 'utf8');
  assert.ok(!/\{\{[A-Z_]+/.test(text), 'quedan macros sin expandir');
  assert.ok(!/<!--\s*@(include|inject)/.test(text), 'quedan marcadores sin resolver');
  assert.ok(!/ARCHIVO FUENTE/.test(text), 'el comentario del fuente no debe llegar al tema');
});
