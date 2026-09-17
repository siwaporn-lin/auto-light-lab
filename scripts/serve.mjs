import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function insideRoot(file) {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

const server = http.createServer(async (request, response) => {
  const reply = (code, body, headers = {}) => {
    response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
    response.end(request.method === 'HEAD' ? undefined : body);
  };
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    return reply(400, 'Invalid URL');
  }
  if (/[\0\\:]/.test(pathname) || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) return reply(403, 'Forbidden');
  let file = path.resolve(root, `.${pathname}`);
  if (!insideRoot(file)) return reply(403, 'Forbidden');
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const resolved = await realpath(file);
    if (!insideRoot(resolved)) return reply(403, 'Forbidden');
    const info = await stat(resolved);
    if (!info.isFile()) return reply(404, 'Not found');
    response.writeHead(200, {
      'Content-Type': mime[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') return response.end();
    const stream = createReadStream(resolved);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    reply(error.code === 'EACCES' ? 403 : 404, error.code === 'EACCES' ? 'Forbidden' : 'Not found');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Close the other server or set PORT to another number.` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Auto Light Lab: http://${host}:${port}`);
  console.log('Press Ctrl+C to stop.');
});
