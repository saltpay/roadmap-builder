import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8080;
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('File not found');
    return;
  }

  try {
    const content = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, ...CORS_HEADERS });
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('Internal server error');
  }
}

function logRequest(req) {
  const clientIP = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${clientIP}`);
}

const server = createServer(async (req, res) => {
  logRequest(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const filePath = resolveFilePath(pathname);

  if (!isInsideWebDir(filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('Access denied');
    return;
  }

  await serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving static files from: ${WEB_DIR}`);
  console.log('SPA routes (served by index.html):');
  for (const route of SPA_ROUTES) {
    console.log(`  GET    ${route}`);
  }
});
