import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataFile = path.join(root, 'saida', 'ultimo.json');
const port = Number(process.env.PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  try {
    const isData = request.url === '/api/dados';
    const requested = isData ? dataFile : path.join(publicDir, request.url === '/' ? 'index.html' : request.url);
    const file = await fs.readFile(path.normalize(requested));
    response.writeHead(200, { 'Content-Type': isData ? mime['.json'] : (mime[path.extname(requested)] || 'application/octet-stream'), 'Cache-Control': 'no-store' });
    response.end(file);
  } catch {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Arquivo ou coleta nao encontrada.' }));
  }
});

server.listen(port, () => console.log(`Pluggy Monitor em http://localhost:${port}`));