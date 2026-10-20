#!/usr/bin/env node
// Prueba de humo E2E del preview en un navegador real (Edge o Chrome sin interfaz, vía
// Chrome DevTools Protocol). Sin dependencias: Node ≥ 22 trae WebSocket y fetch.
//   node tools/smoke.mjs [--base http://localhost:4173/] [--browser "ruta\al\navegador.exe"]
// Si el servidor del preview no responde, lo arranca (tools/serve.mjs) con la subcarpeta de --base
// como prefijo, así se prueba también el preview tal como queda en GitHub Pages:
//   node tools/smoke.mjs --base http://localhost:4174/horizonte-diario-blogger/ --root .preview-pages
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : fallback; };
const BASE = arg('--base', 'http://localhost:4173/').replace(/\/?$/, '/');
const CANDIDATES = [
  arg('--browser', process.env.BROWSER),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ CDP mínimo

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) { this.listeners.set(method, [...(this.listeners.get(method) || []), fn]); }
  once(method) { return new Promise((resolve) => { const fn = (p) => { this.listeners.set(method, this.listeners.get(method).filter((f) => f !== fn)); resolve(p); }; this.on(method, fn); }); }
}

async function launchBrowser() {
  let exe = null;
  for (const c of CANDIDATES) if (await access(c).then(() => true, () => false)) { exe = c; break; }
  if (!exe) throw new Error('No encuentro Edge ni Chrome. Indica uno con --browser.');
  const profile = await mkdtemp(path.join(tmpdir(), 'hd-smoke-'));
  // En CI (Ubuntu 23.10+ de GitHub Actions) AppArmor impide el sandbox de Chrome: se desactiva solo allí.
  const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`];
  if (process.env.CI) flags.push('--no-sandbox', '--disable-dev-shm-usage');
  const proc = spawn(exe, [...flags, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('El navegador no abrió el puerto de depuración')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const close = async () => { ws.close(); proc.kill(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  return { cdp: new Cdp(ws), close, exe };
}

// ------------------------------------------------------------------ utilidades de página

function pageApi(cdp) {
  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  return {
    evaluate,
    async goto(url) {
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url });
      await loaded;
      await sleep(150);
    },
    async waitFor(expression, timeout = 6000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (await evaluate(`!!(${expression})`).catch(() => false)) return true;
        await sleep(100);
      }
      return false;
    },
    async key(key, code = key) {
      const keyCode = { Escape: 27, ArrowDown: 40, ArrowUp: 38, Enter: 13, Tab: 9 }[key] || 0;
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
    },
    type: (text) => cdp.send('Input.insertText', { text }),
    viewport: (width, height, mobile = false) => cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }),
  };
}

// ------------------------------------------------------------------ pruebas

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`); };

async function ensureServer() {
  const up = () => fetch(BASE).then((r) => r.ok, () => false);
  if (await up()) return null;
  const { port, pathname } = new URL(BASE);
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.mjs'), '--port', port || '80', '--prefix', pathname, '--root', arg('--root', 'preview')], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  return srv;
}

async function run() {
  const server = await ensureServer();
  const { cdp, close, exe } = await launchBrowser();
  console.log(`Navegador: ${exe}\nPreview: ${BASE}\n`);
  const page = pageApi(cdp);
  const errors = [];
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
  cdp.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' ')); });
  // La página 404 responde 404 a propósito (igual que Blogger): ese aviso no cuenta como error.
  cdp.on('Log.entryAdded', (p) => { if (p.entry.level === 'error' && !/favicon|esta-pagina-no-existe/.test(p.entry.url || '')) errors.push(`${p.entry.text} ${p.entry.url || ''}`); });

  try {
    // ---- portada (escritorio)
    await page.viewport(1280, 900);
    await page.goto(BASE);
    check('html.has-js', await page.evaluate("document.documentElement.classList.contains('has-js') && !document.documentElement.classList.contains('no-js')"));
    check('Fecha de hoy en la cabecera', await page.evaluate("/\\d{4}/.test(document.querySelector('[data-js=date-today]')?.textContent || '')"));
    check('Última hora en marcha (copias aria-hidden en la misma lista)', await page.waitFor("document.querySelector('[data-js=ticker]')?.classList.contains('is-running') && document.querySelectorAll('[data-js=ticker-track] ul').length === 1 && document.querySelector('[data-js=ticker-track] ul > li[aria-hidden=true]')"));
    check('Última hora en UNA sola línea', await page.evaluate("(() => { const items = [...document.querySelectorAll('[data-js=ticker-track] li')]; const tops = new Set(items.map(li => Math.round(li.getBoundingClientRect().top))); return items.length > 1 && tops.size === 1; })()"));
    await page.evaluate("document.querySelector('[data-js=ticker-pause]')?.click()");
    check('Pausa del ticker (aria-pressed + is-paused)', await page.evaluate("document.querySelector('[data-js=ticker-pause]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-js=ticker]').classList.contains('is-paused')"));
    check('Tiempo de lectura en tarjetas', await page.waitFor("document.querySelectorAll('[data-js=readtime]:not([hidden])').length >= 3"));
    check('Fechas en español', await page.evaluate("[...document.querySelectorAll('[data-js=date]')].every(t => /hace|ahora|\\d{4}/i.test(t.textContent))"));
    // Los bloques se rellenan al acercarse al viewport: se recorren uno a uno.
    const blocks = await page.evaluate("document.querySelectorAll('[data-js=home-section]').length");
    for (let i = 0; i < blocks; i++) {
      await page.evaluate(`document.querySelectorAll('[data-js=home-section]')[${i}].scrollIntoView()`);
      await page.waitFor(`(() => { const s = document.querySelectorAll('[data-js=home-section]')[${i}]; return s.hidden || s.querySelector('[data-js=card-list] [data-post-id]'); })()`, 4000);
    }
    check('Bloques de sección rellenados', await page.evaluate("[...document.querySelectorAll('[data-js=home-section]')].filter(s => !s.hidden).every(s => s.querySelector('[data-js=card-list] [data-post-id]') && !s.querySelector('.c-card--skeleton'))"), `${blocks} bloques`);
    check('Bloques de sección sin repetir noticias entre sí', await page.evaluate("(() => { const a = [...document.querySelectorAll('[data-js=home-section] [data-post-id]')].map(e => e.dataset.postId); return a.length === new Set(a).size; })()"));
    const ids = await page.evaluate("JSON.stringify([...document.querySelectorAll('#Blog1 [data-post-id]')].map(e => e.dataset.postId))");
    const before = JSON.parse(ids).length;
    await page.evaluate("document.querySelector('[data-js=load-more]')?.click()");
    check('Cargar más añade noticias sin recargar', await page.waitFor(`document.querySelectorAll('#Blog1 [data-post-id]').length > ${before}`), `${before} → ${await page.evaluate("document.querySelectorAll('#Blog1 [data-post-id]').length")}`);
    check('Sin noticias repetidas tras cargar más', await page.evaluate("(() => { const a = [...document.querySelectorAll('#Blog1 [data-post-id]')].map(e => e.dataset.postId); return a.length === new Set(a).size; })()"));

    // ---- modo oscuro
    const wasDark = await page.evaluate("document.querySelector('[data-js=theme-toggle]').getAttribute('aria-pressed') === 'true'");
    await page.evaluate("document.querySelector('[data-js=theme-toggle]').click()");
    await page.waitFor("document.documentElement.hasAttribute('data-theme')");
    check('Botón de tema cambia data-theme, aria-pressed y lo guarda', await page.evaluate(`document.documentElement.dataset.theme === '${wasDark ? 'light' : 'dark'}' && document.querySelector('[data-js=theme-toggle]').getAttribute('aria-pressed') === '${!wasDark}' && localStorage.getItem('hd-theme') === document.documentElement.dataset.theme`));
    await page.goto(BASE);
    check('El tema elegido se mantiene al recargar (sin parpadeo: lo aplica head.js)', await page.evaluate(`document.documentElement.dataset.theme === '${wasDark ? 'light' : 'dark'}'`));
    await page.evaluate("localStorage.removeItem('hd-theme')");

    // ---- búsqueda
    await page.evaluate("document.querySelector('[data-js=search-toggle]').click()");
    check('Abrir búsqueda: panel visible y foco en el campo', await page.waitFor("!document.querySelector('[data-js=search]').hidden && document.activeElement === document.querySelector('[data-js=search-input]')"));
    await page.type('tren');
    check('Resultados rápidos al escribir', await page.waitFor("document.querySelector('[data-js=search-results] [data-post-id]')"), await page.evaluate("document.querySelector('[data-js=search-status]')?.textContent || ''"));
    await page.key('ArrowDown', 'ArrowDown');
    check('Flecha abajo lleva al primer resultado', await page.evaluate("document.querySelector('[data-js=search-results]').contains(document.activeElement)"));
    await page.key('Escape');
    check('Esc cierra la búsqueda y devuelve el foco al botón', await page.waitFor("document.querySelector('[data-js=search]').hidden && document.activeElement === document.querySelector('[data-js=search-toggle]')"));

    // ---- menú (móvil)
    await page.viewport(390, 844, true);
    await page.goto(BASE);
    const toggleVisible = await page.evaluate("!!document.querySelector('[data-js=menu-toggle]')?.offsetParent");
    if (toggleVisible) {
      await page.evaluate("document.querySelector('[data-js=menu-toggle]').click()");
      check('Menú móvil: is-open + aria-expanded + velo', await page.waitFor("document.querySelector('[data-js=menu]').classList.contains('is-open') && document.querySelector('[data-js=menu-toggle]').getAttribute('aria-expanded') === 'true' && !document.querySelector('[data-js=scrim]').hidden"));
      check('Menú móvil: el foco entra en el panel', await page.evaluate("document.querySelector('[data-js=menu]').contains(document.activeElement)"));
      check('Menú móvil abierto = diálogo modal con nombre', await page.evaluate("(() => { const m = document.querySelector('[data-js=menu]'); const name = m.getAttribute('aria-labelledby') ? document.getElementById(m.getAttribute('aria-labelledby'))?.textContent.trim() : m.getAttribute('aria-label'); return m.getAttribute('role') === 'dialog' && m.getAttribute('aria-modal') === 'true' && !!name; })()"));
      await page.key('Escape');
      check('Menú móvil: Esc cierra y devuelve el foco', await page.waitFor("!document.querySelector('[data-js=menu]').classList.contains('is-open') && document.activeElement === document.querySelector('[data-js=menu-toggle]')"));
      check('El menú nunca lleva hidden', await page.evaluate("!document.querySelector('[data-js=menu]').hidden"));
      check('Menú cerrado: sin role=dialog ni aria-modal', await page.evaluate("(() => { const m = document.querySelector('[data-js=menu]'); return !m.hasAttribute('role') && !m.hasAttribute('aria-modal'); })()"));
    } else {
      check('Botón de menú visible en móvil', false, 'el CSS lo oculta a 390 px');
    }
    check('Sin scroll horizontal a 390 px', await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `${await page.evaluate('document.documentElement.scrollWidth')} px`);

    // ---- noticia
    await page.viewport(1280, 900);
    const postUrl = await page.evaluate("document.querySelector('#Blog1 [data-post-id] a[href*=\"/2026/\"]')?.href");
    await page.goto(postUrl);
    check('Última hora desde el feed (noticia), en una línea', await page.waitFor("(() => { const items = [...document.querySelectorAll('[data-js=ticker-track] li')]; return items.length > 1 && new Set(items.map(li => Math.round(li.getBoundingClientRect().top))).size === 1; })()"));
    check('Portada: alt y pie tomados de la 1ª imagen', await page.evaluate("!!document.querySelector('[data-js=cover-img]')?.alt && !document.querySelector('[data-js=cover-caption]').hidden"));
    check('Portada: la 1ª imagen no se repite en el cuerpo', await page.evaluate("[...document.querySelectorAll('[data-js=post-body] img')].filter(i => i.offsetParent).every(i => !i.closest('[hidden]')) && !!document.querySelector('[data-js=post-body] > [hidden]')"));
    check('Tiempo de lectura del artículo', await page.evaluate("[...document.querySelectorAll('article [data-js=readtime]')].some(e => !e.hidden && /min/.test(e.textContent))"));
    check('Sumario (TOC) con 3+ entradas', await page.evaluate("!document.querySelector('[data-js=toc]').hidden && document.querySelectorAll('[data-js=toc-list] a').length >= 3"), `${await page.evaluate("document.querySelectorAll('[data-js=toc-list] a').length")} entradas`);
    check('Compartir: WhatsApp lleva titular + URL', await page.evaluate("[...document.querySelectorAll('[data-js=share] a[data-network=whatsapp]')].every(a => /text=.+%20http/.test(a.href))"));
    check('Compartir: botón copiar visible', await page.evaluate("[...document.querySelectorAll('[data-js=share-copy]')].every(b => !b.hidden)"));
    await page.evaluate("document.querySelector('[data-js=related]')?.scrollIntoView()");
    check('Relacionadas sin la noticia actual', await page.waitFor("(() => { const r = document.querySelector('[data-js=related]'); if (!r) return true; const cur = document.querySelector('article[data-post-id]').dataset.postId; const ids = [...r.querySelectorAll('[data-post-id]')].map(e => e.dataset.postId); return r.hidden || (ids.length && !ids.includes(cur)); })()"));
    const sdt = await page.evaluate("CSS.supports('animation-timeline: scroll()')");
    if (!sdt) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight / 2)');
      check('Barra de progreso (JS)', await page.waitFor("parseFloat(getComputedStyle(document.querySelector('[data-js=progress]')).getPropertyValue('--progress')) > 0"));
    } else {
      check('Barra de progreso: la resuelve el CSS (scroll-timeline)', true);
    }

    // ---- 404 y etiqueta
    await page.goto(`${BASE}esta-pagina-no-existe`);
    await page.evaluate("document.querySelector('[data-js=home-section]')?.scrollIntoView()");
    check('404: bloque de últimas noticias', await page.waitFor("document.querySelector('[data-js=home-section] [data-post-id]')"));
    await page.goto(`${BASE}search/label/${encodeURIComponent('Economía')}`);
    check('Etiqueta: todas las tarjetas son de Economía', await page.evaluate("[...document.querySelectorAll('#Blog1 [data-post-id]')].every(c => c.dataset.section === 'Economía')"));

    check('Sin errores en la consola', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await close();
    server?.kill();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? `✖ ${failed.length} de ${results.length} comprobaciones fallaron` : `✔ ${results.length} comprobaciones correctas`}`);
  process.exitCode = failed.length ? 1 : 0;
}

run().catch((err) => { console.error(`✖ ${err.stack || err.message}`); process.exitCode = 1; });
