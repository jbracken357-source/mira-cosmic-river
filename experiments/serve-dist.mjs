// Serves a built folder the way the live host does: a missing file is a 404.
// `vite preview` answers a missing file with index.html and 200, so a build that
// lacks an asset passes the production smoke under it (#143). CI runs the smoke
// against this server.
//
//   node experiments/serve-dist.mjs <folder> <port>
import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const [folder, port] = process.argv.slice(2);
if (!folder || !port) throw new Error('usage: node experiments/serve-dist.mjs <folder> <port>');

const root = path.resolve(folder);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const file = pathname.endsWith('/')
    ? path.join(root, decodeURIComponent(pathname), 'index.html')
    : path.join(root, decodeURIComponent(pathname));
  try {
    if (!file.startsWith(root + path.sep)) throw new Error('outside the folder');
    if (!(await fs.stat(file)).isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
}).listen(Number(port), '127.0.0.1', () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}`);
});
