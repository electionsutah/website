import { createServer as createHttpServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'vite';
import { prepare, root, workspace, syncRecord, validateRecord, json } from './workspace.mjs';
import { collectionIndex } from './entry-index.mjs';
import { inspectSchema, saveSchema } from './schema.mjs';
import { elutThemeCss } from './elut-theme.mjs';
import { researchSource, createResearchSync } from './research-sync.mjs';
import { mediaFolder, publicFolder, mediaActions, imageFolders, handleMedia, persistUpload, publicImage } from './media.mjs';

const port = Number(process.env.EDITOR_PORT ?? 8080);
const proxyPort = Number(process.env.EDITOR_PROXY_PORT ?? 8081);
const sitePort = Number(process.env.EDITOR_SITE_PORT ?? 5174);
const origin = `http://127.0.0.1:${port}`;
const site = await createServer({ root, plugins: [{
  name: 'editor-upload-previews',
  configureServer(server) {
    // Vite's public-file index can lag behind uploads created after startup.
    server.middlewares.use(async (request, response, next) => {
      const path = new URL(request.url, 'http://127.0.0.1').pathname;
      if (!path.startsWith('/images/')) return next();
      try {
        const image = await publicImage(root, path);
        if (!image) { response.writeHead(404).end(); return; }
        response.writeHead(200, { 'Content-Type': image.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(image.content);
      } catch { response.writeHead(404).end(); }
    });
  }
}], server: { host: '127.0.0.1', port: sitePort, strictPort: true } });
let proxy, http;
let queue = Promise.resolve();
let stopping = false;
let researchTimer;
const status = { ready: false, error: null, lastSaved: null, record: null, siteUrl: `http://127.0.0.1:${sitePort}` };

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(researchTimer);
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
    logo: { src: '/images/logo-editorial-nav.svg', show_in_header: true },
    backend: { name: 'proxy', proxy_url: `${origin}/api/v1` },
    media_folder: mediaFolder, public_folder: publicFolder, media_library: { name: 'local-images' },
    publish: true, editor: { preview: false },
    collections: ['people', 'filings', 'places', 'offices', 'parties'].map(kind => ({
      name: kind, label: { people: 'People', filings: 'Filings', places: 'Places', offices: 'Offices', parties: 'Parties' }[kind], folder: `content/${kind}`,
      format: 'json', extension: 'json', create: false, delete: false,
      identifier_field: 'title', summary: '{{title}}', sortable_fields: [{ field: 'title', label: 'Title', default_sort: 'asc' }],
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
      if (path === '/elut-theme.css' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' }).end(await elutThemeCss()); return;
      }
      if (path === '/schema-settings.json') {
        if (request.method === 'GET') {
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(json(await inspectSchema(site, state))); return;
        }
        if (request.method === 'POST') {
          if (![origin, `http://localhost:${port}`].includes(request.headers.origin)) { response.writeHead(403).end(); return; }
          let body = '';
          for await (const chunk of request) { body += chunk; if (body.length > 128 * 1024) throw new Error('Schema settings are too large'); }
          const operation = queue.then(async () => {
            const result = await saveSchema(site, state, JSON.parse(body));
            for (const collection of config.collections) collection.label = result.collections.find(row => row.kind === collection.name).label;
            response.writeHead(200, { 'Content-Type': 'application/json' }).end(json(result));
          });
          queue = operation.catch(() => {});
          await operation; return;
        }
      }
      if (path === '/api/v1' && request.method === 'POST') {
        if (request.headers.origin && ![origin, `http://localhost:${port}`].includes(request.headers.origin)) { response.writeHead(403).end(); return; }
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 32 * 1024 * 1024) throw new Error('Request is too large'); }
        const message = JSON.parse(body);
        if (message.action === 'entriesByFolder') {
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(collectionIndex(state, message.params));
          return;
        }
        if (mediaActions.has(message.action)) {
          const operation = queue.then(() => handleMedia(root, message.action, message.params));
          queue = operation.catch(() => {});
          response.writeHead(200, { 'Content-Type': 'application/json' }).end(json(await operation)); return;
        }
        const persist = message.action === 'persistEntry';
        if (!['info', 'entriesByFolder', 'entriesByFiles', 'getEntry', 'getDeployPreview', 'persistEntry'].includes(message.action)) throw new Error('This proof of concept only edits existing records');
        const entries = persist ? message.params.dataFiles ?? [message.params.entry] : [];
        if (persist) {
          for (const entry of entries) {
            const known = state.catalog.get(entry.path);
            if (!known || entry.newPath && entry.newPath !== entry.path) throw new Error('Creating or renaming records is not enabled');
            validateRecord(JSON.parse(entry.raw), known, state.validateChanges);
          }
        }
        const execute = async () => {
          for (const asset of message.params?.assets ?? []) await persistUpload(root, asset);
          if (persist) { message.params.assets = []; body = JSON.stringify(message); }
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
      if (path === '/media-folders.json') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(json(await imageFolders(root))); return; }
      if (path === '/config.json') {
        const inspected = await inspectSchema(site, state);
        for (const collection of config.collections) collection.label = inspected.collections.find(row => row.kind === collection.name).label;
      }
      const payload = path === '/config.json' ? config : path === '/schema.json' ? state.editorFields : path === '/references.json' ? state.references : path === '/status.json' ? status : null;
      response.setHeader('Cache-Control', 'no-store');
      if (payload) { response.setHeader('Content-Type', 'application/json'); response.end(json(payload)); return; }
      if (/^\/(?:images|party-logos)\//.test(path)) {
        const image = await publicImage(root, path);
        if (!image) { response.writeHead(404).end(); return; }
        response.writeHead(200, { 'Content-Type': image.type, 'X-Content-Type-Options': 'nosniff' }).end(image.content); return;
      }
      const asset = path === '/' ? join(root, 'editor/index.html')
        : path === '/schema' || path === '/schema/' ? join(root, 'editor/schema.html')
        : ['/images/logo-editorial-blue.svg', '/images/logo-editorial-nav.svg'].includes(path) ? join(root, 'public', path.slice(1))
        : ['/app.js', '/media-library.js', '/editor.css', '/schema-ui.js', '/schema.css', '/elut.css'].includes(path) ? join(root, 'editor', path.slice(1))
        : path === '/fonts/material-symbols-outlined-subset.woff2' ? join(root, 'editor/material-symbols-outlined-subset.woff2')
        : /^\/fonts\/(?:noto-sans|source-serif-4)-[a-z-]+\.woff2$/.test(path) ? join(root, 'public', path.slice(1))
        : /^\/icons\/external\/[a-z]+\.svg$/.test(path) ? join(root, 'public', path.slice(1))
        : /^\/vendor\/[\w.-]+\.(js|css|wasm)$/.test(path) ? join(root, 'editor/node_modules/decap-cms/dist', path.slice('/vendor/'.length)) : null;
      if (!asset) { response.writeHead(404).end('Not found'); return; }
      const type = asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : asset.endsWith('.wasm') ? 'application/wasm' : asset.endsWith('.woff2') ? 'font/woff2' : asset.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
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
  let source = researchSource(root);
  if (source) {
    status.researchSource = source;
    let sync = await createResearchSync(root, source, join(workspace, 'research-sync-baseline.json'));
    let refreshing = false, lastError = '';
    const refresh = async () => {
      if (refreshing || stopping) return;
      refreshing = true;
      const operation = queue.then(async () => {
        const nextSource = researchSource(root);
        const sourceChanged = nextSource !== source;
        if (sourceChanged) {
          sync = await createResearchSync(root, nextSource, join(workspace, 'research-sync-baseline.json'));
          source = nextSource;
          status.researchSource = source;
        }
        const changed = await sync();
        if (!changed.length && !lastError && !sourceChanged) return;
        site.moduleGraph.invalidateAll();
        state = await prepare(site);
        Object.assign(status, { counts: state.counts, orphans: state.orphans, error: null, lastSaved: null, researchError: null, researchSource: source, researchUpdated: new Date().toISOString() });
        lastError = '';
        site.ws.send({ type: 'full-reload' });
        console.log(`Research data refreshed: ${state.counts.people} people · ${state.counts.filings} filings`);
      });
      queue = operation.catch(error => {
        const message = String(error.message ?? error);
        status.researchError = message;
        if (message !== lastError) console.error(message);
        lastError = message;
      });
      try { await queue; } finally { refreshing = false; }
    };
    await refresh();
    console.log(`Following research inputs from ${source}`);
    researchTimer = setInterval(refresh, 2000);
  }
  status.ready = true;
  console.log(`\nLocal Decap editor: ${origin}\nLocal site: ${status.siteUrl}\n${state.counts.people} people · ${state.counts.filings} filings\nEdits persist in src/data/editor-overrides.json. Ctrl+C stops all three servers.\n`);
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
} catch (error) { console.error(error); await stop(1); }
