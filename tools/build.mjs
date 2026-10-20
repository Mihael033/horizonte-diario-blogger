#!/usr/bin/env node
// Genera theme/theme.xml: CSS (tools/lib/css.mjs) + JS (esbuild) + parciales de src/theme.
// Después valida el resultado y sale con código 1 si hay errores.
//   node tools/build.mjs            → build + validación
//   node tools/build.mjs --no-check → solo build
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { expandIncludes, expandMacros, stripSourceComments, applyInjections, wrapScript, wrapStyle, wrapSkin } from './lib/assemble.mjs';
import { validateTheme, formatReport } from './lib/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'theme', 'theme.xml');
const MAP = path.join(ROOT, 'dist', 'theme.map.json');

/** Navegadores objetivo del JS (Blogger no transpila nada). */
export const JS_TARGET = ['es2020', 'chrome90', 'edge90', 'firefox88', 'safari15'];

const exists = (p) => access(p).then(() => true, () => false);

const loadTokens = async () => JSON.parse(await readFile(path.join(SRC, 'tokens.json'), 'utf8'));

/** Etiquetas que son secciones: fuente única en src/tokens.json (section.*.label), que también da los colores. */
export async function loadSections() {
  const tokens = await loadTokens();
  return Object.entries(tokens.section || {}).filter(([k]) => !k.startsWith('$')).map(([, v]) => v.label).filter(Boolean);
}

/** Constantes que el JS recibe del build (ver src/js/modules/config.js). */
export async function jsDefines() {
  const tokens = await loadTokens();
  const bg = tokens.color?.bg || {};
  return {
    __HD_SECTIONS__: JSON.stringify(await loadSections()),
    __HD_THEME_COLORS__: JSON.stringify({ light: bg.light || '#FFFFFF', dark: bg.dark || '#0B1527' }),
  };
}

/** CSS. Sin tools/lib/css.mjs se usa un b:skin mínimo para que el tema siga siendo importable. */
async function buildStyles() {
  const cssLib = path.join(ROOT, 'tools', 'lib', 'css.mjs');
  if (await exists(cssLib)) {
    const mod = await import(pathToFileURL(cssLib).href);
    const skin = await mod.buildSkin();
    const css = typeof mod.buildCss === 'function' ? await mod.buildCss() : '';
    return { skin, css, fallback: false };
  }
  const skin = `/*
<Variable name="body.background" description="Fondo de la página" type="color" default="#FFFFFF" value="#FFFFFF"/>
<Variable name="body.text.color" description="Texto principal" type="color" default="#0E1B33" value="#0E1B33"/>
*/
:root { --color-bg: $(body.background); --color-ink: $(body.text.color); }
body { margin: 0; background: var(--color-bg); color: var(--color-ink); font: 18px/1.6 Georgia, serif; }`;
  return { skin, css: '', fallback: true };
}

/** Empaqueta y minifica un punto de entrada JS. */
export async function bundleJs(entry, { minify = true, define = {} } = {}) {
  const result = await esbuild.build({
    entryPoints: [entry],
    define,
    bundle: true,
    write: false,
    format: 'iife',
    minify,
    target: JS_TARGET,
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

export async function build({ check = true, log = console.log } = {}) {
  const t0 = performance.now();
  const styles = await buildStyles();
  if (styles.fallback) log('⚠  tools/lib/css.mjs no existe todavía: uso un b:skin mínimo.');
  const define = await jsDefines();
  const [jsHead, jsMain] = await Promise.all([
    bundleJs(path.join(SRC, 'js', 'head.js')),
    bundleJs(path.join(SRC, 'js', 'main.js'), { define }),
  ]);

  const sections = await loadSections();
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const banner = `Horizonte Diario ${pkg.version} · tema de periódico para Blogger. Archivo GENERADO por tools/build.mjs a partir de src/: no editar a mano. Instalación: theme/README.md`;
  const lines = expandMacros(stripSourceComments(await expandIncludes(path.join(SRC, 'theme', 'theme.src.xml'), { root: path.join(SRC, 'theme') }), { banner }), { sections });
  const injections = {
    'js-head': wrapScript(jsHead),
    skin: wrapSkin(styles.skin),
    js: wrapScript(jsMain, { module: true }),
  };
  if (styles.css.trim()) injections.css = wrapStyle(styles.css);
  const { text, map } = applyInjections(lines, injections, { optional: ['css'] });

  await mkdir(path.dirname(OUT), { recursive: true });
  await mkdir(path.dirname(MAP), { recursive: true });
  await writeFile(OUT, text, 'utf8');
  await writeFile(MAP, JSON.stringify(map), 'utf8');

  const kb = (n) => `${(Buffer.byteLength(n, 'utf8') / 1024).toFixed(1)} KB`;
  log(`✔  theme/theme.xml (${kb(text)}; skin ${kb(styles.skin)}, css ${kb(styles.css)}, js ${kb(jsHead + jsMain)}) en ${Math.round(performance.now() - t0)} ms`);

  if (!check) return { ok: true, text, map };
  const report = validateTheme(text, { map });
  log(formatReport(report));
  return { ok: report.errors.length === 0, text, map, report };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build({ check: !process.argv.includes('--no-check') })
    .then(({ ok }) => { process.exitCode = ok ? 0 : 1; })
    .catch((err) => { console.error(`✖  ${err.message}`); process.exitCode = 1; });
}
