// Run the MCP server locally at http://127.0.0.1:8787/mcp without the Netlify CLI.
// Uses Vite's SSR loader, like the prerender script, so JSON imports resolve the same way.
import { createServer as createHttpServer } from 'node:http';
import { Readable } from 'node:stream';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true } });
const { handleMcpRequest } = await vite.ssrLoadModule('/src/mcp/server.ts');
const port = Number(process.env.PORT || 8787);

createHttpServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname !== '/mcp' && url.pathname !== '/mcp/') { res.writeHead(404).end('Not found'); return; }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: 'half' });
  const response = await handleMcpRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`Elections Utah MCP server: http://127.0.0.1:${port}/mcp`));
