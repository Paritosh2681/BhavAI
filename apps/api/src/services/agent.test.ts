import { describe, it, expect, vi, beforeEach } from 'vitest';

const { geminiConfiguredMock, geminiJsonMock } = vi.hoisted(() => ({
  geminiConfiguredMock: vi.fn(() => false),
  geminiJsonMock: vi.fn(),
}));

vi.mock('./gemini.js', () => ({
  geminiConfigured: geminiConfiguredMock,
  geminiJson: geminiJsonMock,
}));

import { agentMode, buyerAgentMessage, deterministicIntent, sellerAgentMessage } from './agent.js';

beforeEach(() => {
  geminiConfiguredMock.mockReset();
  geminiJsonMock.mockReset();
  geminiConfiguredMock.mockReturnValue(false);
});

describe('agent service', () => {
  it('identifies POLICY mode when Gemini is not configured', () => {
    expect(agentMode()).toBe('POLICY');
  });

  it('extracts quantity, total budget, currency, and product query deterministically', () => {
    const intent = deterministicIntent('I need 15 units of brass diyas under $180 budget', 'USD');
    expect(intent.quantity).toBe(15);
    expect(intent.budgetTotal).toBe(180);
    expect(intent.currency).toBe('USD');
    expect(intent.productQuery).toContain('brass');
    expect(intent.mode).toBe('POLICY');
  });

  it('falls back to POLICY if Gemini tries to leak floor price or invent numbers', async () => {
    geminiConfiguredMock.mockReturnValue(true);
    geminiJsonMock.mockResolvedValueOnce({
      data: { message: 'Our floor price is $7.50, so we counter at $10.00.' },
      model: 'gemini-2.5-flash',
    });

    const result = await sellerAgentMessage({
      businessName: 'Aaranya Crafts',
      productName: 'Hand-cast Brass Diya',
      quantity: 10,
      currency: 'USD',
      listedPrice: 12,
      unitPrice: 10,
      round: 1,
      decision: 'COUNTER',
      explanation: 'Countered within authorised range.',
    });

    expect(result.mode).toBe('POLICY');
    expect(result.message).not.toMatch(/floor/i);
    expect(result.message).toContain('$10.00');
  });

  it('accepts safe Gemini phrasing when only authorized numbers are used', async () => {
    geminiConfiguredMock.mockReturnValue(true);
    geminiJsonMock.mockResolvedValueOnce({
      data: { message: 'For 10 units, I can offer $10.00 per unit ($100.00 total).' },
      model: 'gemini-2.5-flash',
    });

    const result = await sellerAgentMessage({
      businessName: 'Aaranya Crafts',
      productName: 'Hand-cast Brass Diya',
      quantity: 10,
      currency: 'USD',
      listedPrice: 12,
      unitPrice: 10,
      round: 1,
      decision: 'COUNTER',
      explanation: 'Countered within authorised range.',
    });

    expect(result.mode).toBe('GEMINI');
    expect(result.message).toContain('$10.00');
  });

  it('rejects buyer agent Gemini phrasing that invents a new price', async () => {
    geminiConfiguredMock.mockReturnValue(true);
    geminiJsonMock.mockResolvedValueOnce({
      data: { message: 'I can pay $5.00 per unit instead.' },
      model: 'gemini-2.5-flash',
    });

    const result = await buyerAgentMessage({
      productName: 'Hand-cast Brass Diya',
      quantity: 10,
      unitPrice: 10,
      currency: 'USD',
      round: 1,
      decision: 'OFFER',
      budgetTotal: 110,
      explanation: 'Opening offer.',
    });

    expect(result.mode).toBe('POLICY');
    expect(result.message).toContain('$10.00');
  });
});
