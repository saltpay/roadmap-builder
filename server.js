const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = process.env.PORT || 8080;
const WEB_DIR = path.resolve(__dirname, 'web');

const mimeTypes = {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function resolveFile(pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!relative) return null;
  const resolved = path.resolve(WEB_DIR, relative);
  if (!resolved.startsWith(WEB_DIR + path.sep)) return null;
  return resolved;
}

async function serveFile(res, filePath) {
  try {
    const content = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    console.error('Failed to serve file', filePath, err);
    res.writeHead(500, { ...corsHeaders, 'Content-Type': 'text/plain' });
    res.end('Internal server error');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} - ${clientIp}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...corsHeaders, 'Content-Type': 'text/plain', Allow: 'GET, HEAD, OPTIONS' });
    res.end('Method not allowed');
    return;
  }

  const filePath = resolveFile(pathname);
  if (!filePath) {
    res.writeHead(403, { ...corsHeaders, 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  await serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving static files from: ${WEB_DIR}`);
});
