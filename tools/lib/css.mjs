// CSS do tema Horizonte .
//
// Duas saídas para o Blogger (o minificador do b:skin pode descartar @layer, @container e CSS aninhado):
//   buildSkin() → conteúdo do <b:skin>: bloco <Variable> + :root com os tokens = $(variável).
//                 Pequeno e sem sintaxe arriscada para o minificador do Blogger.
//   buildCss()  → CSS principal (com @layer), para um <style> CDATA logo depois do b:skin.
// E uma para o protótipo/preview sem Blogger:
//   buildTokensCss() → :root com os valores literais (os mesmos defaults das Variable).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STYLES = path.join(ROOT, 'src/styles');
const DIST = path.join(ROOT, 'dist');

// Ordem da cascata. Cada arquivo declara a própria @layer.
export const CSS_FILES = [
  'layers.css',
  'fonts.css',
  'reset.css',
  'base.css',
  'layout.css',
  'components/button.css',
  'components/masthead.css',
  'components/nav.css',
  'components/drawer.css',
  'components/ticker.css',
  'components/search.css',
  'components/card.css',
  'components/hero.css',
  'components/section-head.css',
  'components/section-block.css',
  'components/feature.css',
  'components/widgets.css',
  'components/breadcrumbs.css',
  'components/article.css',
  'components/prose.css',
  'components/toc.css',
  'components/share.css',
  'components/comments.css',
  'components/pager.css',
  'components/footer.css',
  'components/toast.css',
  'pages/home.css',
  'pages/article.css',
  'pages/archive.css',
  'pages/static.css',
  'pages/error.css',
  'motion.css',
  'utilities.css',
];

export async function loadTokens() {
  return JSON.parse(await readFile(path.join(ROOT, 'src/tokens.json'), 'utf8'));
}

const round = (n) => Math.round(n * 10000) / 10000;

// Utopia: interpola linearmente entre minViewport e maxViewport.
function fluid(minPx, maxPx, minVw, maxVw) {
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  const [lo, hi] = minPx <= maxPx ? [minPx, maxPx] : [maxPx, minPx];
  return `clamp(${round(lo / 16)}rem, ${round(intercept / 16)}rem + ${round(slope * 100)}vw, ${round(hi / 16)}rem)`;
}

function scaleTokens(t) {
  const { minViewport: a, maxViewport: b, minBase, maxBase, minRatio, maxRatio, steps } = t.type;
  const out = {};
  for (const n of steps) {
    out[`--step-${n}`] = fluid(minBase * minRatio ** n, maxBase * maxRatio ** n, a, b);
  }
  for (const [k, m] of Object.entries(t.space)) {
    if (k.startsWith('$')) continue;
    out[`--space-${k}`] = fluid(minBase * m, maxBase * m, a, b);
  }
  return out;
}

// Variáveis do Blogger: nomes estáveis, documentados no README do tema.
// Sem hífen nem número solto no nome (surface-2 → surface.alt, ink-soft → ink.soft).
const bvKey = (k) => k.replace('-2', '-alt').replaceAll('-', '.');
const bvColor = (k, mode) => `hz.${mode === 'dark' ? 'dark' : 'color'}.${bvKey(k)}`;
const bvSection = (k, mode) => `hz.sec.${k}${mode === 'dark' ? '.dark' : ''}`;
const bvFont = (k) => `hz.font.${k}`;

// Shorthand `font` exigido pelo tipo font do Designer: estilo peso tamanho família.
// O CSS usa `font: var(--font-title)` e sobrescreve tamanho, peso e entrelinha depois.
function fontShorthand(t, key) {
  const weight = key === 'serif' ? 600 : 400;
  return `normal ${weight} 16px ${t.font[key].value.replaceAll('"', "'")}`;
}

function colorVars(t, mode, literal) {
  const lines = [];
  for (const [k, v] of Object.entries(t.color)) {
    if (k.startsWith('$')) continue;
    lines.push(`--color-${k}: ${literal ? v[mode] : `$(${bvColor(k, mode)})`};`);
  }
  for (const [k, v] of Object.entries(t.section)) {
    if (k.startsWith('$')) continue;
    lines.push(`--sec-${k}: ${literal ? v[mode] : `$(${bvSection(k, mode)})`};`);
  }
  return lines;
}

function staticVars(t, literal) {
  const lines = [
    `--font-title: ${literal ? fontShorthand(t, 'serif') : `$(${bvFont('title')})`};`,
    `--font-text: ${literal ? fontShorthand(t, 'sans') : `$(${bvFont('text')})`};`,
  ];
  for (const [k, v] of Object.entries(scaleTokens(t))) lines.push(`${k}: ${v};`);
  for (const [k, v] of Object.entries(t.layout)) if (!k.startsWith('$')) lines.push(`--${k}: ${v};`);
  for (const [k, v] of Object.entries(t.motion)) if (!k.startsWith('$')) lines.push(`--${k}: ${v};`);
  return lines;
}

// :root claro + escuro (por data-theme e por prefers-color-scheme sem escolha explícita).
function rootBlocks(t, literal) {
  const ind = (arr) => arr.map((l) => `  ${l}`).join('\n');
  const light = [...colorVars(t, 'light', literal), ...staticVars(t, literal)];
  const dark = colorVars(t, 'dark', literal);
  return [
    `:root {\n  color-scheme: light;\n${ind(light)}\n}`,
    `:root[data-theme="dark"] {\n  color-scheme: dark;\n${ind(dark)}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    color-scheme: dark;\n${dark.map((l) => `    ${l}`).join('\n')}\n  }\n}`,
  ].join('\n\n');
}

const attr = (s) => String(s).replaceAll('&', 'and').replaceAll('"', "'").replaceAll('<', '').replaceAll('>', '');

function variableTag(name, description, type, value) {
  return `<Variable name="${name}" description="${attr(description)}" type="${type}" default="${attr(value)}" value="${attr(value)}"/>`;
}

function variablesBlock(t) {
  const groups = [];
  const light = [];
  const dark = [];
  for (const [k, v] of Object.entries(t.color)) {
    if (k.startsWith('$')) continue;
    light.push(variableTag(bvColor(k, 'light'), v.bv, 'color', v.light));
    dark.push(variableTag(bvColor(k, 'dark'), `${v.bv} (modo oscuro)`, 'color', v.dark));
  }
  const sections = [];
  for (const [k, v] of Object.entries(t.section)) {
    if (k.startsWith('$')) continue;
    sections.push(variableTag(bvSection(k, 'light'), `Sección ${v.label}`, 'color', v.light));
    sections.push(variableTag(bvSection(k, 'dark'), `Sección ${v.label} (modo oscuro)`, 'color', v.dark));
  }
  const fonts = [
    variableTag(bvFont('title'), t.font.serif.bv, 'font', fontShorthand(t, 'serif')),
    variableTag(bvFont('text'), t.font.sans.bv, 'font', fontShorthand(t, 'sans')),
  ];
  const group = (desc, items) => `<Group description="${desc}" selector="body">\n${items.map((i) => `  ${i}`).join('\n')}\n</Group>`;
  groups.push(group('Colores', light), group('Colores del modo oscuro', dark), group('Colores de las secciones', sections), group('Tipografía', fonts));
  return `/*\n${groups.join('\n')}\n*/`;
}

export async function buildTokensCss() {
  const t = await loadTokens();
  return `/* Tokens do tema Horizonte — gerado de src/tokens.json. Não editar. */\n${rootBlocks(t, true)}\n`;
}

export async function buildSkin() {
  const t = await loadTokens();
  const css = `${variablesBlock(t)}\n${rootBlocks(t, false)}\n`;
  assertSafe(css, 'skin');
  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'skin.css'), css);
  return css;
}

// Fontes de fallback com métricas ajustadas (capsize): Georgia e Arial ocupam
// o mesmo espaço que Newsreader e Schibsted Grotesk, então a troca não gera CLS.
async function fallbackFontsCss() {
  try {
    const { entireMetricsCollection: m } = await import('@capsizecss/metrics/entireMetricsCollection');
    const { createFontStack } = await import('@capsizecss/core');
    return [
      createFontStack([m.newsreader, m.georgia]).fontFaces,
      createFontStack([m.schibstedGrotesk, m.arial]).fontFaces,
    ].join('\n');
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') return '';
    throw e;
  }
}

async function concatStyles() {
  const parts = [];
  for (const f of CSS_FILES) {
    if (f === 'fonts.css') {
      parts.push(`/* fonts (gerado com capsize) */\n${await fallbackFontsCss()}`);
      continue;
    }
    try {
      parts.push(`/* ${f} */\n${await readFile(path.join(STYLES, f), 'utf8')}`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  return parts.join('\n');
}

async function minify(css) {
  try {
    const { transform } = await import('esbuild');
    // Sem lowering: o alvo são navegadores atuais; o que não suportarem é ignorado.
    const out = await transform(css, { loader: 'css', minify: true, target: ['chrome120', 'firefox120', 'safari17'] });
    return out.code;
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') return css;
    throw e;
  }
}

function assertSafe(css, where) {
  if (css.includes(']]>')) throw new Error(`CSS (${where}) contém "]]>", que fecharia o CDATA do tema.`);
}

export async function buildCss({ minified = true } = {}) {
  const raw = await concatStyles();
  const css = minified ? await minify(raw) : raw;
  assertSafe(css, 'main');
  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'main.css'), css);
  return css;
}

// CLI: node tools/lib/css.mjs → grava dist/skin.css, dist/main.css e dist/tokens.css.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [skin, main, tokens] = await Promise.all([buildSkin(), buildCss(), buildTokensCss()]);
  await writeFile(path.join(DIST, 'tokens.css'), tokens);
  const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
  console.log(`skin ${kb(skin)} · main ${kb(main)} · tokens ${kb(tokens)}`);
}
