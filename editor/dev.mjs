import { createServer as createHttpServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'vite';
import { prepare, root, workspace, syncRecord, validateRecord, json } from './workspace.mjs';

const port = Number(process.env.EDITOR_PORT ?? 8080);
const proxyPort = Number(process.env.EDITOR_PROXY_PORT ?? 8081);
const sitePort = Number(process.env.EDITOR_SITE_PORT ?? 5174);
const origin = `http://127.0.0.1:${port}`;
const site = await createServer({ root, server: { host: '127.0.0.1', port: sitePort, strictPort: true } });
let proxy, http;
let queue = Promise.resolve();
let stopping = false;
const status = { ready: false, error: null, lastSaved: null, record: null, siteUrl: `http://127.0.0.1:${sitePort}` };

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await queue;
  proxy?.kill('SIGTERM');
  http?.close();
  await site.close();
  process.exitCode = code;
}
let state;
try {
  state = await prepare(site);
  Object.assign(status, { counts: state.counts, orphans: state.orphans });
  const config = {
    backend: { name: 'git-gateway', branch: 'editor' },
    local_backend: { url: `${origin}/api/v1` },
    media_folder: 'media', public_folder: '/media',
    publish: true, editor: { preview: false },
    collections: ['people', 'filings'].map(kind => ({
      name: kind, label: kind === 'people' ? 'People' : 'Filing records', folder: `content/${kind}`,
      format: 'json', extension: 'json', create: false, delete: false,
      identifier_field: 'title', summary: '{{title}}', sortable_fields: ['title'],
      editor: { preview: false }, fields: [
        { name: 'id', widget: 'hidden' }, { name: 'title', widget: 'hidden' },
        { name: 'record', label: 'Repository data', widget: 'repository-record', kind }
      ]
    }))
  };
  http = createHttpServer(async (request, response) => {
    try {
      // The editor serves only its own assets and accepts same-origin validation requests.
      const host = request.headers.host?.split(':')[0];
      if (!['127.0.0.1', 'localhost'].includes(host)) { response.writeHead(403).end(); return; }
      const path = new URL(request.url, origin).pathname;
      if (path === '/api/v1' && request.method === 'POST') {
        if (request.headers.origin && ![origin, `http://localhost:${port}`].includes(request.headers.origin)) { response.writeHead(403).end(); return; }
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 1024 * 1024) throw new Error('Request is too large'); }
        const message = JSON.parse(body);
        const persist = message.action === 'persistEntry';
        if (!['info', 'entriesByFolder', 'entriesByFiles', 'getEntry', 'getDeployPreview', 'persistEntry'].includes(message.action)) throw new Error('This proof of concept only edits existing records');
        const entries = persist ? message.params.dataFiles ?? [message.params.entry] : [];
        if (persist) {
          if (message.params.assets?.length) throw new Error('Media uploads are not enabled in this proof of concept');
          for (const entry of entries) {
            const known = state.catalog.get(entry.path);
            if (!known || entry.newPath && entry.newPath !== entry.path) throw new Error('Creating or renaming records is not enabled');
            validateRecord(JSON.parse(entry.raw), known, state.validateChanges);
          }
        }
        const execute = async () => {
          const upstream = await fetch(`http://127.0.0.1:${proxyPort}/api/v1`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
          const result = await upstream.text();
          if (!upstream.ok) throw new Error(`Decap proxy rejected the request: ${result}`);
          // A Decap save succeeds only after the canonical, tracked override file is safely written.
          for (const entry of entries) {
            const title = await syncRecord(entry.path, state);
            Object.assign(status, { error: null, lastSaved: new Date().toISOString(), record: title });
            console.log(`Saved overrides: ${title}`);
          }
          response.writeHead(200, { 'Content-Type': 'application/json' }).end(result);
        };
        if (persist) {
          const operation = queue.then(execute);
          queue = operation.catch(error => { status.error = String(error.message ?? error); });
          await operation;
        } else await execute();
        return;
      }
      if (path === '/validate' && request.method === 'POST') {
        if (request.headers.origin !== origin && request.headers.origin !== `http://localhost:${port}`) { response.writeHead(403).end(); return; }
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 1024 * 1024) throw new Error('Record is too large'); }
        const { relative, record } = JSON.parse(body);
        const entry = state.catalog.get(relative);
        if (!entry) throw new Error('Unknown record');
        validateRecord(record, entry, state.validateChanges);
        response.setHeader('Content-Type', 'application/json');
        response.end(json({ valid: true })); return;
      }
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      const payload = path === '/config.json' ? config : path === '/schema.json' ? state.editorFields : path === '/status.json' ? status : null;
      response.setHeader('Cache-Control', 'no-store');
      if (payload) { response.setHeader('Content-Type', 'application/json'); response.end(json(payload)); return; }
      const asset = path === '/' ? join(root, 'editor/index.html')
        : ['/app.js', '/editor.css'].includes(path) ? join(root, 'editor', path.slice(1))
        : /^\/vendor\/[\w.-]+\.(js|css|wasm)$/.test(path) ? join(root, 'editor/node_modules/decap-cms/dist', path.slice('/vendor/'.length)) : null;
      if (!asset) { response.writeHead(404).end('Not found'); return; }
      const type = asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : asset.endsWith('.wasm') ? 'application/wasm' : 'text/html';
      response.setHeader('Content-Type', type);
      response.end(await readFile(asset));
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json' }).end(json({ error: String(error.message ?? error) }));
    }
  });
  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(port, '127.0.0.1', resolve); });
  proxy = spawn(process.execPath, [join(root, 'editor/node_modules/decap-server/dist/index.js')], {
    cwd: workspace, env: { ...process.env, PORT: String(proxyPort), BIND_HOST: '127.0.0.1', MODE: 'fs', GIT_REPO_DIRECTORY: workspace }, stdio: 'inherit'
  });
  proxy.once('exit', code => { if (!stopping) { console.error(`Decap proxy exited (${code}).`); void stop(1); } });
  await site.listen();
  status.ready = true;
  console.log(`\nLocal Decap editor: ${origin}\nLocal site: ${status.siteUrl}\n${state.counts.people} people · ${state.counts.filings} filings\nEdits persist in src/data/editor-overrides.json. Ctrl+C stops all three servers.\n`);
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
} catch (error) { console.error(error); await stop(1); }
