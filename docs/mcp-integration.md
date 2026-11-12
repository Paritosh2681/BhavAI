# BhavAI Model Context Protocol (MCP) Integration Guide

BhavAI implements an official Model Context Protocol (MCP) server adhering to the official `@modelcontextprotocol/sdk`.

External AI buyers (such as OpenAI Agents, Claude Desktop, autonomous procurement bots, or custom LLM scripts) can connect directly to BhavAI to discover products, negotiate within enforceable seller rules, and complete commerce transactions.

---

## 1. Connection Details

- **Protocol:** Model Context Protocol (JSON-RPC 2.0)
- **Transport:** Streamable HTTP
- **Endpoint:** `POST /mcp`
- **Authentication:** `Authorization: Bearer <bvk_api_key>` or `X-BhavAI-Key: <bvk_api_key>`

You can generate API keys directly in the **Developer Console** (`/seller/developer` or `/buyer/settings`).

---

## 2. Tool Catalog

### Buyer-Facing Tools

| Tool | Parameters | Description |
|---|---|---|
| `search_products` | `query`, `category`, `currency`, `country`, `quantity`, `maxTotal`, `pageSize` | Discover products across published storefronts. |
| `get_product_details` | `productId` | Retrieve complete product specifications and public negotiation terms. |
| `start_negotiation` | `productId`, `quantity`, `unitPrice`, `budgetTotal`, `message` | Open an agent negotiation with an initial bid. |
| `get_negotiation` | `negotiationId` | Read offer history, round progression, and active deal status. |
| `advance_negotiation` | `negotiationId` | Trigger the next agent turn (buyer or seller agent). |
| `submit_offer` | `negotiationId`, `unitPrice`, `message` | Submit a human counteroffer. |
| `get_deal_details` | `negotiationId` | Retrieve the agreed pricing and quantity once a deal is struck. |

### Seller-Facing Tools

| Tool | Parameters | Description |
|---|---|---|
| `evaluate_offer` | `productId`, `unitPrice`, `quantity` | Deterministically test an offer against confidential rules without leaking the floor. |
| `generate_counteroffer` | `negotiationId` | Formulate a policy-compliant counteroffer. |
| `check_inventory` | `productId`, `quantity` | Verify inventory availability before accepting. |
| `list_products` | `search`, `status` | List products in the seller's catalog. |
| `get_product_rules` | `productId` | View private rules and floor prices (seller only). |
| `update_product_rules` | `productId`, `rules` | Update pricing policies. |
| `accept_offer` | `negotiationId` | Approve a deal held for seller authorization. |
| `reject_offer` | `negotiationId`, `reason` | Terminate an unviable negotiation. |

### Commerce & Payment Tools

| Tool | Parameters | Description |
|---|---|---|
| `create_payment` | `negotiationId` | Initialize payment rail (PayPal Sandbox for cross-border, manual settlement for India domestic). |
| `get_payment_status` | `paymentId`, `reconcile` | Poll or reconcile payment capture status. |
| `get_order` | `orderId` | Check fulfillment and settlement progress. |
| `list_orders` | `status`, `market`, `pageSize` | List orders for the authenticated account. |

---

## 3. Sample MCP Client Implementation

Run a standalone client to discover tools and initiate a negotiation:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function run() {
  const apiKey = process.env.BHAVAI_KEY || "bvk_sample_buyer_key";
  const endpoint = new URL("http://localhost:4000/mcp");

  const transport = new StreamableHTTPClientTransport(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const client = new Client(
    { name: "bhavai-buyer-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected to BhavAI MCP Server!");

  // 1. Discover available tools
  const tools = await client.listTools();
  console.log("Available tools:", tools.tools.map((t) => t.name));

  // 2. Search for products
  const searchResult = await client.callTool({
    name: "search_products",
    arguments: { query: "diya", currency: "USD" },
  });
  console.log("Search result:", searchResult.content[0].text);
}

run().catch(console.error);
```

