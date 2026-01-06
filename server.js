const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
// Removed unused data handlers

const PORT = process.env.PORT || 8080;
const WEB_DIR = path.join(__dirname, 'web');


// MIME type mapping
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

const server = http.createServer((req, res) => {
  // Log every request
  const timestamp = new Date().toISOString();
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${clientIP}`);

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers for all responses - allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(pathname, req.method);

  // Handle static file serving
  let filePath = path.join(WEB_DIR, pathname);

  // Default to index.html for root path
  if (pathname === '/') {
    filePath = path.join(WEB_DIR, 'index.html');
  }

  if (pathname === '/pulse') {
    filePath = path.join(WEB_DIR, 'pulse/index.html');
  }

  // Prevent path traversal attacks
  const resolvedPath = path.resolve(filePath);
  const resolvedWebDir = path.resolve(WEB_DIR);

  if (!resolvedPath.startsWith(resolvedWebDir + path.sep) && resolvedPath !== resolvedWebDir) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, err => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    // Get file extension and content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Read and serve the file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, 'localhost', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving static files from: ${WEB_DIR}`);
  console.log('Available endpoints:');
  console.log('  GET    / - Roadmap');
});
