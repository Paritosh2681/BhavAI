import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import type { AuthContext } from '../middleware/auth.js';
import { createMcpServer } from './tools.js';

const buyerAuth: AuthContext = {
  user: { id: 'u-buyer', email: 'buyer@test.local', name: 'Buyer', role: 'BUYER', country: 'US', currency: 'USD' },
  seller: null,
  buyer: { id: 'b1', userId: 'u-buyer', companyName: 'Test Co', country: 'US', currency: 'USD', preferences: '' },
  source: 'api_key',
};

const sellerAuth: AuthContext = {
  user: { id: 'u-seller', email: 'seller@test.local', name: 'Seller', role: 'SELLER', country: 'US', currency: 'USD' },
  seller: {
    id: 's1',
    userId: 'u-seller',
    businessName: 'Test Store',
    country: 'US',
    currency: 'USD',
    storeSlug: 'test-store',
    description: '',
    active: true,
    onboardingComplete: true,
  },
  buyer: null,
  source: 'api_key',
};

async function callTool(auth: AuthContext, name: string, args: Record<string, unknown>) {
  const server = createMcpServer(auth);
  const client = new Client({ name: 'auth-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const result = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    const text = result.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n');
    return { isError: result.isError === true, text };
  } finally {
    await client.close();
    await server.close();
  }
}

describe('MCP tool audience enforcement', () => {
  it('rejects a seller key on the buyer-only advance_negotiation tool', async () => {
    const result = await callTool(sellerAuth, 'advance_negotiation', { negotiationId: 'n1' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('buyer key');
  });

  it('rejects a buyer key on the seller-only check_inventory tool', async () => {
    const result = await callTool(buyerAuth, 'check_inventory', { productId: 'p1', quantity: 1 });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('seller key');
  });
});
