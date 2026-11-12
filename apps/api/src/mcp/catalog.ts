import type { McpToolInfo } from '@bhavai/shared';

/**
 * Single source of truth for the public MCP tool catalog. Names and audiences
 * are shown in the developer console and the docs; handlers live in tools.ts.
 */
export const MCP_TOOL_CATALOG: McpToolInfo[] = [
  /* Buyer tools */
  {
    name: 'search_products',
    title: 'Search products in the agent-readable market',
    description: 'Search published BhavAI storefronts by keywords, category, currency, country, quantity and total budget.',
    audience: 'BUYER',
    invocation: 'read-only',
  },
  {
    name: 'get_product_details',
    title: 'Read storefront product details',
    description: 'Return one published product with its seller, stock, bulk tiers and public negotiation terms. Confidential floor prices are never returned.',
    audience: 'BUYER',
    invocation: 'read-only',
  },
  {
    name: 'start_negotiation',
    title: 'Open a negotiation',
    description: 'Open a buyer-agent negotiation for a product and quantity. Every price is validated by the deterministic pricing engine.',
    audience: 'BUYER',
    invocation: 'write',
  },
  {
    name: 'get_negotiation',
    title: 'Read a negotiation',
    description: 'Return the full offer history, deal, order and public policy facts for a negotiation.',
    audience: 'BUYER',
    invocation: 'read-only',
  },
  {
    name: 'get_deal_details',
    title: 'Read deal details',
    description: 'Read the agreed price, quantity, total amount, currency and confirmation status for an accepted negotiation.',
    audience: 'BUYER',
    invocation: 'read-only',
  },
  {
    name: 'advance_negotiation',
    title: 'Advance one agent turn',
    description: 'Ask the next agent (buyer or seller) to move once. Decisions are made by policy, not by the language model.',
    audience: 'BUYER',
    invocation: 'write',
  },
  {
    name: 'submit_offer',
    title: 'Submit a buyer offer',
    description: 'Submit an explicit buyer unit price. The seller agent answers on the next turn or advance call.',
    audience: 'BUYER',
    invocation: 'write',
  },

  /* Seller tools */
  {
    name: 'evaluate_offer',
    title: 'Evaluate an offer against rules',
    description: 'Evaluate an offered price and quantity against seller rules deterministically without exposing private floor prices.',
    audience: 'SELLER',
    invocation: 'read-only',
  },
  {
    name: 'generate_counteroffer',
    title: 'Generate policy counteroffer',
    description: 'Generate the next counteroffer position adhering to target discount and confidential floor constraints.',
    audience: 'SELLER',
    invocation: 'write',
  },
  {
    name: 'check_inventory',
    title: 'Check inventory availability',
    description: 'Check whether sufficient stock is available to satisfy an order quantity.',
    audience: 'SELLER',
    invocation: 'read-only',
  },
  {
    name: 'list_products',
    title: 'List seller products',
    description: 'List your own catalog with stock and status. Requires a seller API key.',
    audience: 'SELLER',
    invocation: 'read-only',
  },
  {
    name: 'get_product_rules',
    title: 'Read confidential pricing rules',
    description: 'Return your own product rules, including floor and minimum allowed prices. Seller API keys only.',
    audience: 'SELLER',
    invocation: 'read-only',
  },
  {
    name: 'update_product_rules',
    title: 'Update pricing rules',
    description: 'Replace the negotiation rules for one of your products. Bounded and validated server-side.',
    audience: 'SELLER',
    invocation: 'write',
  },
  {
    name: 'list_negotiations',
    title: 'List negotiations',
    description: 'List negotiations visible to the authenticated seller or buyer.',
    audience: 'SELLER',
    invocation: 'read-only',
  },
  {
    name: 'accept_offer',
    title: 'Accept or approve deal',
    description: 'Approve a deal held for seller approval. Stock is reserved atomically at approval.',
    audience: 'SELLER',
    invocation: 'write',
  },
  {
    name: 'reject_offer',
    title: 'Reject a negotiation',
    description: 'Close an open negotiation or pending deal with an explicit reason.',
    audience: 'SELLER',
    invocation: 'write',
  },

  /* Commerce tools */
  {
    name: 'list_orders',
    title: 'List orders',
    description: 'List orders visible to the authenticated account, with payment and settlement state.',
    audience: 'COMMERCE',
    invocation: 'read-only',
  },
  {
    name: 'get_order',
    title: 'Read an order',
    description: 'Read one order including its payment record and honest settlement note.',
    audience: 'COMMERCE',
    invocation: 'read-only',
  },
  {
    name: 'create_payment',
    title: 'Create a payment',
    description: 'Create the server-authoritative payment for an agreed, buyer-confirmed deal. Domestic India deals use manual settlement.',
    audience: 'COMMERCE',
    invocation: 'write',
  },
  {
    name: 'get_payment_status',
    title: 'Read payment status',
    description: 'Read payment state, optionally reconciling against PayPal. Amounts are always compared to the deal.',
    audience: 'COMMERCE',
    invocation: 'read-only',
  },
];
