// Expresiones de plantilla de Blogger (cond, expr:*, b:eval, values, data:…):
// tokenizador + parser (descenso recursivo) + evaluador.
//
// Cubre lo que usan los temas de layouts v3: rutas data:a.b.c, literales, == != < <= > >=
// (y eq/neq/lt/le/lte/gt/ge/gte), and/or/not/!/&&/||, in / not in / contains, ternario ?:,
// + - * / %, rangos "1 to 5", conjuntos {a, b}, objetos {k: v}, listas [a, b], funciones
// (resizeImage, sourceSet, snippet, appendParams) y operadores lambda
// (filter/where, map/select, any, all, none, count, first, take/limit, skip/offset).

export class ExprError extends Error {
  constructor(message, source, pos) {
    super(`${message} en «${source}»${pos != null ? ` (columna ${pos + 1})` : ''}`);
    this.name = 'ExprError';
    this.pos = pos;
  }
}

const KEYWORD_OPS = new Set(['and', 'or', 'not', 'in', 'contains', 'eq', 'neq', 'ne', 'lt', 'le', 'lte', 'gt', 'ge', 'gte', 'to']);
export const LAMBDA_OPS = new Set(['filter', 'where', 'map', 'select', 'any', 'all', 'none', 'count', 'first', 'take', 'limit', 'skip', 'offset']);
export const KNOWN_FUNCTIONS = new Set(['resizeImage', 'sourceSet', 'snippet', 'appendParams']);
const COMPARE = { '==': '==', eq: '==', '!=': '!=', neq: '!=', ne: '!=', '<': '<', lt: '<', '<=': '<=', le: '<=', lte: '<=', '>': '>', gt: '>', '>=': '>=', ge: '>=', gte: '>=' };

// ---------------------------------------------------------------- tokenizador

/** @typedef {{ t: 'num'|'str'|'path'|'id'|'op'|'eof', v: any, pos: number }} Token */

/** @param {string} src @returns {Token[]} */
export function tokenize(src) {
  /** @type {Token[]} */
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const start = i;
    if (c === '"' || c === "'") {
      let s = '';
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\' && i + 1 < src.length) { s += src[i + 1]; i += 2; } else { s += src[i++]; }
      }
      if (src[i] !== c) throw new ExprError('Cadena sin cerrar', src, start);
      i++;
      out.push({ t: 'str', v: s, pos: start });
      continue;
    }
    if (/\d/.test(c)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      out.push({ t: 'num', v: Number(m[0]), pos: start });
      i += m[0].length;
      continue;
    }
    if (src.startsWith('data:', i)) {
      const m = /^data:([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/.exec(src.slice(i));
      if (!m) throw new ExprError('Ruta data: mal formada', src, start);
      out.push({ t: 'path', v: m[1].split('.'), pos: start });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i));
      out.push({ t: 'id', v: m[0], pos: start });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['=>', '==', '!=', '<=', '>=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two, pos: start }); i += 2; continue; }
    if ('<>!+-*/%?:(){}[],.'.includes(c)) { out.push({ t: 'op', v: c, pos: start }); i++; continue; }
    if (c === '=') throw new ExprError('Se esperaba "==" (un solo "=" no compara)', src, start);
    throw new ExprError(`Carácter inesperado "${c}"`, src, start);
  }
  out.push({ t: 'eof', v: null, pos: src.length });
  return out;
}

// ---------------------------------------------------------------- parser

/**
 * AST:
 *  {k:'lit', v} {k:'path', segs} {k:'id', name} {k:'member', obj, name} {k:'index', obj, idx}
 *  {k:'un', op, e} {k:'bin', op, l, r} {k:'tern', c, a, b} {k:'call', name, args}
 *  {k:'set', items} {k:'obj', entries:[[k, e]]} {k:'lambda', param, body} {k:'lop', op, l, r}
 */
export function parseExpr(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const next = () => toks[p++];
  const isOp = (v, o = 0) => peek(o).t === 'op' && peek(o).v === v;
  const isKw = (v, o = 0) => peek(o).t === 'id' && peek(o).v === v;
  const expectOp = (v) => {
    if (!isOp(v)) throw new ExprError(`Se esperaba "${v}"`, src, peek().pos);
    return next();
  };

  function expression() {
    if (peek().t === 'id' && !KEYWORD_OPS.has(peek().v) && isOp('=>', 1)) {
      const param = next().v;
      next();
      return { k: 'lambda', param, body: expression() };
    }
    return ternary();
  }
  function ternary() {
    const c = or();
    if (isOp('?')) {
      next();
      const a = expression();
      expectOp(':');
      const b = expression();
      return { k: 'tern', c, a, b };
    }
    return c;
  }
  function or() {
    let l = and();
    while (isOp('||') || isKw('or')) { next(); l = { k: 'bin', op: 'or', l, r: and() }; }
    return l;
  }
  function and() {
    let l = not();
    while (isOp('&&') || isKw('and')) { next(); l = { k: 'bin', op: 'and', l, r: not() }; }
    return l;
  }
  function not() {
    if (isKw('not') && !isKw('in', 1)) { next(); return { k: 'un', op: 'not', e: not() }; }
    return comparison();
  }
  function comparison() {
    const l = lambdaOps();
    const t = peek();
    if ((t.t === 'op' || t.t === 'id') && Object.hasOwn(COMPARE, t.v)) {
      next();
      return { k: 'bin', op: COMPARE[t.v], l, r: lambdaOps() };
    }
    if (isKw('in')) { next(); return { k: 'bin', op: 'in', l, r: lambdaOps() }; }
    if (isKw('not') && isKw('in', 1)) { next(); next(); return { k: 'un', op: 'not', e: { k: 'bin', op: 'in', l, r: lambdaOps() } }; }
    if (isKw('contains')) { next(); return { k: 'bin', op: 'contains', l, r: lambdaOps() }; }
    if (isKw('to')) { next(); return { k: 'bin', op: 'to', l, r: lambdaOps() }; }
    return l;
  }
  function lambdaOps() {
    let l = additive();
    while (peek().t === 'id' && LAMBDA_OPS.has(peek().v)) {
      const op = next().v;
      let r = null;
      if (isOp('(')) {
        next();
        r = expression();
        expectOp(')');
      } else if (['take', 'limit', 'skip', 'offset'].includes(op)) {
        r = additive();
      }
      l = { k: 'lop', op, l, r };
    }
    return l;
  }
  function additive() {
    let l = multiplicative();
    while (isOp('+') || isOp('-')) { const op = next().v; l = { k: 'bin', op, l, r: multiplicative() }; }
    return l;
  }
  function multiplicative() {
    let l = unary();
    while (isOp('*') || isOp('/') || isOp('%')) { const op = next().v; l = { k: 'bin', op, l, r: unary() }; }
    return l;
  }
  function unary() {
    if (isOp('!')) { next(); return { k: 'un', op: 'not', e: unary() }; }
    if (isOp('-')) { next(); return { k: 'un', op: 'neg', e: unary() }; }
    return postfix();
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (isOp('.')) {
        next();
        const t = next();
        if (t.t !== 'id') throw new ExprError('Se esperaba un nombre tras "."', src, t.pos);
        e = { k: 'member', obj: e, name: t.v };
      } else if (isOp('[')) {
        next();
        const idx = expression();
        expectOp(']');
        e = { k: 'index', obj: e, idx };
      } else {
        return e;
      }
    }
  }
  function primary() {
    const t = next();
    switch (t.t) {
      case 'num': case 'str': return { k: 'lit', v: t.v };
      case 'path': return { k: 'path', segs: t.v };
      case 'id':
        if (t.v === 'true') return { k: 'lit', v: true };
        if (t.v === 'false') return { k: 'lit', v: false };
        if (t.v === 'null') return { k: 'lit', v: null };
        if (KEYWORD_OPS.has(t.v) || LAMBDA_OPS.has(t.v)) throw new ExprError(`"${t.v}" fuera de lugar`, src, t.pos);
        if (isOp('(')) {
          next();
          const args = [];
          if (!isOp(')')) {
            do { args.push(expression()); } while (isOp(',') && next());
          }
          expectOp(')');
          return { k: 'call', name: t.v, args };
        }
        return { k: 'id', name: t.v };
      case 'op':
        if (t.v === '(') { const e = expression(); expectOp(')'); return e; }
        if (t.v === '[') return { k: 'set', items: list(']') };
        if (t.v === '{') return brace();
        break;
      default: break;
    }
    throw new ExprError(t.t === 'eof' ? 'Expresión incompleta' : `Símbolo inesperado "${t.v}"`, src, t.pos);
  }
  function list(close) {
    const items = [];
    if (isOp(close)) { next(); return items; }
    do { items.push(expression()); } while (isOp(',') && next());
    expectOp(close);
    return items;
  }
  function brace() {
    if (isOp('}')) { next(); return { k: 'obj', entries: [] }; }
    // {clave: valor, …} → objeto; {a, b} → conjunto
    if ((peek().t === 'id' || peek().t === 'str') && isOp(':', 1)) {
      const entries = [];
      do {
        const key = next();
        if (key.t !== 'id' && key.t !== 'str') throw new ExprError('Clave de objeto no válida', src, key.pos);
        expectOp(':');
        entries.push([key.v, expression()]);
      } while (isOp(',') && next());
      expectOp('}');
      return { k: 'obj', entries };
    }
    return { k: 'set', items: list('}') };
  }

  const ast = expression();
  if (peek().t !== 'eof') throw new ExprError(`Sobra "${peek().v}"`, src, peek().pos);
  return ast;
}

/** Recorre el AST. */
export function visit(ast, fn) {
  if (!ast || typeof ast !== 'object') return;
  fn(ast);
  for (const key of ['obj', 'idx', 'e', 'l', 'r', 'c', 'a', 'b', 'body']) if (ast[key]) visit(ast[key], fn);
  for (const arr of [ast.args, ast.items]) if (arr) arr.forEach((x) => visit(x, fn));
  if (ast.entries) ast.entries.forEach(([, v]) => visit(v, fn));
}

/** Rutas data: usadas en una expresión (sin las variables lambda). */
export function dataPaths(ast) {
  const out = [];
  visit(ast, (n) => { if (n.k === 'path') out.push(n.segs.join('.')); });
  return out;
}

// ---------------------------------------------------------------- valores

/** Texto con propiedades extra (fechas, URLs con .canonical…). `raw` = HTML que no se escapa al pintarlo. */
export class Rich {
  constructor(str, props = {}, raw = false) {
    this.__str = String(str ?? '');
    this.__raw = raw;
    Object.assign(this, props);
  }
  toString() { return this.__str; }
}
export const raw = (html) => new Rich(html, {}, true);

export const isRich = (v) => v instanceof Rich;

export function toStr(v) {
  if (v == null || v === false) return v === false ? 'false' : '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v === true) return 'true';
  if (isRich(v)) return v.__str;
  if (Array.isArray(v)) return v.map(toStr).join(',');
  return '';
}

export function truthy(v) {
  if (v == null || v === false || v === '' || v === 0) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (isRich(v)) return v.__str !== '' || Object.keys(v).some((k) => !k.startsWith('__'));
  return true;
}

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeJs = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/</g, '\\x3c').replace(/>/g, '\\x3e');
const escapeJson = (s) => JSON.stringify(String(s)).slice(1, -1).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** Hosts cuyas imágenes acepta resizeImage en Blogger. */
export const isGoogleImage = (url) => /^(https?:)?\/\/([\w-]+\.)*(bp\.blogspot\.com|blogger\.googleusercontent\.com|googleusercontent\.com|ggpht\.com|ytimg\.com)\//.test(toStr(url));

/** Propiedades "virtuales" de Blogger sobre textos y listas. */
function getProp(obj, name, env) {
  if (obj == null) return undefined;
  if (Array.isArray(obj)) {
    if (name === 'size' || name === 'length') return obj.length;
    if (name === 'empty' || name === 'isEmpty') return obj.length === 0;
    if (name === 'first') return obj[0];
    if (name === 'last') return obj[obj.length - 1];
    return undefined;
  }
  if (typeof obj === 'object' && !isRich(obj)) return Object.prototype.hasOwnProperty.call(obj, name) ? obj[name] : undefined;
  if (isRich(obj) && Object.prototype.hasOwnProperty.call(obj, name)) return obj[name];
  const s = toStr(obj);
  switch (name) {
    case 'escaped': return new Rich(escapeHtml(s), {}, true);
    case 'jsEscaped': return new Rich(escapeJs(s), {}, true);
    case 'jsonEscaped': return new Rich(escapeJson(s), {}, true);
    case 'canonical': return s.replace(/([?&])m=1(&|$)/, (_, a, b) => (b ? a : '')).replace(/[?&]$/, '');
    case 'isResizable': return env.isResizable(s);
    case 'size': case 'length': return s.length;
    case 'empty': case 'isEmpty': return s.length === 0;
    case 'iso8601': return s;
    default: return undefined;
  }
}

function looseEq(a, b) {
  if (a == null || b == null) return toStr(a) === toStr(b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(toStr(a));
    const nb = Number(toStr(b));
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  if (typeof a === 'object' && !isRich(a) && typeof b === 'object' && !isRich(b)) return a === b;
  return toStr(a) === toStr(b);
}

function compare(a, b) {
  const na = typeof a === 'number' ? a : Number(toStr(a));
  const nb = typeof b === 'number' ? b : Number(toStr(b));
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return toStr(a).localeCompare(toStr(b));
}

// ---------------------------------------------------------------- funciones de Blogger

/** Reescribe una URL de imagen de Google al tamaño pedido (como hace Blogger). */
export function resizeGoogleImage(url, width, ratio) {
  const s = toStr(url);
  let size = `w${width}`;
  if (ratio) {
    const [rw, rh] = String(ratio).split(':').map(Number);
    if (rw > 0 && rh > 0) size = `w${width}-h${Math.round((width * rh) / rw)}-p-k-no-nu`;
  }
  if (/\/s\d+(-[\w-]+)?\//.test(s) || /\/w\d+(-[\w-]+)?\//.test(s)) return s.replace(/\/(s|w)\d+(-[\w-]+)?\//, `/${size}/`);
  if (/=(s|w)\d+[\w-]*$/.test(s)) return s.replace(/=(s|w)\d+[\w-]*$/, `=${size}`);
  if (/googleusercontent\.com/.test(s) && !s.includes('=')) return `${s}=${size}`;
  return s;
}

export function snippetText(html, opts = {}) {
  const length = Number(opts.length ?? 140);
  let text = toStr(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, opts.linebreaks ? '\n' : ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  text = text.replace(/[ \t\r\f\v]+/g, ' ').replace(/\s*\n\s*/g, opts.linebreaks ? '\n' : ' ').trim();
  if (text.length <= length) return text;
  let cut = text.slice(0, length);
  const sp = cut.lastIndexOf(' ');
  if (sp > length * 0.6) cut = cut.slice(0, sp);
  return `${cut.replace(/[\s,;:.–-]+$/, '')}${opts.ellipsis === false ? '' : '…'}`;
}

// ---------------------------------------------------------------- evaluador

/**
 * @typedef {{
 *   lookup: (name: string) => any,
 *   isResizable?: (url: string) => boolean,
 *   resizeImage?: (url: string, width: number, ratio?: string) => string,
 *   onMissing?: (path: string) => void,
 * }} EvalEnv
 */

/** Evalúa un AST (o una cadena) en el entorno dado. */
export function evaluate(astOrSrc, envIn, locals = {}) {
  const ast = typeof astOrSrc === 'string' ? parseExpr(astOrSrc) : astOrSrc;
  const env = {
    isResizable: isGoogleImage,
    resizeImage: (url, w, r) => (isGoogleImage(url) ? resizeGoogleImage(url, w, r) : toStr(url)),
    ...envIn,
  };
  return ev(ast, locals);

  function ev(n, loc) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'path': {
        let v = n.segs[0] in loc ? loc[n.segs[0]] : env.lookup(n.segs[0]);
        for (let i = 1; i < n.segs.length && v !== undefined; i++) v = getProp(v, n.segs[i], env);
        if (v === undefined && env.onMissing) env.onMissing(n.segs.join('.'));
        return v;
      }
      case 'id': return n.name in loc ? loc[n.name] : undefined;
      case 'member': return getProp(ev(n.obj, loc), n.name, env);
      case 'index': {
        const o = ev(n.obj, loc);
        const i = ev(n.idx, loc);
        return Array.isArray(o) ? o[Number(i)] : getProp(o, toStr(i), env);
      }
      case 'un': {
        const v = ev(n.e, loc);
        return n.op === 'not' ? !truthy(v) : -Number(toStr(v));
      }
      case 'tern': return truthy(ev(n.c, loc)) ? ev(n.a, loc) : ev(n.b, loc);
      case 'bin': return binary(n, loc);
      case 'set': return n.items.map((x) => ev(x, loc));
      case 'obj': return Object.fromEntries(n.entries.map(([k, e]) => [k, ev(e, loc)]));
      case 'call': return call(n, loc);
      case 'lambda': return (arg) => ev(n.body, { ...loc, [n.param]: arg });
      case 'lop': return lambdaOp(n, loc);
      default: throw new Error(`Nodo desconocido ${n.k}`);
    }
  }

  function binary(n, loc) {
    if (n.op === 'and') { const l = ev(n.l, loc); return truthy(l) ? ev(n.r, loc) : l; }
    if (n.op === 'or') { const l = ev(n.l, loc); return truthy(l) ? l : ev(n.r, loc); }
    const l = ev(n.l, loc);
    const r = ev(n.r, loc);
    switch (n.op) {
      case '==': return looseEq(l, r);
      case '!=': return !looseEq(l, r);
      case '<': return compare(l, r) < 0;
      case '<=': return compare(l, r) <= 0;
      case '>': return compare(l, r) > 0;
      case '>=': return compare(l, r) >= 0;
      case 'in': return Array.isArray(r) ? r.some((x) => looseEq(l, x)) : toStr(r).includes(toStr(l));
      case 'contains': return Array.isArray(l) ? l.some((x) => looseEq(x, r)) : toStr(l).includes(toStr(r));
      case 'to': { const a = Number(toStr(l)); const b = Number(toStr(r)); const out = []; for (let i = a; a <= b ? i <= b : i >= b; i += a <= b ? 1 : -1) out.push(i); return out; }
      case '+': return (typeof l === 'number' && typeof r === 'number') ? l + r : toStr(l) + toStr(r);
      case '-': return Number(toStr(l)) - Number(toStr(r));
      case '*': return Number(toStr(l)) * Number(toStr(r));
      case '/': return Number(toStr(l)) / Number(toStr(r));
      case '%': return Number(toStr(l)) % Number(toStr(r));
      default: throw new Error(`Operador desconocido ${n.op}`);
    }
  }

  function lambdaOp(n, loc) {
    const list = ev(n.l, loc);
    const arr = Array.isArray(list) ? list : (list == null ? [] : [list]);
    const fn = n.r && n.r.k === 'lambda' ? ev(n.r, loc) : null;
    const pred = fn ? (x) => truthy(fn(x)) : () => true;
    switch (n.op) {
      case 'filter': case 'where': return arr.filter(pred);
      case 'map': case 'select': return fn ? arr.map(fn) : arr;
      case 'any': return arr.some(pred);
      case 'all': return arr.every(pred);
      case 'none': return !arr.some(pred);
      case 'count': return arr.filter(pred).length;
      case 'first': return arr.find(pred);
      case 'take': case 'limit': return arr.slice(0, Number(toStr(ev(n.r, loc))));
      case 'skip': case 'offset': return arr.slice(Number(toStr(ev(n.r, loc))));
      default: throw new Error(`Operador lambda desconocido ${n.op}`);
    }
  }

  function call(n, loc) {
    const args = n.args.map((a) => ev(a, loc));
    switch (n.name) {
      case 'resizeImage': return env.resizeImage(toStr(args[0]), Number(toStr(args[1])), args[2] != null ? toStr(args[2]) : undefined);
      case 'sourceSet': {
        const widths = Array.isArray(args[1]) ? args[1] : [400, 800, 1200];
        return widths.map((w) => `${env.resizeImage(toStr(args[0]), Number(w), args[2] != null ? toStr(args[2]) : undefined)} ${w}w`).join(', ');
      }
      case 'snippet': return snippetText(args[0], args[1] || {});
      case 'appendParams': {
        const url = toStr(args[0]);
        const qs = Object.entries(args[1] || {}).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(toStr(v))}`).join('&');
        return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
      }
      default: throw new Error(`Función desconocida ${n.name}()`);
    }
  }
}
