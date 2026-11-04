import { Router } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { env } from '../config/env.js';
import { loadApiKey, type AuthContext } from '../middleware/auth.js';
import { mcpRateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import { createMcpServer } from './tools.js';

export const mcpRouter = Router();

async function resolveMcpAuth(req: import('express').Request): Promise<AuthContext | null> {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const apiKeyHeader = typeof req.headers['x-bhavai-key'] === 'string' ? req.headers['x-bhavai-key'] : null;
  const candidate = bearer?.startsWith('bvk_') ? bearer : apiKeyHeader?.startsWith('bvk_') ? apiKeyHeader : null;
  if (!candidate) return null;

  // Optional deployment-wide gate: when MCP_API_KEY is set, a request must
  // carry either a valid user key or that server secret. It never grants data
  // access on its own.
  if (env.mcpApiKey && apiKeyHeader === env.mcpApiKey && !candidate) return null;

  return loadApiKey(candidate);
}

function serverKeyAllowed(req: import('express').Request): boolean {
  if (!env.mcpApiKey) return true;
  const apiKeyHeader = typeof req.headers['x-bhavai-key'] === 'string' ? req.headers['x-bhavai-key'] : '';
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '';
  return apiKeyHeader === env.mcpApiKey || bearer === env.mcpApiKey;
}

/**
 * Stateless Streamable HTTP MCP endpoint. A fresh server and transport are
 * created per request, bound to the authenticated API key, so one account's
 * tools can never leak into another session. GET and DELETE are rejected
 * because no server-side session exists.
 */
mcpRouter.all('/', async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'This MCP endpoint is stateless. Use POST with JSON-RPC messages.' },
      id: null,
    });
    return;
  }

  try {
    const auth = await resolveMcpAuth(req);
    if (!auth && !serverKeyAllowed(req)) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized. Send Authorization: Bearer bvk_… for account tools.' },
        id: null,
      });
      return;
    }

    const rateKey = auth?.user.id ?? req.ip ?? 'anonymous';
    if (!mcpRateLimit(`mcp:${rateKey}`, 120, 60_000)) {
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'MCP rate limit reached. Try again in a minute.' },
        id: null,
      });
      return;
    }

    const server = createMcpServer(auth);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(
      req as unknown as Parameters<typeof transport.handleRequest>[0],
      res as unknown as Parameters<typeof transport.handleRequest>[1],
      req.body,
    );
  } catch (error) {
    logger.error('mcp_request_failed', { message: (error as Error).message });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'MCP request failed.' },
        id: null,
      });
    }
  }
});
