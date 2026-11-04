import { z } from 'zod';
import { CATEGORIES, formatMoney, roundMoney } from '@bhavai/shared';
import { env } from '../config/env.js';
import { geminiConfigured, geminiJson } from './gemini.js';
import { logger } from '../utils/logger.js';

export type AgentMode = 'GEMINI' | 'POLICY';

export function agentMode(): AgentMode {
  return geminiConfigured() ? 'GEMINI' : 'POLICY';
}

/* ------------------------------------------------------------------ */
/* Buyer intent parsing                                               */
/* ------------------------------------------------------------------ */

export type ParsedIntent = {
  productQuery: string;
  quantity: number;
  budgetTotal: number | null;
  currency: string | null;
  category: string | null;
  urgency: string | null;
  mode: AgentMode;
};

const IntentSchema = z.object({
  productQuery: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().int().min(1).max(100_000),
  budgetTotal: z.coerce.number().positive().nullable().optional().default(null),
  currency: z.string().trim().max(8).nullable().optional().default(null),
  category: z.string().trim().max(60).nullable().optional().default(null),
  urgency: z.string().trim().max(40).nullable().optional().default(null),
});

const STOPWORDS = new Set([
  'i', 'need', 'want', 'looking', 'for', 'from', 'the', 'a', 'an', 'please', 'would', 'like', 'to', 'buy', 'order',
  'my', 'we', 'us', 'me', 'with', 'maximum', 'max', 'total', 'budget', 'is', 'of', 'and', 'or', 'in', 'units', 'unit',
  'pieces', 'piece', 'pcs', 'quantity', 'about', 'around', 'up', 'per', 'each', 'can', 'you', 'get', 'source', 'find',
  'handmade', 'handcrafted', 'indian', 'india', 'good', 'quality', 'best', 'price', 'quote', 'under',
]);

export function deterministicIntent(text: string, fallbackCurrency?: string): ParsedIntent {
  const lower = text.toLowerCase();
  const quantityMatch =
    lower.match(/\b(\d{1,6})\s*(?:x|units?|pieces?|pcs?|items?|diya?s?|bowls?|holders?|lanterns?|scarves?|stoles?)\b/) ??
    lower.match(/\b(?:quantity|qty)[:\s]+(\d{1,6})\b/);
  let quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;

  let budgetTotal: number | null = null;
  const budgetMatch =
    lower.match(/(?:budget|max(?:imum)?|up to|under|within|spend)[^\d]{0,20}(?:[$₹€£]\s?)?([\d,]+(?:\.\d{1,2})?)/) ??
    lower.match(/(?:[$₹€£]\s?)([\d,]+(?:\.\d{1,2})?)/);
  if (budgetMatch) {
    const parsed = Number(budgetMatch[1].replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) budgetTotal = roundMoney(parsed);
  }

  let currency: string | null = null;
  if (/\$|\busd\b|\bdollars?\b/.test(lower)) currency = 'USD';
  else if (/₹|\binr\b|\brupees?\b/.test(lower)) currency = 'INR';
  else if (/€|\beur\b|\beuros?\b/.test(lower)) currency = 'EUR';
  else if (/£|\bgbp\b|\bpounds?\b/.test(lower)) currency = 'GBP';
  else if (/\baed\b|\bdirhams?\b/.test(lower)) currency = 'AED';
  currency = currency ?? fallbackCurrency ?? null;

  const category =
    CATEGORIES.find((c) => lower.includes(c.toLowerCase())) ??
    (lower.includes('diya') || lower.includes('decor') || lower.includes('lantern') || lower.includes('bowl')
      ? 'Home & Decor'
      : lower.includes('jewel') || lower.includes('necklace') || lower.includes('earring')
        ? 'Jewellery'
        : lower.includes('textile') || lower.includes('scarf') || lower.includes('fabric')
          ? 'Textiles'
          : null);

  // Remove the quantity/budget phrases before extracting product keywords so
  // the search query is about the product, not the constraints.
  const cleaned = lower
    .replace(/\b\d{1,6}\s*(?:x|units?|pieces?|pcs?|items?|diya?s?|bowls?|holders?|lanterns?)\b/g, ' ')
    .replace(/(?:budget|max(?:imum)?|up to|under|within|spend)[^\d]{0,20}(?:[$₹€£]\s?)?[\d,]+(?:\.\d{1,2})?/g, ' ')
    .replace(/[$₹€£][\d,]+(?:\.\d{1,2})?/g, ' ')
    .replace(/[^a-z\s-]/g, ' ');

  const keywords = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 6);

  return {
    productQuery: keywords.join(' ') || text.slice(0, 80),
    quantity,
    budgetTotal,
    currency,
    category,
    urgency: null,
    mode: 'POLICY',
  };
}

export async function parseIntent(text: string, fallbackCurrency?: string): Promise<ParsedIntent> {
  const fallback = deterministicIntent(text, fallbackCurrency);
  if (!geminiConfigured()) return fallback;

  const result = await geminiJson({
    system:
      'You extract structured commerce requirements for an AI buyer. Never invent a budget, quantity, currency or product that the user did not state. Use null when absent. The quantity is the number of units requested. The budget is the TOTAL budget in the stated currency, not a unit price.',
    prompt: `User request: "${text}"\n\nReturn JSON with: productQuery (short search phrase, product nouns only), quantity (integer), budgetTotal (number or null), currency (ISO code or null), category (one of ${CATEGORIES.join(', ')} or null), urgency (short phrase or null).`,
    schema: {
      type: 'OBJECT',
      properties: {
        productQuery: { type: 'STRING' },
        quantity: { type: 'INTEGER' },
        budgetTotal: { type: 'NUMBER', nullable: true },
        currency: { type: 'STRING', nullable: true },
        category: { type: 'STRING', nullable: true },
        urgency: { type: 'STRING', nullable: true },
      },
      required: ['productQuery', 'quantity'],
    },
  });

  if (!result) return fallback;
  const parsed = IntentSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn('intent_schema_mismatch', { issues: parsed.error.issues.length });
    return fallback;
  }
  const data = parsed.data;
  return {
    productQuery: data.productQuery,
    quantity: data.quantity,
    budgetTotal: data.budgetTotal ?? null,
    currency: data.currency ? data.currency.toUpperCase().slice(0, 3) : (fallbackCurrency ?? null),
    category: data.category,
    urgency: data.urgency,
    mode: 'GEMINI',
  };
}

/* ------------------------------------------------------------------ */
/* Negotiation language                                               */
/* ------------------------------------------------------------------ */

function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.'))).filter(Number.isFinite);
}

function outputIsSafe(text: string, allowedNumbers: number[]): boolean {
  if (!text.trim() || text.length > 420) return false;
  if (/floor|minimum allowed|confidential|cost price|margin/i.test(text)) return false;
  const allowed = new Set(allowedNumbers.map((n) => roundMoney(n)));
  for (const n of numbersIn(text)) {
    if (!allowed.has(roundMoney(n))) return false;
  }
  return true;
}

export async function sellerAgentMessage(input: {
  businessName: string;
  productName: string;
  quantity: number;
  currency: string;
  listedPrice: number;
  unitPrice: number;
  round: number;
  decision: 'ACCEPT' | 'COUNTER' | 'REJECT';
  explanation: string;
}): Promise<{ message: string; mode: AgentMode }> {
  const total = roundMoney(input.unitPrice * input.quantity);
  const fallback =
    input.decision === 'ACCEPT'
      ? `For ${input.quantity} × ${input.productName}, ${input.businessName} accepts at ${formatMoney(input.unitPrice, input.currency)} per unit — ${formatMoney(total, input.currency)} total.`
      : input.decision === 'COUNTER'
        ? `For ${input.quantity} units, I can offer ${formatMoney(input.unitPrice, input.currency)} per ${input.productName.toLowerCase()} — ${formatMoney(total, input.currency)} total.`
        : `I can’t meet that price for ${input.quantity} units. The seller has kept their authorised pricing policy in place.`;

  if (!geminiConfigured()) return { message: fallback, mode: 'POLICY' };

  const result = await geminiJson({
    system:
      'You write one short, professional negotiation message in the voice of an Indian artisan business selling to an AI buyer. Use ONLY the prices supplied. Never mention floor prices, margins, cost, internal rules or confidential data. One to three sentences, no emoji, no markdown.',
    prompt: `Seller: ${input.businessName}\nProduct: ${input.productName}\nQuantity: ${input.quantity}\nCurrency: ${input.currency}\nListed unit price: ${input.listedPrice}\nDecision: ${input.decision}\nUnit price in this move: ${input.unitPrice}\nTotal: ${total}\nRound: ${input.round}\nPolicy note: ${input.explanation}\n\nWrite the seller agent's message.`,
    schema: {
      type: 'OBJECT',
      properties: { message: { type: 'STRING' } },
      required: ['message'],
    },
    temperature: 0.4,
  });

  if (!result) return { message: fallback, mode: 'POLICY' };
  const parsed = z.object({ message: z.string() }).safeParse(result.data);
  if (!parsed.success) return { message: fallback, mode: 'POLICY' };
  const safe = outputIsSafe(parsed.data.message, [
    input.unitPrice,
    total,
    input.listedPrice,
    input.quantity,
    input.round,
  ]);
  return { message: safe ? parsed.data.message : fallback, mode: safe ? 'GEMINI' : 'POLICY' };
}

export async function buyerAgentMessage(input: {
  productName: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  round: number;
  decision: 'ACCEPT' | 'OFFER' | 'REJECT';
  budgetTotal: number | null;
  explanation: string;
}): Promise<{ message: string; mode: AgentMode }> {
  const total = roundMoney(input.unitPrice * input.quantity);
  const budgetText = input.budgetTotal ? ` My total budget is ${formatMoney(input.budgetTotal, input.currency)}.` : '';
  const fallback =
    input.decision === 'OFFER'
      ? `I can offer ${formatMoney(input.unitPrice, input.currency)} per ${input.productName.toLowerCase()} for ${input.quantity} units.${budgetText}`
      : input.decision === 'ACCEPT'
        ? `That works. I accept ${formatMoney(input.unitPrice, input.currency)} per unit — ${formatMoney(total, input.currency)} total.`
        : `That price is outside my budget for ${input.quantity} units. I’ll stop here rather than exceed it.`;

  if (!geminiConfigured()) return { message: fallback, mode: 'POLICY' };

  const result = await geminiJson({
    system:
      'You write one short negotiation message in the voice of a procurement AI buying craft products. Use ONLY supplied prices and quantities. Never invent a budget or a discount. One to two sentences, no emoji, no markdown.',
    prompt: `Product: ${input.productName}\nQuantity: ${input.quantity}\nCurrency: ${input.currency}\nDecision: ${input.decision}\nUnit price: ${input.unitPrice}\nTotal: ${total}\nBudget: ${input.budgetTotal ?? 'not stated'}\nRound: ${input.round}\nNote: ${input.explanation}`,
    schema: {
      type: 'OBJECT',
      properties: { message: { type: 'STRING' } },
      required: ['message'],
    },
    temperature: 0.4,
  });

  if (!result) return { message: fallback, mode: 'POLICY' };
  const parsed = z.object({ message: z.string() }).safeParse(result.data);
  if (!parsed.success) return { message: fallback, mode: 'POLICY' };
  const safe = outputIsSafe(parsed.data.message, [
    input.unitPrice,
    total,
    input.quantity,
    input.round,
    input.budgetTotal ?? input.unitPrice,
  ]);
  return { message: safe ? parsed.data.message : fallback, mode: safe ? 'GEMINI' : 'POLICY' };
}

/* ------------------------------------------------------------------ */
/* Analytics narrative                                                */
/* ------------------------------------------------------------------ */

export async function analyticsNarrative(input: {
  businessName: string;
  currency: string;
  negotiationsToday: number;
  negotiationsTotal: number;
  agreed: number;
  salesToday: number;
  salesTotal: number;
  averageDiscount: number;
  conversionRate: number;
  pendingPayments: number;
  topProduct: string | null;
  marketSplit: { domestic: number; crossBorder: number };
}): Promise<{ text: string; mode: AgentMode }> {
  const money = (n: number) => formatMoney(n, input.currency);
  const fallback = buildFallbackNarrative(input, money);

  if (!geminiConfigured()) return { text: fallback, mode: 'POLICY' };

  const result = await geminiJson({
    system:
      'You summarise a seller\'s real commerce dashboard in two or three sentences. Use only the supplied figures; never invent metrics, trends, forecasts or customers. Be direct and specific. No markdown, no emoji, at most 90 words.',
    prompt: JSON.stringify(input),
    schema: {
      type: 'OBJECT',
      properties: { summary: { type: 'STRING' } },
      required: ['summary'],
    },
    temperature: 0.3,
  });

  if (!result) return { text: fallback, mode: 'POLICY' };
  const parsed = z.object({ summary: z.string() }).safeParse(result.data);
  if (!parsed.success || parsed.data.summary.length > 600) return { text: fallback, mode: 'POLICY' };
  return { text: parsed.data.summary, mode: 'GEMINI' };
}

function buildFallbackNarrative(
  input: Parameters<typeof analyticsNarrative>[0],
  money: (n: number) => string,
): string {
  if (input.negotiationsTotal === 0) {
    return 'No negotiations yet. Publish a storefront and share the store link with an AI buyer or run the demo arena to see your first deal.';
  }
  const parts = [
    `${input.negotiationsToday} negotiation${input.negotiationsToday === 1 ? '' : 's'} started today, with ${input.agreed} accepted deal${input.agreed === 1 ? '' : 's'} overall.`,
    `Negotiated discounts average ${input.averageDiscount.toFixed(1)}%, and the conversion rate is ${input.conversionRate.toFixed(1)}%.`,
  ];
  if (input.salesTotal > 0) {
    parts.push(`${money(input.salesTotal)} in settled or paid sales is recorded, with ${money(input.pendingPayments)} still pending payment.`);
  } else {
    parts.push('No payment has been confirmed yet, so revenue is not counted.');
  }
  if (input.topProduct) parts.push(`The most negotiated product is ${input.topProduct}.`);
  if (input.marketSplit.domestic + input.marketSplit.crossBorder > 0) {
    parts.push(`${input.marketSplit.domestic} domestic and ${input.marketSplit.crossBorder} cross-border conversations.`);
  }
  return parts.join(' ');
}

export function negotiationModeLabel(mode: string): string {
  return mode === 'GEMINI' ? `Gemini ${env.gemini.model}` : 'Policy engine (LLM not configured)';
}
