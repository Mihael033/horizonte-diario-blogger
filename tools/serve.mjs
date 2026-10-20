#!/usr/bin/env node
// Servidor local del preview con las mismas rutas que Blogger y compresión gzip/brotli
// (para que Lighthouse mida algo parecido a producción).
//   node tools/serve.mjs [--port 4173] [--root preview] [--prefix /repositorio/]
// --prefix sirve el sitio bajo una subcarpeta, como GitHub Pages (https://usuario.github.io/repositorio/).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => { const k = process.argv.indexOf(name); return k !== -1 && process.argv[k + 1] ? process.argv[k + 1] : fallback; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', arg('--root', 'preview'));
const PORT = Number(arg('--port', process.env.PORT || 4173));
const PREFIX = `/${arg('--prefix', '/').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;
/** Búsqueda sin resultados del preview (ver tools/lib/mock.mjs). */
const EMPTY_QUERY = 'sinresultados';

/** Traduce una URL de Blogger al archivo del preview. */
export function resolveRoute(urlPath, query) {
  let p = decodeURIComponent(urlPath);
  if (p.includes('\0') || p.split('/').includes('..')) return null;
  if (p === '/search' || p === '/search/') {
    if (query.has('updated-max')) return '/search/older.html';
    return query.get('q') === EMPTY_QUERY ? '/search/empty.html' : '/search.html';
  }
  if (p.startsWith('/feeds/posts/')) return '/feeds/posts/default.json';
  if (p.endsWith('/')) p += 'index.html';
  if (!path.extname(p)) p += '.html';
  return p;
}

const cache = new Map();

async function send(req, res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';
  let body = await readFile(file);
  const headers = {
    'Content-Type': type,
    'Cache-Control': /\/img\/|\.ico$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  const accept = String(req.headers['accept-encoding'] || '');
  if (COMPRESSIBLE.test(type) && body.length > 1024) {
    const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
    if (enc) {
      const { mtimeMs } = await stat(file);
      const key = `${file}|${enc}|${mtimeMs}`;
      if (!cache.has(key)) cache.set(key, enc === 'br' ? zlib.brotliCompressSync(body) : zlib.gzipSync(body, { level: 9 }));
      body = cache.get(key);
      headers['Content-Encoding'] = enc;
      headers.Vary = 'Accept-Encoding';
    }
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (PREFIX !== '/' && url.pathname === PREFIX.slice(0, -1)) {
      res.writeHead(301, { Location: `${PREFIX}${url.search}` });
      res.end();
      return;
    }
    const inside = url.pathname.startsWith(PREFIX);
    const route = inside ? resolveRoute(`/${url.pathname.slice(PREFIX.length)}`, url.searchParams) : null;
    const file = route && path.join(ROOT, route);
    const isFile = (f) => stat(f).then((s) => s.isFile(), () => false);
    if (file && file.startsWith(ROOT) && (await isFile(file))) {
      await send(req, res, file);
    } else if (await isFile(path.join(ROOT, '404.html'))) {
      await send(req, res, path.join(ROOT, '404.html'), 404);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 · el preview se está generando o no existe (npm run preview)');
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Error: ${err.message}`);
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(PORT, () => console.log(`Preview en http://localhost:${PORT}${PREFIX} (Ctrl+C para parar)`));
}
