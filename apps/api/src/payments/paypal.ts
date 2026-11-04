import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class PayPalError extends Error {
  status: number;
  debugId?: string;
  issue?: string;

  constructor(message: string, status = 502, debugId?: string, issue?: string) {
    super(message);
    this.name = 'PayPalError';
    this.status = status;
    this.debugId = debugId;
    this.issue = issue;
  }
}

let tokenCache: { token: string; expiresAt: number } | null = null;

function basicAuth(): string {
  return Buffer.from(`${env.paypal.clientId}:${env.paypal.clientSecret}`).toString('base64');
}

export async function getAccessToken(force = false): Promise<string> {
  if (!env.paypal.configured) throw new PayPalError('PayPal is not configured.', 503);
  if (!force && tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  const response = await fetch(`${env.paypal.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basicAuth()}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.error('paypal_token_failed', { status: response.status, body: text.slice(0, 300) });
    throw new PayPalError('PayPal authentication failed. Check the Sandbox client credentials.', 502);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function paypalFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${env.paypal.baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message = typeof json.message === 'string' ? json.message : 'PayPal rejected the request.';
    const debugId = typeof json.debug_id === 'string' ? json.debug_id : undefined;
    const details = Array.isArray(json.details) ? (json.details as Array<Record<string, unknown>>) : [];
    const issue = details[0] && typeof details[0].issue === 'string' ? String(details[0].issue) : undefined;
    logger.error('paypal_api_error', { path, status: response.status, message, debugId, issue });
    throw new PayPalError(message, 502, debugId, issue);
  }

  return json as T;
}

export type PayPalOrderResponse = {
  id: string;
  status: string;
  links?: Array<{ rel: string; href: string; method?: string }>;
};

export async function createPayPalOrder(input: {
  orderId: string;
  description: string;
  total: number;
  currency: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayPalOrderResponse> {
  return paypalFetch<PayPalOrderResponse>('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `bhavai-order-${input.orderId}` },
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderId,
          description: input.description.slice(0, 127),
          amount: {
            currency_code: input.currency,
            value: input.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: input.currency,
                value: (input.unitPrice * input.quantity).toFixed(2),
              },
            },
          },
          items: [
            {
              name: input.itemName.slice(0, 127),
              quantity: String(input.quantity),
              unit_amount: {
                currency_code: input.currency,
                value: input.unitPrice.toFixed(2),
              },
              category: 'PHYSICAL_GOODS',
            },
          ],
        },
      ],
      application_context: {
        brand_name: 'BhavAI',
        locale: 'en-US',
        landing_page: 'LOGIN',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    },
  });
}

export function approvalUrl(order: PayPalOrderResponse): string | null {
  const links = order.links ?? [];
  return (links.find((l) => l.rel === 'approve' || l.rel === 'payer-action') ?? links.find((l) => l.rel === 'checkout'))?.href ?? null;
}

export type PayPalCaptureResponse = {
  id: string;
  status: string;
  payer?: { email_address?: string };
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
  links?: Array<{ rel: string; href: string }>;
};

export async function capturePayPalOrder(paypalOrderId: string, requestId: string): Promise<PayPalCaptureResponse> {
  return paypalFetch<PayPalCaptureResponse>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': requestId },
    body: {},
  });
}

export async function getPayPalOrder(paypalOrderId: string): Promise<PayPalCaptureResponse> {
  return paypalFetch<PayPalCaptureResponse>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
}

export async function verifyPayPalWebhook(headers: Record<string, string | string[] | undefined>, event: unknown): Promise<boolean> {
  if (!env.paypal.webhookConfigured) {
    logger.error('paypal_webhook_unconfigured', { reason: 'PAYPAL_WEBHOOK_ID missing' });
    return false;
  }
  const get = (key: string) => {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const transmissionId = get('paypal-transmission-id');
  const transmissionTime = get('paypal-transmission-time');
  const certUrl = get('paypal-cert-url');
  const authAlgo = get('paypal-auth-algo');
  const signature = get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !signature) {
    logger.warn('paypal_webhook_missing_headers');
    return false;
  }

  try {
    const result = await paypalFetch<{ verification_status: string }>('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: signature,
        webhook_id: env.paypal.webhookId,
        webhook_event: event,
      },
    });
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    logger.error('paypal_webhook_verify_failed', { message: (error as Error).message });
    return false;
  }
}

export async function paypalConfigured(): Promise<boolean> {
  return env.paypal.configured;
}
