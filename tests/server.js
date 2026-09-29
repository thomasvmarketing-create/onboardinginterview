// Local server that behaves like the Vercel deployment: serves the static files
// (with clean URLs, so /admin -> admin.html) and runs api/*.js as functions.
// Usage: MEMORY_STORE=1 ADMIN_PASSWORD=test node tests/server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

function start(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
      const file = path.join(ROOT, 'api', name + '.js');
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
      req.query = Object.fromEntries(url.searchParams);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString('utf8');
        try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = raw; }
      }
      return require(file)(req, res);
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    let file = path.join(ROOT, p);
    if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

if (require.main === module) {
  const port = Number(process.argv[2] || 3000);
  start(port).then(() => console.log('Onboarding site on http://localhost:' + port + '  (dashboard: /admin)'));
}
module.exports = { start };
