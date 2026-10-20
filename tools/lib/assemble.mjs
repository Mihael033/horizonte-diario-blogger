// Monta theme.xml a partir de src/theme: resuelve <!-- @include ruta --> (recursivo) y
// <!-- @inject:nombre -->, y guarda un mapa línea-de-salida → archivo:línea de origen.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const INCLUDE_RE = /<!--\s*@include\s+([\w./-]+)\s*-->/;
const INJECT_RE = /<!--\s*@inject:([\w-]+)\s*-->/g;

/**
 * @typedef {{ file: string, line: number }} Origin
 * @typedef {{ text: string, origin: Origin }} SourceLine
 */

/**
 * Lee `entry` y expande los @include. Un @include debe ocupar su línea entera.
 * @param {string} entry ruta absoluta
 * @param {{ root: string }} opts carpeta base de las rutas de @include
 * @returns {Promise<SourceLine[]>}
 */
export async function expandIncludes(entry, { root }, stack = []) {
  const rel = path.relative(root, entry).replaceAll('\\', '/');
  if (stack.includes(entry)) throw new Error(`@include circular: ${[...stack, entry].map((f) => path.relative(root, f)).join(' → ')}`);
  let text;
  try {
    text = await readFile(entry, 'utf8');
  } catch {
    const from = stack.length ? ` (incluido desde ${path.relative(root, stack[stack.length - 1]).replaceAll('\\', '/')})` : '';
    throw new Error(`No existe el parcial ${rel}${from}`);
  }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (text.endsWith('\n')) text = text.slice(0, -1);
  /** @type {SourceLine[]} */
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = INCLUDE_RE.exec(line);
    if (m) {
      if (line.replace(m[0], '').trim() !== '') throw new Error(`${rel}:${i + 1}: el @include debe ir solo en su línea`);
      out.push(...await expandIncludes(path.resolve(root, m[1]), { root }, [...stack, entry]));
    } else {
      out.push({ text: line, origin: { file: rel, line: i + 1 } });
    }
  }
  return out;
}

/**
 * Quita los comentarios <!--#src … --> (documentación del código fuente, que no debe llegar al
 * tema) y, si se pasa `banner`, pone en su lugar un comentario de archivo generado.
 * @param {SourceLine[]} lines
 * @param {{ banner?: string }} [opts]
 */
export function stripSourceComments(lines, { banner } = {}) {
  /** @type {SourceLine[]} */
  const out = [];
  let inside = false;
  let bannerDone = false;
  for (const line of lines) {
    if (!inside && /^\s*<!--#src\b/.test(line.text)) {
      inside = true;
      if (banner && !bannerDone) { out.push({ text: `<!-- ${banner.replace(/--/g, '—')} -->`, origin: line.origin }); bannerDone = true; }
    }
    if (!inside) out.push(line);
    else if (line.text.includes('-->')) inside = false;
  }
  if (inside) throw new Error('Comentario <!--#src sin cerrar');
  return out;
}

/**
 * Macros de plantilla (se expanden en el build, Blogger nunca las ve):
 *   {{SECTIONS}}        → conjunto Blogger con las etiquetas que son secciones: {"Actualidad", …}
 *   {{SECTION_OF:post}} → expresión que devuelve la etiqueta-sección de data:post.
 * Blogger devuelve data:post.labels en orden alfabético, así que la sección es la primera
 * etiqueta que esté en {{SECTIONS}}; si no hay ninguna, la primera etiqueta.
 * @param {SourceLine[]} lines
 * @param {{ sections: string[] }} opts
 */
export function expandMacros(lines, { sections }) {
  if (!sections.length) throw new Error('No hay secciones definidas (src/tokens.json → section.*.label).');
  for (const s of sections) if (/["'\\{}]/.test(s)) throw new Error(`Nombre de sección no válido: ${s}`);
  const set = `{${sections.map((s) => `"${s}"`).join(', ')}}`;
  const sectionOf = (v) => `data:${v}.labels any (l => l.name in ${set}) ? data:${v}.labels first (l => l.name in ${set}) : data:${v}.labels.first`;
  return lines.map(({ text, origin }) => {
    const out = text
      .replace(/\{\{SECTIONS\}\}/g, set)
      .replace(/\{\{SECTION_OF:([A-Za-z_]\w*)\}\}/g, (_, v) => sectionOf(v));
    const left = /\{\{[A-Z_]+(?::[^}]*)?\}\}/.exec(out);
    if (left) throw new Error(`${origin.file}:${origin.line}: macro desconocida ${left[0]}`);
    return { text: out, origin };
  });
}

/**
 * Sustituye los @inject. `injections` mapea nombre → texto ya envuelto. Un marcador sin valor
 * es un error (salvo que esté en `optional`, entonces se borra).
 * @param {SourceLine[]} lines
 * @param {Record<string, string>} injections
 * @param {{ optional?: string[] }} [opts]
 * @returns {{ text: string, map: Origin[] }}
 */
export function applyInjections(lines, injections, { optional = [] } = {}) {
  /** @type {string[]} */
  const outLines = [];
  /** @type {Origin[]} */
  const map = [];
  const used = new Set();
  for (const { text, origin } of lines) {
    const replaced = text.replace(INJECT_RE, (_, name) => {
      if (name in injections) { used.add(name); return injections[name]; }
      if (optional.includes(name)) return '';
      throw new Error(`${origin.file}:${origin.line}: @inject:${name} sin contenido`);
    });
    const parts = replaced.split('\n');
    for (let k = 0; k < parts.length; k++) {
      outLines.push(parts[k]);
      map.push(k === 0 ? origin : { file: `${origin.file} (@inject)`, line: origin.line });
    }
  }
  const unused = Object.keys(injections).filter((k) => !used.has(k));
  if (unused.length) throw new Error(`Marcadores @inject que faltan en la plantilla: ${unused.join(', ')}`);
  return { text: `${outLines.join('\n')}\n`, map };
}

/**
 * Envuelve JS para meterlo en el XML. `module: true` → <script type='module'>: en línea pero
 * diferido, así no espera a hojas de estilo pendientes (Google Fonts) ni frena el parser.
 */
export function wrapScript(code, { module = false } = {}) {
  assertNoCdataEnd(code, 'JS');
  if (/<\/script/i.test(code)) throw new Error('El JS contiene "</script": rompería el HTML publicado.');
  return `<script${module ? " type='module'" : ''}>//<![CDATA[\n${code.trim()}\n//]]></script>`;
}

/** Envuelve CSS en <style> con CDATA protegido por comentarios CSS. */
export function wrapStyle(css) {
  assertNoCdataEnd(css, 'CSS');
  if (/<\/style/i.test(css)) throw new Error('El CSS contiene "</style".');
  return `<style>/*<![CDATA[*/\n${css.trim()}\n/*]]>*/</style>`;
}

/** Contenido del b:skin: CDATA puro (el motor de Blogger lo procesa). */
export function wrapSkin(css) {
  assertNoCdataEnd(css, 'b:skin');
  return `<![CDATA[\n${css.trim()}\n]]>`;
}

function assertNoCdataEnd(text, what) {
  const i = text.indexOf(']]>');
  if (i !== -1) throw new Error(`El ${what} contiene "]]>" (posición ${i}); cerraría el CDATA del tema.`);
}
