#!/usr/bin/env node
// Zero-dependency dev server with live reload.
// Usage: node dev-server.mjs [--port 3000]
// Serves this directory and reloads the browser whenever an .html/.css/.js file changes.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const RELOAD_SNIPPET = `\n<script>
  // live reload (dev-server.mjs)
  new EventSource('/__livereload').onmessage = () => location.reload();
</script>\n`;

const sseClients = new Set();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    const resolved = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const ext = extname(resolved).toLowerCase();
    let body = await readFile(resolved);
    if (ext === '.html') body = Buffer.concat([body, Buffer.from(RELOAD_SNIPPET)]);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>404</title>
      <body style="font-family:system-ui;padding:40px">
      <h1>404</h1><p><code>${pathname}</code> not found.</p>
      <p><a href="/accolade-design-system.html">Accolade Design System</a> · <a href="/index.html">index.html</a></p>
      ${RELOAD_SNIPPET}`);
  }
});

let debounce;
watch(ROOT, { recursive: true }, (_event, file) => {
  if (!file || file.includes('node_modules') || file.startsWith('.git')) return;
  if (!/\.(html|css|m?js|json|svg|png|jpe?g)$/i.test(file)) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`↻ ${file} changed — reloading ${sseClients.size} client(s)`);
    for (const client of sseClients) client.write('data: reload\n\n');
  }, 80);
});

server.listen(PORT, () => {
  console.log(`Dev server running:
  → http://localhost:${PORT}/accolade-design-system.html  (Accolade Design System)
  → http://localhost:${PORT}/index.html                   (Artemis case study)

Live reload is on — edit any .html/.css/.js file and the browser refreshes.`);
});
