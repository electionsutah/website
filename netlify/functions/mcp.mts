// Netlify Function serving the Elections Utah MCP server at /mcp (Streamable HTTP).
import { handleMcpRequest } from '../../src/mcp/server';

export default (request: Request) => handleMcpRequest(request);

export const config = { path: ['/mcp', '/mcp/'] };
