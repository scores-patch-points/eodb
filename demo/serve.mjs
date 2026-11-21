import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.argv[3] || 8788);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]);
  const full = path.join(root, p === '/' ? 'index.html' : p);
  if (full !== root && !full.startsWith(root + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404); return res.end('not found'); }
  const headers = { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' };
  if (path.basename(full) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
