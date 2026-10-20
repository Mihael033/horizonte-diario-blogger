// Mini-motor de plantillas de Blogger para el preview: recorre el árbol de theme.xml y lo
// convierte en HTML con datos simulados (sections, widgets, includables, b:if, b:loop…).
// No pretende ser Blogger: reproduce lo que el tema usa y avisa de lo que no sabe hacer.
import { getAttr, childElements } from './xml.mjs';
import { parseExpr, evaluate, toStr, truthy, escapeHtml, isRich } from './expr.mjs';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);
const MAX_DEPTH = 60;

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * @typedef {{
 *   globals: Record<string, any>,
 *   widgetData: (info: { id: string, type: string, title: string, settings: Record<string, string> }) => Record<string, any>,
 *   defaults?: Record<string, (ctx: { data: any, widget: any, render: Function }) => string>,
 *   resizeImage?: (url: string, width: number, ratio?: string) => string,
 *   isResizable?: (url: string) => boolean,
 *   headInject?: string,
 *   onWarn?: (msg: string) => void,
 * }} RenderOptions
 */

/**
 * Renderiza un documento ya parseado.
 * @param {import('./xml.mjs').XmlDocument} doc
 * @param {RenderOptions} opts
 */
export function renderDocument(doc, opts) {
  const warned = new Set();
  const warn = (msg) => { if (!warned.has(msg)) { warned.add(msg); opts.onWarn?.(msg); } };
  const astCache = new Map();
  const defaultMarkup = collectDefaultMarkup(doc);

  const env = (scope) => ({
    lookup: (name) => lookup(scope, name),
    resizeImage: opts.resizeImage,
    isResizable: opts.isResizable,
  });

  function lookup(scope, name) {
    for (let s = scope; s; s = s.parent) if (Object.prototype.hasOwnProperty.call(s.vars, name)) return s.vars[name];
    if (scope.widget && Object.prototype.hasOwnProperty.call(scope.widget.data, name)) return scope.widget.data[name];
    return opts.globals[name];
  }

  function ev(src, scope) {
    let ast = astCache.get(src);
    if (!ast) { ast = parseExpr(src); astCache.set(src, ast); }
    return evaluate(ast, env(scope));
  }

  const child = (scope, vars) => ({ vars, parent: scope, widget: scope.widget });

  // ------------------------------------------------------------------ nodos

  function renderNodes(nodes, scope, mode, depth) {
    let out = '';
    for (let i = 0; i < nodes.length; i++) out += renderNode(nodes[i], scope, mode, depth);
    return out;
  }

  function renderNode(node, scope, mode, depth) {
    if (depth > MAX_DEPTH) { warn('Profundidad máxima de includables superada (¿recursión?)'); return ''; }
    switch (node.type) {
      case 'text': return mode === 'raw' ? node.value : escapeText(node.value);
      case 'cdata': return mode === 'raw' ? node.value : escapeText(node.value);
      case 'comment': case 'doctype': return '';
      case 'element': return renderElement(node, scope, mode, depth);
      default: return '';
    }
  }

  function output(value, mode) {
    if (isRich(value) && value.__raw) return value.__str;
    const s = toStr(value);
    return mode === 'raw' ? s : escapeText(s);
  }

  function renderElement(el, scope, mode, depth) {
    const { name } = el;
    if (name.startsWith('data:')) return output(ev(`data:${name.slice(5)}`, scope), mode);
    if (name.startsWith('b:')) return renderB(el, scope, mode, depth);
    return renderHtml(el, scope, mode, depth);
  }

  function renderHtml(el, scope, mode, depth, tagName = el.name) {
    /** @type {Map<string, string>} */
    const attrs = new Map();
    for (const a of el.attrs) {
      if (a.name === 'xmlns' || a.name.startsWith('xmlns:') || a.name.startsWith('b:')) continue;
      if (a.name.startsWith('expr:')) {
        attrs.set(a.name.slice(5), toStr(ev(a.value, scope)));
      } else {
        attrs.set(a.name, a.value);
      }
    }
    // b:attr / b:class hijos directos modifican este elemento
    const classes = (attrs.get('class') || '').split(/\s+/).filter(Boolean);
    for (const c of childElements(el)) {
      if (c.name !== 'b:attr' && c.name !== 'b:class') continue;
      const cond = getAttr(c, 'cond');
      if (cond !== undefined && !truthy(ev(cond, scope))) continue;
      if (c.name === 'b:class') {
        const n = getAttr(c, 'expr:name') !== undefined ? toStr(ev(getAttr(c, 'expr:name'), scope)) : getAttr(c, 'name');
        if (n && !classes.includes(n)) classes.push(n);
      } else {
        const n = getAttr(c, 'name');
        const v = getAttr(c, 'expr:value') !== undefined ? toStr(ev(getAttr(c, 'expr:value'), scope)) : (getAttr(c, 'value') ?? '');
        if (n === 'class') classes.push(...v.split(/\s+/).filter(Boolean));
        else attrs.set(n, v);
      }
    }
    if (classes.length) attrs.set('class', classes.join(' ')); else attrs.delete('class');

    let open = `<${tagName}`;
    for (const [k, v] of attrs) open += ` ${k}="${escapeAttr(v)}"`;
    open += '>';
    if (VOID.has(tagName)) return open;
    const innerMode = RAW_TEXT.has(tagName) ? 'raw' : mode;
    let inner = renderNodes(el.children, scope, innerMode, depth);
    if (tagName === 'head' && opts.headInject) inner = `\n${opts.headInject}${inner}`;
    return `${open}${inner}</${tagName}>`;
  }

  function renderB(el, scope, mode, depth) {
    switch (el.name) {
      case 'b:if': return renderIf(el, scope, mode, depth);
      case 'b:loop': {
        let list = ev(getAttr(el, 'values'), scope);
        if (!Array.isArray(list)) list = list == null || list === '' ? [] : [list];
        if (getAttr(el, 'reverse') === 'true') list = [...list].reverse();
        const v = getAttr(el, 'var');
        const idx = getAttr(el, 'index');
        let out = '';
        list.forEach((item, i) => {
          const vars = { [v]: item };
          if (idx) vars[idx] = i;
          out += renderNodes(el.children, child(scope, vars), mode, depth);
        });
        return out;
      }
      case 'b:with': return renderNodes(el.children, child(scope, { [getAttr(el, 'var')]: ev(getAttr(el, 'value'), scope) }), mode, depth);
      case 'b:switch': return renderSwitch(el, scope, mode, depth);
      case 'b:eval': return output(ev(getAttr(el, 'expr'), scope), mode);
      case 'b:include': return renderInclude(el, scope, mode, depth);
      case 'b:tag': {
        const cond = getAttr(el, 'cond');
        const tag = getAttr(el, 'expr:name') !== undefined ? toStr(ev(getAttr(el, 'expr:name'), scope)) : getAttr(el, 'name');
        if ((cond !== undefined && !truthy(ev(cond, scope))) || !tag) return renderNodes(el.children, scope, mode, depth);
        return renderHtml(el, scope, mode, depth, tag);
      }
      case 'b:section': return renderSection(el, scope, mode, depth);
      case 'b:skin': return renderSkin(el);
      case 'b:attr': case 'b:class': case 'b:comment': case 'b:template-skin': case 'b:defaultmarkups':
      case 'b:widget-settings': case 'b:includable': case 'b:elseif': case 'b:else': case 'b:case': case 'b:default':
        return '';
      case 'b:message': return escapeText(getAttr(el, 'name') || '');
      default:
        warn(`Elemento ${el.name} no soportado por el preview`);
        return '';
    }
  }

  function renderIf(el, scope, mode, depth) {
    // ramas: [cond, nodos] separadas por b:elseif / b:else
    const branches = [{ cond: getAttr(el, 'cond'), nodes: [] }];
    for (const c of el.children) {
      if (c.type === 'element' && c.name === 'b:elseif') branches.push({ cond: getAttr(c, 'cond'), nodes: [] });
      else if (c.type === 'element' && c.name === 'b:else') branches.push({ cond: null, nodes: [] });
      else branches[branches.length - 1].nodes.push(c);
    }
    for (const b of branches) {
      if (b.cond === null || truthy(ev(b.cond, scope))) return renderNodes(b.nodes, scope, mode, depth);
    }
    return '';
  }

  function renderSwitch(el, scope, mode, depth) {
    const value = ev(getAttr(el, 'var'), scope);
    const cases = [];
    for (const c of el.children) {
      if (c.type === 'element' && c.name === 'b:case') cases.push({ value: getAttr(c, 'value'), nodes: [] });
      else if (c.type === 'element' && c.name === 'b:default') cases.push({ value: null, nodes: [] });
      else if (cases.length) cases[cases.length - 1].nodes.push(c);
    }
    const hit = cases.find((c) => c.value !== null && toStr(value) === c.value) || cases.find((c) => c.value === null);
    return hit ? renderNodes(hit.nodes, scope, mode, depth) : '';
  }

  // ------------------------------------------------------------------ secciones y widgets

  function renderSection(el, scope, mode, depth) {
    const id = getAttr(el, 'id');
    const cls = ['section', ...(getAttr(el, 'class') || '').split(/\s+/).filter(Boolean)].join(' ');
    let inner = '';
    for (const w of childElements(el)) if (w.name === 'b:widget') inner += renderWidget(w, scope, depth);
    return `<div class="${escapeAttr(cls)}" id="${escapeAttr(id)}">${inner}</div>`;
  }

  function renderWidget(el, scope, depth) {
    if (getAttr(el, 'visible') === 'false') return '';
    const id = getAttr(el, 'id');
    const type = getAttr(el, 'type');
    const title = getAttr(el, 'title') || '';
    const settings = {};
    const settingsEl = childElements(el).find((c) => c.name === 'b:widget-settings');
    if (settingsEl) {
      for (const s of childElements(settingsEl)) {
        settings[getAttr(s, 'name')] = s.children.map((c) => (c.type === 'text' || c.type === 'cdata' ? c.value : '')).join('');
      }
    }
    const data = { title, ...opts.widgetData({ id, type, title, settings }) };
    const includables = new Map(childElements(el).filter((c) => c.name === 'b:includable').map((c) => [getAttr(c, 'id'), c]));
    const widget = { id, type, data, includables };
    const wscope = { vars: {}, parent: null, widget };
    const inner = callIncludable('main', data, wscope, 'html', depth + 1);
    return `<div class="widget ${escapeAttr(type)}" data-version="2" id="${escapeAttr(id)}">${inner}</div>`;
  }

  function renderInclude(el, scope, mode, depth) {
    const cond = getAttr(el, 'cond');
    if (cond !== undefined && !truthy(ev(cond, scope))) return '';
    const name = getAttr(el, 'name');
    const dataAttr = getAttr(el, 'data');
    let data;
    if (dataAttr !== undefined) data = ev(/^[A-Za-z_][\w.]*$/.test(dataAttr) ? `data:${dataAttr}` : dataAttr, scope);
    return callIncludable(name, data, scope, mode, depth + 1);
  }

  function callIncludable(name, data, scope, mode, depth) {
    const widget = scope.widget;
    const inc = widget?.includables.get(name) || defaultMarkup.get(`${widget?.type}/${name}`) || defaultMarkup.get(`Common/${name}`);
    if (inc) {
      const v = getAttr(inc, 'var');
      const vars = {};
      if (v) vars[v] = data;
      return renderNodes(inc.children, { vars, parent: null, widget }, mode, depth);
    }
    const fallback = opts.defaults?.[`${widget?.type}/${name}`] || opts.defaults?.[`*/${name}`];
    if (fallback) return fallback({ data, widget, warn });
    warn(`Includable '${name}' no definido en ${widget?.id ?? '(fuera de widget)'} y sin equivalente en el preview`);
    return '';
  }

  // ------------------------------------------------------------------ b:skin

  function renderSkin(el) {
    const css = el.children.map((c) => (c.type === 'cdata' || c.type === 'text' ? c.value : '')).join('');
    return `<style>${applySkinVariables(css, warn)}</style>`;
  }

  return `<!DOCTYPE html>\n${renderNode(doc.root, { vars: {}, parent: null, widget: null }, 'html', 0)}\n`;
}

/** Sustituye $(var) por el value (o default) de cada <Variable> y quita el bloque de definiciones. */
export function applySkinVariables(css, warn = () => {}) {
  const vars = new Map();
  for (const m of css.matchAll(/<Variable\s+([^>]*?)\/?>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w.-]+)\s*=\s*"([^"]*)"/g)].map((a) => [a[1], a[2]]));
    if (attrs.name) vars.set(attrs.name, attrs.value ?? attrs.default ?? '');
  }
  const resolve = (value, seen = new Set()) => value.replace(/\$\(([\w.-]+)\)/g, (_, n) => {
    if (seen.has(n) || !vars.has(n)) { warn(`Variable de skin $(${n}) sin definir`); return ''; }
    return resolve(vars.get(n), new Set([...seen, n]));
  });
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (block) => (/<Variable|<Group/.test(block) ? '' : block));
  return resolve(stripped).trim();
}

function collectDefaultMarkup(doc) {
  const map = new Map();
  const visit = (node) => {
    for (const c of node.children || []) {
      if (c.type !== 'element') continue;
      if (c.name === 'b:defaultmarkup') {
        const type = getAttr(c, 'type');
        for (const inc of childElements(c)) if (inc.name === 'b:includable') map.set(`${type}/${getAttr(inc, 'id')}`, inc);
      } else {
        visit(c);
      }
    }
  };
  visit(doc);
  return map;
}

export { escapeHtml };
