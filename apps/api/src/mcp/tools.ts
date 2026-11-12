import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  CATEGORIES,
  RulesInput,
  formatMoney,
  roundMoney,
} from '@bhavai/shared';
import type { AuthContext, BuyerRow, SellerRow } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { searchMarket, getPublicProduct, getSellerProduct, getRulesForProduct, listSellerProducts, upsertRules, policyFromRules } from '../services/products.js';
import {
  approveDeal,
  createNegotiation,
  getNegotiationDetail,
  listNegotiations,
  rejectNegotiation,
  runNegotiationStep,
} from '../services/negotiation.js';
import { validateOffer } from '../pricing/engine.js';
import { submitBuyerOffer } from '../services/negotiation-offers.js';
import { createPaymentForDeal, getOrder, getPaymentStatus, listOrders } from '../services/orders.js';
import { MCP_TOOL_CATALOG } from './catalog.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function ok(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function fail(error: unknown): ToolResult {
  const message =
    error instanceof AppError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'The tool could not complete.';
  return {
    content: [{ type: 'text', text: `BhavAI error: ${message}` }],
    structuredContent: { error: message },
    isError: true,
  };
}

function requireBuyerContext(auth: AuthContext | null): AuthContext & { buyer: BuyerRow } {
  if (!auth) throw new AppError(401, 'UNAUTHORIZED', 'Connect with a buyer API key to use this tool.');
  if (!auth.buyer) throw new AppError(403, 'FORBIDDEN', 'This API key belongs to a seller. Use a buyer key for negotiation tools.');
  return auth as AuthContext & { buyer: BuyerRow };
}

function requireSellerContext(auth: AuthContext | null): AuthContext & { seller: SellerRow } {
  if (!auth) throw new AppError(401, 'UNAUTHORIZED', 'Connect with a seller API key to use this tool.');
  if (!auth.seller) throw new AppError(403, 'FORBIDDEN', 'This API key belongs to a buyer. Use a seller key for seller tools.');
  return auth as AuthContext & { seller: SellerRow };
}

function requireAnyAuth(auth: AuthContext | null): AuthContext {
  if (!auth) throw new AppError(401, 'UNAUTHORIZED', 'Connect with a BhavAI API key to use this tool.');
  return auth;
}

/**
 * Builds a per-request MCP server bound to the authenticated account. Handlers
 * call the same services as the HTTP API, so rules, stock and payment authority
 * stay in one place. Language models on the client side never decide validity.
 */
export function createMcpServer(auth: AuthContext | null): McpServer {
  const server = new McpServer(
    { name: 'bhavai-commerce', version: '1.0.0' },
    {
      instructions:
        'BhavAI exposes agent-readable storefronts and policy-bounded negotiation. Confidential floor prices are never returned. All prices, stock checks, acceptances and payment amounts are decided server-side by deterministic rules. Domestic India orders settle manually off-platform; cross-border orders use PayPal Sandbox.',
    },
  );

  /* ------------------------------- buyer ------------------------------- */

  const handleSearchMarket = async (args: {
    query?: string;
    category?: (typeof CATEGORIES)[number];
    currency?: 'USD' | 'INR' | 'EUR' | 'GBP' | 'AED';
    country?: string;
    quantity?: number;
    maxTotal?: number;
    pageSize?: number;
  }) => {
    try {
      const result = await searchMarket({
        search: args.query,
        category: args.category,
        currency: args.currency,
        country: args.country,
        quantity: args.quantity,
        maxTotal: args.maxTotal,
        inStock: true,
        pageSize: args.pageSize ?? 12,
      });
      return ok({
        products: result.products,
        total: result.total,
        query: result.query,
        note: 'Listed prices are not offers. Use start_negotiation to ask for a price inside the seller rules.',
      });
    } catch (error) {
      return fail(error);
    }
  };

  const searchSchema = {
    query: z.string().trim().max(200).optional().describe('Product keywords'),
    category: z.enum(CATEGORIES).optional(),
    currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AED']).optional(),
    country: z.string().length(2).optional().describe('Seller country code'),
    quantity: z.number().int().positive().max(100_000).optional(),
    maxTotal: z.number().positive().optional().describe('Buyer total budget in the search currency'),
    pageSize: z.number().int().min(1).max(40).optional(),
  };

  server.registerTool(
    'search_products',
    {
      title: 'Search products in the agent-readable market',
      description:
        'Search published BhavAI storefronts. Returns public products with seller, stock, bulk tiers and public negotiation terms.',
      inputSchema: searchSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleSearchMarket,
  );

  const handleGetProduct = async (args: { productId: string }) => {
    try {
      return ok({ product: await getPublicProduct(args.productId) });
    } catch (error) {
      return fail(error);
    }
  };

  server.registerTool(
    'get_product_details',
    {
      title: 'Read storefront product details',
      description: 'Return one published product, its seller and public negotiation terms. Confidential floor prices are never included.',
      inputSchema: { productId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    handleGetProduct,
  );

  server.registerTool(
    'start_negotiation',
    {
      title: 'Open a negotiation',
      description:
        'Open a buyer-agent negotiation for a product and quantity. Optionally state a total budget and an opening unit price. The deterministic engine validates everything.',
      inputSchema: {
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100_000),
        budgetTotal: z.number().positive().nullable().optional(),
        unitPrice: z.number().positive().optional(),
        message: z.string().trim().max(600).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      try {
        const buyerAuth = requireBuyerContext(auth);
        const negotiation = await createNegotiation(buyerAuth, {
          productId: args.productId,
          quantity: args.quantity,
          budgetTotal: args.budgetTotal ?? null,
          unitPrice: args.unitPrice,
          message: args.message ?? '',
        });
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'get_negotiation',
    {
      title: 'Read a negotiation',
      description: 'Return offer history, deal, order and public policy facts for a negotiation.',
      inputSchema: { negotiationId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const negotiation = await getNegotiationDetail(args.negotiationId, requireAnyAuth(auth));
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'get_deal_details',
    {
      title: 'Read deal details',
      description: 'Read the agreed price, quantity, total amount, currency and confirmation status for an accepted negotiation.',
      inputSchema: { negotiationId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const negotiation = await getNegotiationDetail(args.negotiationId, requireAnyAuth(auth));
        if (!negotiation.deal) {
          return ok({ hasDeal: false, message: 'No agreed deal yet for this negotiation.' });
        }
        return ok({ hasDeal: true, deal: negotiation.deal, marketType: negotiation.marketType });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'advance_negotiation',
    {
      title: 'Advance one agent turn',
      description:
        'Ask the next agent to move exactly once. Buyer and seller agents alternate; the policy engine decides and the database commits atomically.',
      inputSchema: { negotiationId: z.string().min(1) },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const negotiation = await runNegotiationStep(args.negotiationId, requireBuyerContext(auth));
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'submit_offer',
    {
      title: 'Submit a human counteroffer',
      description: 'Submit an explicit buyer unit price for an open negotiation. The seller agent responds on the next advance_negotiation call.',
      inputSchema: {
        negotiationId: z.string().min(1),
        unitPrice: z.number().positive(),
        message: z.string().trim().max(600).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const buyerAuth = requireBuyerContext(auth);
        const detail = await getNegotiationDetail(args.negotiationId, buyerAuth);
        const negotiation = await submitBuyerOffer(args.negotiationId, buyerAuth, {
          unitPrice: args.unitPrice,
          quantity: detail.quantity,
          message: args.message ?? '',
        });
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    },
  );

  /* ------------------------------- seller ------------------------------ */

  server.registerTool(
    'list_products',
    {
      title: 'List seller products',
      description: 'List your own catalog with prices, stock and status.',
      inputSchema: {
        search: z.string().trim().max(120).optional(),
        status: z.enum(['active', 'inactive', 'out']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const result = await listSellerProducts(sellerAuth.seller.id, {
          search: args.search,
          status: args.status,
          pageSize: 100,
        });
        return ok({ products: result.products, total: result.total });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'get_product_rules',
    {
      title: 'Read confidential pricing rules',
      description: 'Return your own product rules, including the floor and minimum allowed price. Seller API keys only.',
      inputSchema: { productId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const rules = await getRulesForProduct(sellerAuth.seller.id, args.productId);
        const db = await getDb();
        const rows = await db.query(
          `SELECT listed_price, currency FROM products WHERE id = $1 AND seller_id = $2`,
          [args.productId, sellerAuth.seller.id],
        );
        return ok({
          rules,
          listedPrice: roundMoney(Number(rows[0]?.listed_price ?? 0)),
          currency: String(rows[0]?.currency ?? sellerAuth.seller.currency),
          confidentiality: 'These values are seller-only and are never returned by buyer-facing tools.',
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'update_product_rules',
    {
      title: 'Update pricing rules',
      description:
        'Replace the negotiation rules for one of your products. The server validates consistency with the listed price and marks the rules as seller-confirmed.',
      inputSchema: {
        productId: z.string().min(1),
        rules: RulesInput,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const rules = await upsertRules(sellerAuth.seller.id, args.productId, args.rules);
        const db = await getDb();
        await db.query(`UPDATE sellers SET rules_confirmed = TRUE, updated_at = NOW() WHERE id = $1`, [sellerAuth.seller.id]);
        return ok({ rules, confirmed: true });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'list_negotiations',
    {
      title: 'List negotiations',
      description: 'List negotiations visible to the authenticated seller or buyer, newest first.',
      inputSchema: {
        status: z.enum(['OPEN', 'AWAITING_APPROVAL', 'AGREED', 'REJECTED', 'CANCELLED', 'EXPIRED']).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const result = await listNegotiations(requireAnyAuth(auth), {
          status: args.status,
          pageSize: args.pageSize ?? 25,
        });
        return ok(result);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'evaluate_offer',
    {
      title: 'Evaluate an offer against rules',
      description: 'Evaluate an offered price and quantity against seller rules deterministically without exposing private floor prices.',
      inputSchema: {
        productId: z.string().min(1),
        unitPrice: z.number().positive(),
        quantity: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const [rules, product] = await Promise.all([
          getRulesForProduct(sellerAuth.seller.id, args.productId),
          getSellerProduct(sellerAuth.seller.id, args.productId),
        ]);
        const policy = policyFromRules(rules, product);
        const check = validateOffer({
          unitPrice: args.unitPrice,
          quantity: args.quantity,
          stock: product.stock,
          policy,
        });
        return ok({
          valid: check.valid,
          code: check.code,
          message: check.message,
          discountPercent: check.discountPercent,
          total: check.total,
          quantity: check.quantity,
          unitPrice: check.unitPrice,
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'generate_counteroffer',
    {
      title: 'Generate policy counteroffer',
      description: 'Generate the next counteroffer position adhering to target discount and confidential floor constraints.',
      inputSchema: { negotiationId: z.string().min(1) },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const negotiation = await runNegotiationStep(args.negotiationId, sellerAuth);
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'check_inventory',
    {
      title: 'Check inventory availability',
      description: 'Check whether sufficient stock is available to satisfy an order quantity.',
      inputSchema: {
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const product = await getSellerProduct(sellerAuth.seller.id, args.productId);
        const available = product.stock >= args.quantity;
        return ok({
          productId: product.id,
          requestedQuantity: args.quantity,
          availableStock: product.stock,
          sufficient: available,
          inStock: product.stock > 0,
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'accept_offer',
    {
      title: 'Accept or approve deal',
      description: 'Approve a deal held for seller approval. Stock is reserved atomically at approval.',
      inputSchema: { negotiationId: z.string().min(1) },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        return ok({ negotiation: await approveDeal(args.negotiationId, sellerAuth) });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'reject_offer',
    {
      title: 'Reject a negotiation',
      description: 'Close an open negotiation or pending deal with an explicit reason.',
      inputSchema: {
        negotiationId: z.string().min(1),
        reason: z.string().trim().max(300).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const negotiation = await rejectNegotiation(args.negotiationId, sellerAuth, args.reason);
        return ok({ negotiation, rejected: true });
      } catch (error) {
        return fail(error);
      }
    },
  );

  /* ------------------------------ commerce ----------------------------- */

  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description: 'List orders visible to the authenticated account with payment and settlement state.',
      inputSchema: {
        status: z
          .enum(['PENDING_PAYMENT', 'APPROVAL_PENDING', 'PAID', 'SETTLEMENT_PENDING', 'SETTLED', 'FULFILLED', 'CANCELLED', 'FAILED'])
          .optional(),
        market: z.enum(['DOMESTIC', 'CROSS_BORDER']).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const result = await listOrders(requireAnyAuth(auth), {
          status: args.status,
          market: args.market,
          pageSize: args.pageSize ?? 25,
        });
        return ok(result);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    'get_order',
    {
      title: 'Read an order',
      description: 'Read one order including its payment record and honest settlement note.',
      inputSchema: { orderId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        return ok({ order: await getOrder(args.orderId, requireAnyAuth(auth)) });
      } catch (error) {
        return fail(error);
      }
    },
  );

  const handleCreatePayment = async (args: { negotiationId: string }) => {
    try {
      const buyerAuth = requireBuyerContext(auth);
      const result = await createPaymentForDeal(args.negotiationId, buyerAuth, env.appUrl);
      return ok({
        ...result,
        amountDisplay: formatMoney(result.payment.amount, result.payment.currency),
      });
    } catch (error) {
      return fail(error);
    }
  };

  server.registerTool(
    'create_payment',
    {
      title: 'Create a payment',
      description:
        'Create the server-authoritative payment for an agreed, buyer-confirmed deal. Domestic India orders become manual-settlement orders. Cross-border orders use PayPal Sandbox and fail honestly if it is not configured.',
      inputSchema: { negotiationId: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    handleCreatePayment,
  );

  server.registerTool(
    'get_payment_status',
    {
      title: 'Read payment status',
      description: 'Read payment state, optionally reconciling against PayPal. Amounts are always compared with the agreed deal.',
      inputSchema: {
        paymentId: z.string().min(1),
        reconcile: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        return ok(await getPaymentStatus(args.paymentId, requireAnyAuth(auth), args.reconcile ?? false));
      } catch (error) {
        return fail(error);
      }
    },
  );

  return server;
}

export const MCP_TOOL_COUNT = MCP_TOOL_CATALOG.length;
