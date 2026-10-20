// Validador de temas Blogger: XML bien formado + reglas del motor de plantillas.
// Devuelve errores (impiden importar o rompen el tema), avisos (calidad, accesibilidad, SEO)
// y la lista de referencias data: que hay que confirmar en un blog real.
import { parseXml, getAttr, hasAttr, walk, childElements, closest } from './xml.mjs';
import { parseExpr, dataPaths, visit, KNOWN_FUNCTIONS } from './expr.mjs';
import {
  NAMESPACES, B_ELEMENTS, B_HTML_ATTRS, WIDGET_TYPES, DEFAULT_INCLUDABLES,
  WIDGET_DATA, GLOBAL_DATA, resolveFields, widgetTypeName,
} from './catalog.mjs';

const MAX_SIZE_WARN = 500 * 1024;
const MAX_SIZE_ERROR = 1024 * 1024;

/**
 * @typedef {{ level: 'error'|'warn', msg: string, line?: number, col?: number, where?: string }} Issue
 * @typedef {{ errors: Issue[], warnings: Issue[], confirm: Map<string, { count: number, where: string }>, stats: Record<string, number> }} Report
 */

/**
 * @param {string} text contenido de theme.xml
 * @param {{ map?: { file: string, line: number }[] }} [opts] mapa de líneas de tools/build.mjs
 * @returns {Report}
 */
export function validateTheme(text, { map } = {}) {
  /** @type {Report} */
  const report = { errors: [], warnings: [], confirm: new Map(), stats: {} };
  const where = (line) => {
    if (!line) return undefined;
    const o = map && map[line - 1];
    return o ? `${o.file}:${o.line}` : `theme.xml:${line}`;
  };
  const err = (msg, node) => report.errors.push({ level: 'error', msg, line: node?.line, col: node?.col, where: where(node?.line) });
  const warn = (msg, node) => report.warnings.push({ level: 'warn', msg, line: node?.line, col: node?.col, where: where(node?.line) });

  const bytes = Buffer.byteLength(text, 'utf8');
  report.stats.bytes = bytes;
  if (bytes > MAX_SIZE_ERROR) err(`El tema pesa ${(bytes / 1024).toFixed(0)} KB; por encima de 1 MB Blogger puede rechazarlo.`);
  else if (bytes > MAX_SIZE_WARN) warn(`El tema pesa ${(bytes / 1024).toFixed(0)} KB (> 500 KB). Conviene aligerarlo.`);

  // Dentro de CDATA (CSS/JS) &nbsp; es texto normal; fuera, XML no define esa entidad.
  const nbsp = text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => m.replace(/[^\n]/g, ' ')).search(/&nbsp;/);
  if (nbsp !== -1) err('Usa &#160; en lugar de &nbsp; (XML no define esa entidad).', { line: text.slice(0, nbsp).split('\n').length, col: 0 });

  const { doc, errors } = parseXml(text);
  for (const e of errors) err(`XML mal formado: ${e.message}`, { line: e.line, col: e.col });
  if (errors.length || !doc.root) return report;

  // ---- raíz y espacios de nombres ----------------------------------------------------------
  const html = doc.root;
  if (html.name !== 'html') err(`El elemento raíz debe ser <html>, no <${html.name}>.`, html);
  for (const [prefix, uri] of Object.entries(NAMESPACES)) {
    const attr = prefix ? `xmlns:${prefix}` : 'xmlns';
    const val = getAttr(html, attr);
    if (val !== uri) err(`<html> necesita ${attr}='${uri}'${val ? ` (tiene '${val}')` : ''}.`, html);
  }
  if (!hasAttr(html, 'b:version') && !hasAttr(html, 'b:layoutsVersion')) warn("<html> sin b:version='2' ni b:layoutsVersion='3'.", html);
  if (!hasAttr(html, 'lang') && !hasAttr(html, 'expr:lang')) warn('<html> sin atributo lang (accesibilidad y SEO).', html);
  if (getAttr(html, 'b:js') === 'false') warn("b:js='false' quita el JS de Blogger: las respuestas en comentarios dejan de funcionar.", html);

  const heads = childElements(html).filter((e) => e.name === 'head');
  const bodies = childElements(html).filter((e) => e.name === 'body');
  if (heads.length !== 1) err('Debe haber exactamente un <head> hijo de <html>.', html);
  if (bodies.length !== 1) err('Debe haber exactamente un <body> hijo de <html>.', html);
  const head = heads[0];
  const body = bodies[0];

  // ---- recorrido general -------------------------------------------------------------------
  const sectionIds = new Map();
  const widgetIds = new Map();
  const htmlIds = new Map();
  let skinCount = 0;
  let templateSkinCount = 0;
  let blogWidgets = 0;
  report.stats.sections = 0;
  report.stats.widgets = 0;
  report.stats.includables = 0;

  walk(doc, (el) => {
    const { name } = el;
    if (name.startsWith('b:')) {
      const spec = B_ELEMENTS[name];
      if (!spec) { err(`Elemento desconocido <${name}>.`, el); return; }
      for (const r of spec.req || []) if (!hasAttr(el, r)) err(`<${name}> requiere el atributo ${r}.`, el);
      const allowed = new Set([...(spec.req || []), ...(spec.opt || [])]);
      for (const a of el.attrs) {
        if (!allowed.has(a.name) && !(a.name.startsWith('expr:') && allowed.has(a.name.slice(5)))) warn(`Atributo ${a.name} no reconocido en <${name}>.`, el);
      }
    } else if (name.startsWith('data:')) {
      if (el.children.some((c) => c.type !== 'comment')) err(`<${name}> debe ser un elemento vacío (<${name}/>).`, el);
    } else {
      for (const a of el.attrs) {
        if (a.name.startsWith('b:') && !B_HTML_ATTRS.has(a.name)) warn(`Atributo ${a.name} no reconocido en <${name}>.`, el);
      }
      const outNames = el.attrs.filter((a) => !a.name.startsWith('xmlns') && !a.name.startsWith('b:')).map((a) => a.name.replace(/^expr:/, ''));
      const dup = outNames.find((n, i) => outNames.indexOf(n) !== i);
      if (dup) warn(`<${name}> define "${dup}" dos veces (estático y expr:).`, el);
      // ids repetidos: dentro del mismo includable o fuera de includables (includables distintos
      // suelen ser excluyentes, p. ej. homeLayout/listLayout, y no se comparan entre sí).
      const id = getAttr(el, 'id');
      if (id && !closest(el, 'b:loop') && !closest(el, 'template')) {
        const scopeEl = closest(el, 'b:includable');
        const key = `${scopeEl ? `${getAttr(closest(scopeEl, 'b:widget') || scopeEl, 'id')}/${getAttr(scopeEl, 'id')}` : ''}#${id}`;
        const globalKey = `#${id}`;
        const clash = htmlIds.get(key) || (!scopeEl && htmlIds.get(globalKey));
        if (clash) warn(`id="${id}" repetido (también en ${where(clash.line)}).`, el);
        else htmlIds.set(key, el);
      }
      checkHtmlQuality(el, warn);
    }

    switch (name) {
      case 'b:skin':
        skinCount++;
        if (el.parent !== head) err('<b:skin> debe estar dentro de <head>.', el);
        checkSkin(el, err, warn, report);
        break;
      case 'b:template-skin':
        templateSkinCount++;
        if (el.parent !== head) err('<b:template-skin> debe estar dentro de <head>.', el);
        break;
      case 'b:section': {
        report.stats.sections++;
        const id = getAttr(el, 'id');
        if (id) {
          if (sectionIds.has(id)) err(`b:section id='${id}' repetido.`, el);
          sectionIds.set(id, el);
        }
        if (closest(el, 'b:section')) err('Un <b:section> no puede estar dentro de otro.', el);
        if (!closest(el, 'body')) err('<b:section> debe estar dentro de <body>.', el);
        if (closest(el, 'b:if') || closest(el, 'b:loop')) warn('b:section dentro de b:if/b:loop: puede desaparecer del editor de Diseño.', el);
        const mw = getAttr(el, 'maxwidgets');
        if (mw !== undefined && !/^\d+$/.test(mw)) err(`maxwidgets='${mw}' debe ser un número.`, el);
        const sae = getAttr(el, 'showaddelement');
        if (sae !== undefined && !['yes', 'no'].includes(sae)) err(`showaddelement='${sae}' debe ser yes o no.`, el);
        const widgets = childElements(el).filter((c) => c.name === 'b:widget');
        if (mw && widgets.length > Number(mw)) err(`La sección '${id}' tiene ${widgets.length} widgets y maxwidgets='${mw}'.`, el);
        break;
      }
      case 'b:widget': {
        report.stats.widgets++;
        const id = getAttr(el, 'id') || '';
        const type = getAttr(el, 'type') || '';
        if (el.parent?.name !== 'b:section') err(`El widget ${id} debe ser hijo directo de un <b:section>.`, el);
        if (widgetIds.has(id)) err(`Widget id='${id}' repetido.`, el);
        widgetIds.set(id, el);
        if (!WIDGET_TYPES[type]) warn(`Tipo de widget '${type}' no reconocido.`, el);
        if (id && type && !new RegExp(`^${type}\\d+$`).test(id)) err(`El id '${id}' no sigue el patrón TipoN (esperado ${type}1, ${type}2…).`, el);
        if (type === 'Blog') blogWidgets++;
        if (getAttr(el, 'version') !== '2') warn(`El widget ${id} no declara version='2' (pierde los includables por defecto modernos).`, el);
        checkWidget(el, type, err, warn);
        break;
      }
      case 'b:widget-settings':
        if (el.parent?.name !== 'b:widget') err('<b:widget-settings> debe ser hijo de <b:widget>.', el);
        break;
      case 'b:widget-setting': {
        const w = el.parent?.parent;
        if (el.parent?.name !== 'b:widget-settings') { err('<b:widget-setting> debe estar dentro de <b:widget-settings>.', el); break; }
        const type = w ? getAttr(w, 'type') : '';
        const known = WIDGET_TYPES[type]?.settings;
        const sname = getAttr(el, 'name') || '';
        if (known && known.length && !known.some((k) => (k instanceof RegExp ? k.test(sname) : k === sname))) warn(`Ajuste '${sname}' no conocido para widgets ${type}.`, el);
        break;
      }
      case 'b:includable':
        report.stats.includables++;
        if (!['b:widget', 'b:defaultmarkup'].includes(el.parent?.name)) err('<b:includable> debe ser hijo directo de <b:widget> o <b:defaultmarkup>.', el);
        break;
      case 'b:defaultmarkup':
        if (el.parent?.name !== 'b:defaultmarkups') err('<b:defaultmarkup> debe estar dentro de <b:defaultmarkups>.', el);
        break;
      case 'b:if':
        checkIfChain(el, err);
        break;
      case 'b:elseif': case 'b:else':
        if (el.parent?.name !== 'b:if') err(`<${name}> debe ser hijo directo de <b:if>.`, el);
        if (el.children.some((c) => c.type === 'element' || (c.type === 'text' && c.value.trim()))) err(`<${name}/> debe ser vacío; el contenido va a continuación.`, el);
        break;
      case 'b:case': case 'b:default':
        if (el.parent?.name !== 'b:switch') err(`<${name}> debe ser hijo directo de <b:switch>.`, el);
        break;
      case 'b:attr': case 'b:class':
        if (!el.parent || el.parent.name.startsWith('b:') || el.parent.name.startsWith('data:')) err(`<${name}> debe ser hijo directo de un elemento HTML.`, el);
        if (name === 'b:class' && !hasAttr(el, 'name') && !hasAttr(el, 'expr:name')) err('<b:class> requiere name o expr:name.', el);
        if (name === 'b:attr' && !hasAttr(el, 'value') && !hasAttr(el, 'expr:value')) err('<b:attr> requiere value o expr:value.', el);
        break;
      case 'script':
        checkScript(el, err, warn);
        break;
      default: break;
    }
  });

  if (skinCount !== 1) err(`Debe haber exactamente un <b:skin> en <head> (hay ${skinCount}).`, head);
  if (templateSkinCount === 0) warn('Falta <b:template-skin>: el editor de Diseño se verá sin estilo.', head);
  if (blogWidgets !== 1) err(`El tema necesita exactamente un widget Blog (hay ${blogWidgets}).`, body);

  // ---- expresiones y referencias data: (con ámbito) ----------------------------------------
  checkExpressions(doc, { err, warn, report, where });
  return report;
}

// ---------------------------------------------------------------------------- reglas sueltas

function checkIfChain(el, err) {
  let seenElse = false;
  for (const c of childElements(el)) {
    if (c.name === 'b:else') {
      if (seenElse) err('<b:if> con más de un <b:else/>.', c);
      seenElse = true;
    } else if (c.name === 'b:elseif' && seenElse) {
      err('<b:elseif> después de <b:else/>.', c);
    }
  }
}

function checkSkin(el, err, warn, report) {
  const css = el.children.filter((c) => c.type === 'cdata' || c.type === 'text').map((c) => c.value).join('');
  if (!el.children.some((c) => c.type === 'cdata') && /[<&]/.test(css)) err('El CSS del b:skin debe ir en <![CDATA[ … ]]>.', el);
  const vars = new Map();
  const varRe = /<Variable\s+([^>]*?)\/?>/g;
  let m;
  while ((m = varRe.exec(css))) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w.-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1], a[2]]));
    if (!attrs.name) { err('<Variable> sin name en el b:skin.', el); continue; }
    if (vars.has(attrs.name)) err(`<Variable name="${attrs.name}"> repetida en el b:skin.`, el);
    for (const r of ['description', 'type', 'default']) if (attrs[r] === undefined) err(`<Variable name="${attrs.name}"> sin ${r}.`, el);
    if (attrs.type && !['color', 'font', 'length', 'background', 'string', 'url', 'automatic'].includes(attrs.type)) warn(`<Variable name="${attrs.name}"> con type="${attrs.type}" desconocido.`, el);
    if (['string', 'url', 'automatic'].includes(attrs.type)) warn(`<Variable name="${attrs.name}"> usa type="${attrs.type}" (no confirmado en la documentación oficial).`, el);
    vars.set(attrs.name, attrs);
  }
  report.stats.skinVariables = vars.size;
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const used = new Set();
  for (const ref of body.matchAll(/\$\(([\w.-]+)\)/g)) {
    used.add(ref[1]);
    if (!vars.has(ref[1])) err(`El b:skin usa $(${ref[1]}) sin <Variable> definida.`, el);
  }
  for (const [name, attrs] of vars) {
    if (!used.has(name) && !css.includes(`$(${name})`)) warn(`<Variable name="${name}"> definida pero sin uso en el CSS.`, el);
    for (const ref of `${attrs.default} ${attrs.value || ''}`.matchAll(/\$\(([\w.-]+)\)/g)) if (!vars.has(ref[1])) err(`<Variable name="${name}"> referencia $(${ref[1]}), que no existe.`, el);
  }
  if (/(^|[^\w-])@(layer|container|property)\b/.test(body)) warn('El b:skin usa @layer/@container/@property: muévelos al <style> principal (riesgo con el minificador de Blogger).', el);
  if (/&\s*[.:#[>~+\w]/.test(body.replace(/&(amp|lt|gt|quot|#\d+);/g, ''))) warn('El b:skin parece usar CSS anidado (&): Blogger puede descartarlo.', el);
}

function checkWidget(el, type, err, warn) {
  const incl = childElements(el).filter((c) => c.name === 'b:includable');
  const ids = new Map();
  for (const i of incl) {
    const id = getAttr(i, 'id');
    if (ids.has(id)) err(`Includable '${id}' repetido en el widget ${getAttr(el, 'id')}.`, i);
    ids.set(id, i);
  }
  if (incl.length && !ids.has('main')) err(`El widget ${getAttr(el, 'id')} define includables pero no 'main'.`, el);
  for (const c of childElements(el)) {
    if (!['b:includable', 'b:widget-settings'].includes(c.name)) err(`<${c.name}> no puede ser hijo directo de <b:widget> (solo b:includable y b:widget-settings).`, c);
  }
  // b:include → debe existir en el widget, en b:defaultmarkup o ser un includable por defecto conocido
  walk(el, (x) => {
    if (x.name !== 'b:include') return;
    const name = getAttr(x, 'name') || '';
    if (ids.has(name)) return;
    const defaults = [...DEFAULT_INCLUDABLES['*'], ...(DEFAULT_INCLUDABLES[type] || [])];
    if (defaults.includes(name)) return;
    const ownerDoc = rootOf(el);
    const common = findDefaultMarkup(ownerDoc, type, name);
    if (!common) warn(`b:include name='${name}' no está definido en ${getAttr(el, 'id')} ni es un includable por defecto conocido.`, x);
  });
}

function rootOf(el) { let r = el; while (r.parent) r = r.parent; return r; }

function findDefaultMarkup(root, type, name) {
  let found = false;
  walk(root, (x) => {
    if (x.name === 'b:defaultmarkup' && ['Common', type].includes(getAttr(x, 'type'))) {
      if (childElements(x).some((i) => i.name === 'b:includable' && getAttr(i, 'id') === name)) found = true;
    }
  });
  return found;
}

function checkScript(el, err, warn) {
  const content = el.children.map((c) => (c.type === 'text' || c.type === 'cdata' ? c.value : '')).join('');
  if (/<\/script/i.test(content)) err('Un <script> contiene "</script": rompe el HTML publicado.', el);
  const type = getAttr(el, 'type');
  const src = getAttr(el, 'src') || '';
  if (src.startsWith('http://')) warn(`Script por http:// (contenido mixto): ${src}`, el);
  if (!src && content.trim() && type !== 'application/ld+json' && !el.children.some((c) => c.type === 'cdata') && /[<>&]/.test(content)) {
    err('Script en línea con < > o & fuera de CDATA.', el);
  }
}

function checkHtmlQuality(el, warn) {
  const a = (n) => getAttr(el, n) ?? getAttr(el, `expr:${n}`);
  if (el.name === 'img') {
    if (a('alt') === undefined) warn('<img> sin alt.', el);
    if (a('width') === undefined || a('height') === undefined) warn('<img> sin width/height (provoca saltos de diseño, CLS).', el);
  }
  if (el.name === 'a' && getAttr(el, 'target') === '_blank' && !/noopener|noreferrer/.test(getAttr(el, 'rel') || '')) warn('<a target="_blank"> sin rel="noopener".', el);
  for (const n of ['src', 'href']) {
    const v = getAttr(el, n);
    if (v && v.startsWith('http://') && el.name !== 'a') warn(`Recurso por http:// (contenido mixto): ${v}`, el);
  }
  if (el.name === 'button' && !getAttr(el, 'type')) warn('<button> sin type (en un form actúa como submit).', el);
}

// ---------------------------------------------------------------------------- expresiones

function checkExpressions(doc, ctx) {
  const { err, warn, report } = ctx;
  const confirm = (path, node) => {
    const cur = report.confirm.get(path);
    if (cur) cur.count++;
    else report.confirm.set(path, { count: 1, where: ctx.where(node.line) });
  };

  /** Comprueba una expresión: sintaxis, funciones y referencias data:. */
  function checkExpr(src, node, scope, label) {
    let ast;
    try {
      ast = parseExpr(src);
    } catch (e) {
      err(`${label}: ${e.message}`, node);
      return null;
    }
    visit(ast, (n) => {
      if (n.k === 'call' && !KNOWN_FUNCTIONS.has(n.name)) warn(`${label}: función ${n.name}() desconocida.`, node);
    });
    for (const p of dataPaths(ast)) checkPath(p.split('.'), node, scope);
    return ast;
  }

  function checkPath(segs, node, scope) {
    const r = typeOfPath(segs, scope);
    if (r.status === 'unknown') warn(`Referencia data:${segs.join('.')} desconocida${r.at ? ` (en "${r.at}")` : ''}.`, node);
    else if (r.status === '?') confirm(`data:${segs.join('.')}`, node);
    return r;
  }

  function typeOfPath(segs, scope) {
    const [first, ...rest] = segs;
    if (scope.vars.has(first)) {
      const v = scope.vars.get(first);
      return rest.length ? resolveFields(v.type, rest, { list: v.list }) : { status: 'ok', type: v.type, list: v.list };
    }
    const wdata = scope.widgetType ? { ...WIDGET_DATA['*'], ...(WIDGET_DATA[scope.widgetType] || { '*': '?' }) } : null;
    let spec = wdata && (wdata[first] ?? wdata['*']);
    if (spec === undefined || spec === null) spec = GLOBAL_DATA[first];
    if (spec === undefined) return { status: 'unknown', at: first };
    const s = typeof spec === 'string' ? { t: 'string', c: spec } : spec;
    const inner = resolveFields(s.list || s.t || 'any', rest, { list: Boolean(s.list) });
    const status = inner.status === 'unknown' ? 'unknown' : (s.c === '?' || inner.status === '?') ? '?' : 'ok';
    return { ...inner, status };
  }

  /** Tipo de lo que se pasa en b:include data='…' o b:loop values='…'. */
  function typeOfExpr(src, scope) {
    try {
      return typeOfAst(parseExpr(src), scope);
    } catch { /* ya informado */ }
    return { status: '?', type: 'any', list: false };
  }

  /** Tipo de una expresión: rutas, ternarios (rama "sí") y operadores lambda. */
  function typeOfAst(ast, scope) {
    const unknown = { status: '?', type: 'any', list: false };
    switch (ast.k) {
      case 'path': return typeOfPath(ast.segs, scope);
      case 'tern': return typeOfAst(ast.a, scope);
      case 'lop': {
        const base = typeOfAst(ast.l, scope);
        if (['filter', 'where', 'take', 'limit', 'skip', 'offset'].includes(ast.op)) return base;
        if (ast.op === 'first') return { ...base, list: false };
        if (['any', 'all', 'none'].includes(ast.op)) return { status: base.status, type: 'boolean', list: false };
        if (ast.op === 'count') return { status: base.status, type: 'number', list: false };
        return unknown;
      }
      case 'bin': return ast.op === 'to' ? { status: 'ok', type: 'number', list: true } : unknown;
      default: return unknown;
    }
  }

  // Ámbito: { vars: Map(nombre → {type, list}), widgetType, includables: Map(id → el), paramTypes: Map(id → tipo) }
  function processChildren(el, scope) {
    for (const c of el.children) if (c.type === 'element') processElement(c, scope);
  }

  function processElement(el, scope) {
    const { name } = el;
    // atributos expr:* y condiciones
    for (const a of el.attrs) {
      if (a.name.startsWith('expr:')) checkExpr(a.value, el, scope, `${a.name} en <${name}>`);
    }
    if (name.startsWith('data:')) {
      checkPath(name.slice(5).split('.'), el, scope);
      return;
    }
    switch (name) {
      case 'b:widget': {
        const type = getAttr(el, 'type') || '';
        const includables = new Map(childElements(el).filter((c) => c.name === 'b:includable').map((c) => [getAttr(c, 'id'), c]));
        const wscope = { vars: new Map(), widgetType: type, includables, paramTypes: new Map(), done: new Set() };
        const main = includables.get('main');
        if (main) runIncludable(main, wscope, { type: widgetTypeName(type), list: false });
        for (const [id, inc] of includables) if (!wscope.done.has(id)) runIncludable(inc, wscope, wscope.paramTypes.get(id) || { type: 'any', list: false });
        return;
      }
      case 'b:includable': return; // se procesan desde su widget
      case 'b:if': case 'b:elseif':
        checkExpr(getAttr(el, 'cond') || '', el, scope, `cond de <${name}>`);
        break;
      case 'b:include': {
        if (hasAttr(el, 'cond')) checkExpr(getAttr(el, 'cond'), el, scope, 'cond de <b:include>');
        const data = getAttr(el, 'data');
        const target = getAttr(el, 'name');
        if (data !== undefined) {
          const src = /^[A-Za-z_][\w.]*$/.test(data) ? `data:${data}` : data;
          checkExpr(src, el, scope, 'data de <b:include>');
          if (scope.includables && target && !scope.paramTypes.has(target)) scope.paramTypes.set(target, typeOfExpr(src, scope));
        }
        if (scope.includables && target && scope.includables.has(target) && !scope.done.has(target)) {
          runIncludable(scope.includables.get(target), scope, scope.paramTypes.get(target) || { type: 'any', list: false });
        }
        return;
      }
      case 'b:loop': {
        const values = getAttr(el, 'values') || '';
        checkExpr(values, el, scope, 'values de <b:loop>');
        const t = typeOfExpr(values, scope);
        const vars = new Map(scope.vars);
        vars.set(getAttr(el, 'var'), { type: t.list ? t.type : 'any', list: false });
        if (hasAttr(el, 'index')) vars.set(getAttr(el, 'index'), { type: 'number', list: false });
        processChildren(el, { ...scope, vars });
        return;
      }
      case 'b:with': {
        const value = getAttr(el, 'value') || '';
        checkExpr(value, el, scope, 'value de <b:with>');
        const vars = new Map(scope.vars);
        vars.set(getAttr(el, 'var'), typeOfExpr(value, scope));
        processChildren(el, { ...scope, vars });
        return;
      }
      case 'b:switch': checkExpr(getAttr(el, 'var') || '', el, scope, 'var de <b:switch>'); break;
      case 'b:eval': checkExpr(getAttr(el, 'expr') || '', el, scope, 'expr de <b:eval>'); break;
      case 'b:attr': case 'b:class': case 'b:tag': case 'b:section': case 'b:widget-setting':
        if (hasAttr(el, 'cond')) checkExpr(getAttr(el, 'cond'), el, scope, `cond de <${name}>`);
        break;
      case 'b:skin': case 'b:template-skin': case 'b:widget-settings': return;
      default: break;
    }
    processChildren(el, scope);
  }

  function runIncludable(inc, wscope, param) {
    const id = getAttr(inc, 'id');
    wscope.done.add(id);
    const vars = new Map(wscope.vars);
    const v = getAttr(inc, 'var');
    if (v) vars.set(v, param);
    processChildren(inc, { ...wscope, vars });
  }

  // fuera de widgets: solo datos globales
  processChildren(doc.root, { vars: new Map(), widgetType: null, includables: null, paramTypes: new Map(), done: new Set() });
}

// ---------------------------------------------------------------------------- informe

export function formatReport(report, { color = process.stdout.isTTY } = {}) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines = [];
  const fmt = (i) => `${i.where ? `${i.where}  ` : ''}${i.msg}`;
  for (const e of report.errors) lines.push(c('31', `✖ ${fmt(e)}`));
  for (const w of report.warnings) lines.push(c('33', `⚠ ${fmt(w)}`));
  if (report.confirm.size) {
    lines.push(c('36', `ℹ ${report.confirm.size} referencias por confirmar en un blog real (catálogo con «?»):`));
    for (const [p, { count, where }] of [...report.confirm].sort()) lines.push(c('36', `   ${p}  ×${count}  (${where})`));
  }
  const s = report.stats;
  lines.push(`${report.errors.length ? c('31', `✖ ${report.errors.length} error(es)`) : c('32', '✔ Sin errores')} · ${report.warnings.length} aviso(s) · ${s.sections ?? 0} secciones · ${s.widgets ?? 0} widgets · ${s.includables ?? 0} includables · ${s.skinVariables ?? 0} variables · ${((s.bytes ?? 0) / 1024).toFixed(1)} KB`);
  return lines.join('\n');
}
