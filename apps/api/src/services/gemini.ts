import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

type GeminiOptions = {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
};

/**
 * Minimal, verified Gemini REST client. Uses the v1beta generateContent
 * endpoint with JSON response mode and a response schema, then validates the
 * parsed JSON in the caller. Returns null on any failure so callers fall back
 * to deterministic policy text instead of failing a transaction.
 */
export async function geminiJson<T = unknown>(options: GeminiOptions): Promise<{ data: T; model: string } | null> {
  if (!env.gemini.configured) return null;
  const model = env.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.gemini.apiKey)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.system }] },
        contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          responseMimeType: 'application/json',
          responseSchema: options.schema,
          maxOutputTokens: 1024,
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('gemini_error', { status: response.status, body: body.slice(0, 300) });
      return null;
    }
    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) return null;
    const parsed = JSON.parse(text) as T;
    return { data: parsed, model };
  } catch (error) {
    logger.warn('gemini_unavailable', { message: (error as Error).message });
    return null;
  }
}

export function geminiConfigured(): boolean {
  return env.gemini.configured;
}

/**
 * Small explicit connectivity check used by the developer console. It runs
 * only when a user asks, never during normal requests.
 */
export async function geminiPing(): Promise<{ ok: boolean; model: string | null; message: string }> {
  if (!env.gemini.configured) {
    return { ok: false, model: null, message: 'GEMINI_API_KEY is not set. The policy engine remains fully functional.' };
  }
  const result = await geminiJson<{ ok?: boolean }>({
    system: 'You are a connectivity probe. Return JSON only.',
    prompt: 'Return {"ok": true}.',
    schema: {
      type: 'OBJECT',
      properties: { ok: { type: 'BOOLEAN' } },
      required: ['ok'],
    },
    temperature: 0,
    timeoutMs: 10_000,
  });
  return result
    ? { ok: true, model: result.model, message: 'Gemini responded to a live structured-output probe.' }
    : { ok: false, model: env.gemini.model, message: 'Gemini did not return a valid response. Check the key, model and quota.' };
}
