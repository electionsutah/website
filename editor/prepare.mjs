import { createServer } from 'vite';
import { prepare, root } from './workspace.mjs';

const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const state = await prepare(server);
  console.log(`Prepared ${state.counts.people} people and ${state.counts.filings} filings in editor/.workspace.`);
} finally { await server.close(); }
