// Parser XML estricto (saxes) → árbol ligero con posiciones de línea/columna.
// Lo usan el validador y el renderizador del preview.
import { SaxesParser } from 'saxes';

/**
 * @typedef {{ name: string, value: string }} Attr
 * @typedef {{ type: 'element', name: string, attrs: Attr[], children: Node[], line: number, col: number, parent?: Element }} Element
 * @typedef {{ type: 'text' | 'cdata' | 'comment', value: string, line: number, col: number }} Leaf
 * @typedef {{ type: 'doctype', value: string }} Doctype
 * @typedef {Element | Leaf | Doctype} Node
 * @typedef {{ type: 'document', children: Node[], root: Element | null }} XmlDocument
 */

export class XmlSyntaxError extends Error {
  constructor(message, line, col) {
    super(message);
    this.name = 'XmlSyntaxError';
    this.line = line;
    this.col = col;
  }
}

/**
 * Parsea `text`. Devuelve { doc, errors }. Con errores de sintaxis el árbol puede quedar incompleto.
 * @param {string} text
 * @returns {{ doc: XmlDocument, errors: XmlSyntaxError[] }}
 */
export function parseXml(text) {
  const parser = new SaxesParser({ xmlns: true, position: true });
  /** @type {XmlDocument} */
  const doc = { type: 'document', children: [], root: null };
  /** @type {(XmlDocument | Element)[]} */
  const stack = [doc];
  /** @type {XmlSyntaxError[]} */
  const errors = [];
  let tagLine = 1;
  let tagCol = 0;
  let leafLine = 1;
  let leafCol = 0;

  const top = () => stack[stack.length - 1];
  const markLeaf = () => { leafLine = parser.line; leafCol = parser.column; };

  parser.on('error', (err) => {
    const m = /:(\d+):(\d+): (.*)$/s.exec(err.message);
    errors.push(m ? new XmlSyntaxError(m[3], Number(m[1]), Number(m[2])) : new XmlSyntaxError(err.message, parser.line, parser.column));
  });
  parser.on('doctype', (value) => { doc.children.push({ type: 'doctype', value }); });
  parser.on('opentagstart', () => { tagLine = parser.line; tagCol = parser.column; });
  parser.on('opentag', (tag) => {
    const attrs = Object.values(tag.attributes).map((a) => ({ name: a.name, value: a.value }));
    /** @type {Element} */
    const el = { type: 'element', name: tag.name, attrs, children: [], line: tagLine, col: tagCol, parent: /** @type {any} */ (top().type === 'element' ? top() : undefined) };
    top().children.push(el);
    if (!doc.root && top() === doc) doc.root = el;
    stack.push(el);
    markLeaf();
  });
  parser.on('closetag', () => { stack.pop(); markLeaf(); });
  parser.on('text', (value) => { if (top() !== doc) top().children.push({ type: 'text', value, line: leafLine, col: leafCol }); markLeaf(); });
  parser.on('cdata', (value) => { top().children.push({ type: 'cdata', value, line: leafLine, col: leafCol }); markLeaf(); });
  parser.on('comment', (value) => { top().children.push({ type: 'comment', value, line: leafLine, col: leafCol }); markLeaf(); });

  try {
    parser.write(text).close();
  } catch (err) {
    errors.push(new XmlSyntaxError(String(err.message || err), parser.line, parser.column));
  }
  return { doc, errors };
}

/** @param {Element} el @param {string} name */
export function getAttr(el, name) {
  const a = el.attrs.find((x) => x.name === name);
  return a ? a.value : undefined;
}

/** @param {Element} el @param {string} name */
export function hasAttr(el, name) {
  return el.attrs.some((x) => x.name === name);
}

/** Recorre todos los elementos en orden de documento. @param {XmlDocument | Element} node @param {(el: Element) => void} fn */
export function walk(node, fn) {
  for (const child of node.children) {
    if (child.type === 'element') {
      fn(child);
      walk(child, fn);
    }
  }
}

/** Elementos hijos directos. @param {Element} el */
export function childElements(el) {
  return /** @type {Element[]} */ (el.children.filter((c) => c.type === 'element'));
}

/** Primer ancestro con ese nombre. @param {Element} el @param {string} name */
export function closest(el, name) {
  for (let p = el.parent; p; p = p.parent) if (p.name === name) return p;
  return undefined;
}
