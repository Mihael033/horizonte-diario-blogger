#!/usr/bin/env node
// Genera preview/ renderizando theme/theme.xml con datos simulados (content/posts.json).
// Así el preview ES el tema: mismo marcado, mismo CSS y mismo JS que se importan en Blogger.
//   node tools/render-preview.mjs [--base http://localhost:4173/] [--out preview] [--no-build]
// --base admite subcarpeta (GitHub Pages: https://usuario.github.io/repositorio/); también PREVIEW_BASE.
import { mkdir, readFile, writeFile, rm, copyFile, access, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseXml } from './lib/xml.mjs';
import { renderDocument } from './lib/engine.mjs';
import { buildMock, DEFAULT_INCLUDABLES, SITE } from './lib/mock.mjs';
import { build, loadSections } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Se genera en una carpeta temporal y se cambia al final: quien esté probando con el servidor
// abierto no ve el preview a medias (antes daba 404/500 durante unos segundos).
const OUT = path.join(ROOT, `.preview-tmp-${process.pid}`);
const CONTENT = path.join(ROOT, 'content');
const exists = (p) => access(p).then(() => true, () => false);

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Variantes de imagen: tools/lib/images.mjs (sharp) o, si no existe, copia sin redimensionar. */
async function buildImages(posts, outDir, log) {
  await mkdir(outDir, { recursive: true });
  const sources = posts.map((p) => ({ name: p.slug, file: path.join(CONTENT, 'img', `${p.slug}.jpg`) }));
  const lib = path.join(ROOT, 'tools', 'lib', 'images.mjs');
  let resized = false;
  if (await exists(lib)) {
    const mod = await import(pathToFileURL(lib).href);
    await mod.buildImages({ sources, outDir });
    resized = true;
  } else {
    log('⚠  tools/lib/images.mjs no existe: copio las fotos sin variantes (el Lighthouse móvil saldrá peor).');
    for (const s of sources) {
      if (!(await exists(s.file))) continue;
      for (const w of SITE.widths) await copyFile(s.file, path.join(outDir, `${s.name}-w${w}.jpg`));
    }
  }
  for (const s of sources) if (await exists(s.file)) await copyFile(s.file, path.join(outDir, `${s.name}.jpg`));
  const authors = path.join(CONTENT, 'img', 'autores');
  if (await exists(authors)) {
    await mkdir(path.join(outDir, 'autores'), { recursive: true });
    for (const f of await readdir(authors)) await copyFile(path.join(authors, f), path.join(outDir, 'autores', f));
  }
  return resized ? 'webp' : 'jpg';
}

/** Favicon simple (sol sobre azul) para que el navegador no registre un 404. */
async function writeFavicon(file) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0E1B33"/><circle cx="16" cy="22" r="9" fill="#F4B400"/><rect y="22" width="32" height="10" fill="#0E1B33"/><rect x="5" y="21" width="22" height="2" fill="#ECF1FA"/></svg>';
  try {
    const { default: sharp } = await import('sharp');
    await writeFile(file, await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer());
  } catch {
    await writeFile(file.replace(/\.ico$/, '.svg'), svg);
  }
}

/** Sustituye preview/ por la carpeta nueva (con reintentos: en Windows un archivo abierto bloquea). */
async function swapIn(tmp, final) {
  const old = `${final}-old-${process.pid}`;
  for (let i = 0; ; i++) {
    try {
      if (await exists(final)) await rename(final, old);
      await rename(tmp, final);
      break;
    } catch (err) {
      if (i >= 20) throw err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  await rm(old, { recursive: true, force: true });
}

export async function renderPreview({ base = 'http://localhost:4173/', out = 'preview', runBuild = true, log = console.log } = {}) {
  const FINAL = path.resolve(ROOT, out);
  const t0 = performance.now();
  if (!base.endsWith('/')) base += '/';
  if (runBuild) {
    const { ok } = await build({ log: () => {} });
    if (!ok) throw new Error('El build del tema tiene errores: ejecuta npm run build para verlos.');
  }
  const themeText = await readFile(path.join(ROOT, 'theme', 'theme.xml'), 'utf8');
  const { doc, errors } = parseXml(themeText);
  if (errors.length) throw new Error(`theme.xml mal formado: ${errors[0].message} (línea ${errors[0].line})`);

  const posts = JSON.parse(await readFile(path.join(CONTENT, 'posts.json'), 'utf8'));
  const ticker = (await exists(path.join(CONTENT, 'ticker.json'))) ? JSON.parse(await readFile(path.join(CONTENT, 'ticker.json'), 'utf8')) : [];
  const sections = await loadSections();
  const mock = buildMock({ posts, ticker, base, sections });

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const ext = await buildImages(mock.posts, path.join(OUT, 'img'), log);
  await writeFavicon(path.join(OUT, 'favicon.ico'));

  // Las imágenes locales imitan el redimensionado de Blogger: <nombre>-w<ancho>.<ext>
  const localImg = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}img/([\\w-]+?)(?:-w\\d+)?\\.(?:jpg|webp)$`);
  const pick = (w) => SITE.widths.find((x) => x >= w) || SITE.widths[SITE.widths.length - 1];
  const resizeImage = (url, width) => {
    const m = localImg.exec(url);
    return m ? `${base}img/${m[1]}-w${pick(width)}.${ext}` : url;
  };
  const isResizable = (url) => localImg.test(url);

  const headInject = `<script>window.HD_PREVIEW={feed:${JSON.stringify(`${base}feeds/posts/default.json`)},resize:function(u,w){var s=${JSON.stringify(SITE.widths)},p=s.filter(function(x){return x>=w})[0]||s[s.length-1];return u.replace(/-w\\d+\\.(webp|jpg)$/,"-w"+p+".$1")}};</script>\n`;

  const warnings = new Set();
  for (const v of mock.views) {
    const html = renderDocument(doc, {
      globals: mock.globalsFor(v),
      widgetData: mock.widgetData(v),
      defaults: DEFAULT_INCLUDABLES,
      resizeImage,
      isResizable,
      headInject,
      onWarn: (m) => warnings.add(m),
    });
    const file = path.join(OUT, v.file);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html, 'utf8');
  }
  // feed estático (el JS del preview lo filtra como haría Blogger con los parámetros)
  await mkdir(path.join(OUT, 'feeds', 'posts'), { recursive: true });
  await writeFile(path.join(OUT, 'feeds', 'posts', 'default.json'), JSON.stringify(mock.feed()), 'utf8');
  // Hosting estático (GitHub Pages): /search puede resolverse como carpeta → search/index.html.
  await copyFile(path.join(OUT, 'search.html'), path.join(OUT, 'search', 'index.html'));
  await writeFile(path.join(OUT, '.nojekyll'), '', 'utf8');

  await swapIn(OUT, FINAL);
  for (const w of warnings) log(`⚠  ${w}`);
  log(`✔  ${path.relative(ROOT, FINAL) || out}/: ${mock.views.length} páginas, ${mock.posts.length} noticias, imágenes ${ext}, en ${Math.round(performance.now() - t0)} ms → ${base}`);
  return { pages: mock.views.length, warnings: [...warnings] };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  renderPreview({ base: argValue('--base', process.env.PREVIEW_BASE || 'http://localhost:4173/'), out: argValue('--out', 'preview'), runBuild: !process.argv.includes('--no-build') })
    .catch((err) => { console.error(`✖  ${err.stack || err.message}`); process.exitCode = 1; });
}
