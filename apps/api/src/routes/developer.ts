import { Router } from 'express';
import { z } from 'zod';
import type { IntegrationStatus } from '@bhavai/shared';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { parseWith, pathParam } from '../utils/http.js';
import { getDb } from '../db/index.js';
import { env, integrationSnapshot } from '../config/env.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/apiKeys.js';
import { MCP_TOOL_CATALOG } from '../mcp/catalog.js';
import { getAccessToken, PayPalError } from '../payments/paypal.js';
import { geminiPing } from '../services/gemini.js';

export const developerRouter = Router();
developerRouter.use(optionalAuth);

developerRouter.get('/integrations', async (req, res, next) => {
  try {
    requireAuth(req);
    const db = await getDb();
    const snapshot = integrationSnapshot();
    const status: IntegrationStatus = {
      database: { mode: db.mode, label: db.label, ok: true },
      gemini: { ...snapshot.gemini, lastCheck: null },
      paypal: snapshot.paypal,
      mcp: {
        enabled: true,
        path: '/mcp',
        authenticated: Boolean(env.mcpApiKey),
        toolCount: MCP_TOOL_CATALOG.length,
      },
      channel3: {
        configured: false,
        note: 'Not part of this build. Catalog data comes from the seller.',
      },
      email: {
        configured: false,
        note: 'No transactional email provider is configured. Password-reset links are created but not emailed; the development link is returned in non-production only.',
      },
    };
    res.json({ data: { integrations: status, environment: env.nodeEnv, apiBaseUrl: env.apiBaseUrl, mcpEndpoint: `${env.apiBaseUrl}/mcp` } });
  } catch (error) {
    next(error);
  }
});

developerRouter.get('/tools', async (req, res, next) => {
  try {
    requireAuth(req);
    res.json({
      data: {
        tools: MCP_TOOL_CATALOG,
        endpoint: `${env.apiBaseUrl}/mcp`,
        protocolVersion: '2025-06-18',
        auth: 'Authorization: Bearer bvk_… (create a key below) or x-bhavai-key',
      },
    });
  } catch (error) {
    next(error);
  }
});

developerRouter.get('/keys', async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    res.json({ data: { keys: await listApiKeys(auth.user.id) } });
  } catch (error) {
    next(error);
  }
});

developerRouter.post('/keys', writeLimiter, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const input = parseWith(
      z.object({ label: z.string().trim().min(2, 'Add a label so you can recognise this key').max(80) }),
      req.body,
    );
    const { key, secret } = await createApiKey({ userId: auth.user.id, role: auth.user.role, label: input.label });
    res.status(201).json({
      data: {
        key,
        secret,
        warning: 'Copy this key now. It is shown once and cannot be recovered.',
      },
    });
  } catch (error) {
    next(error);
  }
});

developerRouter.delete('/keys/:id', async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const key = await revokeApiKey(auth.user.id, pathParam(req, 'id'));
    res.json({ data: { key } });
  } catch (error) {
    next(error);
  }
});

developerRouter.post('/test/paypal', writeLimiter, async (req, res, next) => {
  try {
    requireAuth(req);
    if (!env.paypal.configured) {
      res.status(503).json({
        error: {
          code: 'PAYPAL_NOT_CONFIGURED',
          message: 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set. No PayPal request was made.',
          requestId: req.requestId,
        },
      });
      return;
    }
    try {
      await getAccessToken(true);
      res.json({
        data: {
          ok: true,
          environment: env.paypal.environment,
          message: 'PayPal Sandbox OAuth succeeded. This checked credentials only; it did not move money.',
        },
      });
    } catch (error) {
      if (error instanceof PayPalError) {
        res.status(error.status).json({
          error: {
            code: 'PAYPAL_ERROR',
            message: error.message,
            requestId: req.requestId,
          },
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

developerRouter.post('/test/gemini', writeLimiter, async (req, res, next) => {
  try {
    requireAuth(req);
    const result = await geminiPing();
    if (!env.gemini.configured) {
      res.status(503).json({
        error: {
          code: 'LLM_UNAVAILABLE',
          message: result.message,
          requestId: req.requestId,
        },
      });
      return;
    }
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
