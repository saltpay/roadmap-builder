import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8080;
// Bind to all interfaces by default so the readiness probe in the
// container can reach the server. Local dev sets HOST=127.0.0.1 if it
// wants to keep the server off the LAN.
const HOST = process.env.HOST || '0.0.0.0';
const WEB_DIR = resolve(join(__dirname, 'web'));

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ROUTES = {
  '/': 'index.html',
};

// Client-side routes served by the SPA shell. Any GET that matches one of
// these (or /) falls back to index.html so deep links and reloads work.
const SPA_ROUTES = new Set(['/', '/builder', '/imo-search', '/example']);

// Permanent redirects for legacy URLs (the pre-SPA static pages people
// have bookmarked). Path-only - any query string is preserved.
const REDIRECTS = {
  '/roadmap-builder.html': '/builder',
  '/imo-search.html': '/imo-search',
};

function resolveFilePath(pathname) {
  if (SPA_ROUTES.has(pathname)) return resolve(join(WEB_DIR, 'index.html'));
  const relative = ROUTES[pathname] ?? pathname.replace(/^\/+/, '');
  return resolve(join(WEB_DIR, relative));
}

function isInsideWebDir(filePath) {
  return filePath === WEB_DIR || filePath.startsWith(WEB_DIR + sep);
}

async function serveFile(res, filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
    return;
  }

  try {
    const content = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
  }
}

function logRequest(req) {
  const clientIP = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${clientIP}`);
}

const server = createServer(async (req, res) => {
  logRequest(req);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'GET' && REDIRECTS[pathname]) {
    const target = REDIRECTS[pathname] + url.search + url.hash;
    res.writeHead(301, { Location: target });
    res.end();
    return;
  }

  const filePath = resolveFilePath(pathname);

  if (!isInsideWebDir(filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  await serveFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Serving static files from: ${WEB_DIR}`);
  console.log('SPA routes (served by index.html):');
  for (const route of SPA_ROUTES) {
    console.log(`  GET    ${route}`);
  }
});
