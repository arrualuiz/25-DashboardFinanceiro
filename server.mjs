import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'saida');
const port = Number(process.env.PORT || 3000);
const require = createRequire(import.meta.url);
const { normalizarRegistro } = require('./normalizar.cjs');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
};

const safeName = (name) => typeof name === 'string' && name && !name.includes('..') && !path.isAbsolute(name);

async function listFiles() {
  const files = (await fs.readdir(dataDir)).filter(name => name.endsWith('.json') && !/-limpo\.json$/i.test(name));
  return Promise.all(files.map(async (name) => {
    const original = await fs.stat(path.join(dataDir, name));
    const nomeLimpo = name.replace(/\.json$/i, '-limpo.json');
    let normalizado = false;
    let desatualizado = false;
    try {
      const clean = await fs.stat(path.join(dataDir, nomeLimpo));
      normalizado = true;
      desatualizado = original.mtimeMs > clean.mtimeMs;
    } catch {}
    return { nome: name, nomeLimpo, tamanhoBytes: original.size, modificadoEm: original.mtime.toISOString(), normalizado, desatualizado };
  })).then(items => items.sort((a, b) => new Date(b.modificadoEm) - new Date(a.modificadoEm)));
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/arquivos' && request.method === 'GET') {
      return sendJson(response, 200, { arquivos: await listFiles() });
    }
    if (url.pathname === '/api/ver' && request.method === 'GET') {
      const name = url.searchParams.get('nome');
      if (!safeName(name)) return sendJson(response, 400, { erro: 'nome de arquivo inválido' });
      return sendJson(response, 200, { conteudo: JSON.parse(await fs.readFile(path.join(dataDir, name), 'utf8')) });
    }
    if (url.pathname === '/api/normalizar' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const { nome } = JSON.parse(body || '{}');
      if (!safeName(nome)) return sendJson(response, 400, { erro: 'nome de arquivo inválido' });
      const resultado = normalizarRegistro(JSON.parse(await fs.readFile(path.join(dataDir, nome), 'utf8')));
      const nomeLimpo = nome.replace(/\.json$/i, '-limpo.json');
      await fs.writeFile(path.join(dataDir, nomeLimpo), JSON.stringify(resultado, null, 2), 'utf8');
      return sendJson(response, 200, { ok: true, resultado });
    }
    const isData = url.pathname === '/api/dados';
    const publicPath = url.pathname === '/' ? '/index.html' : (url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname);
    let requested = path.join(publicDir, publicPath);
    if (isData) {
      const files = (await fs.readdir(dataDir)).filter(name => /^registro(?:-completo)?-\d+\.json$/.test(name)).sort();
      requested = path.join(dataDir, files.at(-1) || 'ultimo.json');
    }
    const file = await fs.readFile(path.normalize(requested));
    response.writeHead(200, { 'Content-Type': isData ? mime['.json'] : (mime[path.extname(requested)] || 'application/octet-stream'), 'Cache-Control': 'no-store' });
    response.end(file);
  } catch {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Arquivo ou coleta nao encontrada.' }));
  }
});

server.listen(port, () => console.log(`Pluggy Monitor em http://localhost:${port}`));
