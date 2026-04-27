import { createServer } from 'node:http';
import { readFile, writeFile, access, mkdir, readdir, stat } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8080;
// Bind to loopback so the server isn't reachable from other machines on
// the LAN. HOST=0.0.0.0 is supported but discouraged.
const HOST = process.env.HOST || '127.0.0.1';
const WEB_DIR = resolve(join(__dirname, 'web'));

// The server keeps no state across requests. Every /api/* call carries
// the path it operates on. CSRF is handled by NOT sending Access-Control-
// Allow-Origin: cross-origin browser fetches die on preflight and never
// hit our handlers; same-origin fetches (our own page) don't need CORS
// at all. Filename inputs to /api/save and /api/file are path-contained
// (basic input validation, not user discrimination).

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
  // Static files are loaded same-origin by the browser, so CORS headers
  // aren't needed here.
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

function isPathInside(child, parent) {
  return child === parent || child.startsWith(parent + sep);
}

// Native OS folder picker. macOS only for now (osascript). Returns the
// absolute path of the selected folder, or null if the user cancelled.
async function pickFolderViaOS() {
  if (process.platform !== 'darwin') {
    throw new Error(`folder picker not implemented for platform: ${process.platform}`);
  }
  // AppleScript snippet: prompt the user with the standard folder picker,
  // return the POSIX (slash-separated) path. We use execFile with explicit
  // arg vector so nothing here can be shell-interpreted.
  const script = 'set f to choose folder with prompt "Select roadmap folder"\nreturn POSIX path of f';
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const picked = stdout.trim();
    if (!picked) return null;
    // Strip macOS's trailing slash so isInsideRoadmapDir's prefix check works cleanly.
    return picked.replace(/\/$/, '');
  } catch (err) {
    // osascript exits non-zero on user cancel ("User canceled."). Treat as "no pick".
    if (err.stderr && /User canceled/i.test(err.stderr)) return null;
    throw err;
  }
}

// Native OS file picker, restricted to .json. Returns the absolute path,
// or null on cancel.
async function pickFileViaOS() {
  if (process.platform !== 'darwin') {
    throw new Error(`file picker not implemented for platform: ${process.platform}`);
  }
  const script =
    'set f to choose file with prompt "Select roadmap JSON file" of type {"public.json", "json"}\n' +
    'return POSIX path of f';
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const picked = stdout.trim();
    return picked || null;
  } catch (err) {
    if (err.stderr && /User canceled/i.test(err.stderr)) return null;
    throw err;
  }
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let total = 0;
    const max = 25 * 1024 * 1024; // 25 MB ceiling
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > max) {
        rejectBody(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        rejectBody(err);
      }
    });
    req.on('error', rejectBody);
  });
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleSelectFolder(_req, res) {
  let picked;
  try {
    picked = await pickFolderViaOS();
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
    return;
  }
  if (!picked) {
    jsonResponse(res, 200, { ok: false, cancelled: true });
    return;
  }
  jsonResponse(res, 200, { ok: true, path: picked, name: basename(picked) });
}

async function handleSelectFile(_req, res) {
  let picked;
  try {
    picked = await pickFileViaOS();
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
    return;
  }
  if (!picked) {
    jsonResponse(res, 200, { ok: false, cancelled: true });
    return;
  }
  // Read the file so the client can populate the editor in one round trip.
  let content;
  try {
    content = await readFile(picked, 'utf8');
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
    return;
  }
  jsonResponse(res, 200, { ok: true, path: picked, name: basename(picked), content });
}

async function handleListFolder(_req, res, query) {
  const path = query.get('path');
  if (!path) {
    jsonResponse(res, 400, { ok: false, error: 'missing ?path' });
    return;
  }
  try {
    const entries = await readdir(path);
    const files = [];
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      const full = join(path, name);
      try {
        const st = await stat(full);
        if (!st.isFile()) continue;
        files.push({ name, size: st.size, lastModified: st.mtimeMs });
      } catch {
        // Permission errors / dangling symlinks: just skip.
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    jsonResponse(res, 200, { ok: true, dir: path, name: basename(path), files });
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

async function handleReadFile(_req, res, query) {
  const dir = query.get('path');
  const name = query.get('name');
  if (!dir) {
    jsonResponse(res, 400, { ok: false, error: 'missing ?path' });
    return;
  }
  if (!name) {
    jsonResponse(res, 400, { ok: false, error: 'missing ?name' });
    return;
  }
  const target = resolve(dir, name);
  if (!isPathInside(target, dir)) {
    jsonResponse(res, 400, { ok: false, error: 'name escapes directory' });
    return;
  }
  try {
    const content = await readFile(target, 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(content);
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

async function handleSave(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    jsonResponse(res, 400, { ok: false, error: `invalid JSON body: ${err.message}` });
    return;
  }
  const { path, isFile, filename, content } = body ?? {};
  if (typeof content !== 'string') {
    jsonResponse(res, 400, { ok: false, error: 'expected { path, content, ... }' });
    return;
  }
  if (typeof path !== 'string' || !path) {
    jsonResponse(res, 400, { ok: false, error: 'missing path' });
    return;
  }

  let target;
  if (isFile) {
    // path is the file itself.
    target = path;
  } else {
    // path is a directory; filename within it.
    if (typeof filename !== 'string') {
      jsonResponse(res, 400, { ok: false, error: 'folder save requires a filename' });
      return;
    }
    if (!filename.toLowerCase().endsWith('.json')) {
      jsonResponse(res, 400, { ok: false, error: 'filename must end with .json' });
      return;
    }
    // Resolve relative to the directory, then refuse anything outside it.
    // resolve() discards the base for absolute filenames so this also
    // blocks the "filename = /etc/passwd" attack.
    target = resolve(path, filename);
    if (!isPathInside(target, path)) {
      jsonResponse(res, 400, { ok: false, error: 'filename escapes directory' });
      return;
    }
  }

  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
    jsonResponse(res, 200, { ok: true, path: target });
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
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

  if (req.method === 'POST' && pathname === '/api/select-folder') {
    await handleSelectFolder(req, res);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/select-file') {
    await handleSelectFile(req, res);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/list-folder') {
    await handleListFolder(req, res, url.searchParams);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/file') {
    await handleReadFile(req, res, url.searchParams);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/save') {
    await handleSave(req, res);
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
  console.log('Server is stateless: every /api request carries the path it operates on.');
  console.log('SPA routes (served by index.html):');
  for (const route of SPA_ROUTES) {
    console.log(`  GET    ${route}`);
  }
  console.log('  POST   /api/select-folder                          ->  native OS folder picker, returns {path}');
  console.log('  POST   /api/select-file                            ->  native OS file picker, returns {path, content}');
  console.log('  GET    /api/list-folder?path=<dir>                 ->  list .json files in <dir>');
  console.log('  GET    /api/file?path=<dir>&name=<filename>        ->  read <dir>/<filename>');
  console.log('  POST   /api/save  { path, content, isFile? | filename? }  ->  write');
});
