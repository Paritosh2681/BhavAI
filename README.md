# BhavAI — Commerce that speaks AI

> **Your products. Your prices. Your AI-powered salesperson.**  
> Built for the **PayPal AI Hackathon 2026**

BhavAI is an **Agent-Ready Commerce Platform** that transforms conventional small business catalogs into digital storefronts that autonomous AI buyers can discover, negotiate with, and transact through.

Sellers retain absolute control over confidential floor pricing, quantity tiers, discounts, and transaction approval, while their AI salesperson negotiates within deterministic boundaries 24/7.

---

## 🌟 The Core Innovation: "Make Your Business Transactable by AI"

Modern e-commerce was built for human eyes, mouse clicks, and manual checkouts. As AI agents increasingly act on behalf of consumers and enterprises to procure goods, traditional storefronts fail:
1. **Unreadable catalogs:** LLMs struggle to parse unstructured HTML.
2. **Rigid pricing:** Small businesses often negotiate volume discounts, but web stores only offer static list prices.
3. **Hallucination vulnerability:** Giving an LLM direct pricing authority leads to prompt injection and revenue loss.

**BhavAI solves all three:**
- **Agent-Readable Storefronts:** Published via semantic JSON endpoints and official Model Context Protocol (MCP) tools.
- **Deterministic Pricing Authority:** The language model *never* decides financial validity. An algebraic backend engine enforces seller floor rules, bulk discount curves, and round limits.
- **Honest Two-Market Settlement:** Cross-border transactions use **PayPal Orders v2** in Sandbox mode with server-side capture and reconciliation. Indian domestic commerce is routed to an explicit off-platform manual settlement ledger, strictly respecting domestic regulatory boundaries.

---

## 🎨 Apple-Inspired Design System & Liquid Glass Interface

Grounded in **Apple’s Human Interface Guidelines (HIG)** and refined for B2B SaaS commerce:
- **Brand Palette:** Mint Green (`#DBE8D8`), Teal Blue (`#01949A`), Soft Ivory (`#F6F8F3`), Deep Forest (`#173C3D`), and Warm Amber (`#D99A55`).
- **Liquid Glass Materials:** Specular edge highlights, backdrop blurs, and translucent floating controls reserved for active agent state and floating navigation, preserving high readability on solid surfaces for tabular financial records.
- **Ergonomics:** Tabular numerals for prices and percentages, 44px minimum touch targets, and full keyboard accessibility.

---

## 🏗️ Architecture & Monorepo Structure

```text
bhavai/
├── apps/
│   ├── api/                  # Node.js + Express 5 API & MCP Server
│   │   ├── src/
│   │   │   ├── config/       # Strict environment validation (Zod)
│   │   │   ├── db/           # PGlite embedded PostgreSQL & migrations
│   │   │   ├── mcp/          # Model Context Protocol Streamable HTTP Server
│   │   │   ├── payments/     # PayPal Orders API v2 + Webhook verification
│   │   │   ├── pricing/      # Deterministic validation & policy engine
│   │   │   ├── routes/       # Auth, public, seller, buyer, payments
│   │   │   └── services/     # Multi-turn agent orchestration & analytics
│   └── web/                  # React 19 + Vite + Tailwind v4 Web App
│       ├── src/
│       │   ├── components/   # NegotiationRoom, DataGrid (AG Grid), UI
│       │   ├── layouts/      # AppLayout & PublicLayout
│       │   └── pages/        # Seller studio, buyer workspace, live arena
├── packages/
│   └── shared/               # Shared TypeScript schemas, types, formatters
├── docs/                     # Architecture, API, MCP, and Setup guides
├── scripts/                  # Standalone MCP demo client
├── render.yaml               # Render production deployment configuration
└── bhavai.postman_collection.json # Importable API collection
```

---

## ⚡ Quick Start & Local Development

### 1. Prerequisites
- Node.js ≥ 22.12.0
- npm ≥ 10.0.0

*No external database daemon needed — embedded PostgreSQL (PGlite) runs locally out-of-the-box!*

### 2. Installation
```bash
git clone <repo-url> bhavai
cd bhavai
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Optional integrations:
- `GEMINI_API_KEY`: Enables natural language phrasing for agent negotiations.
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`: Enables live PayPal Sandbox payments.

### 4. Database Seed
```bash
npm run seed -w @bhavai/api
```
Migrates the database and provisions demo accounts, catalogs (Aaranya Crafts), and sample negotiation history.

### 5. Start Application
```bash
npm run dev
```
- **Web Application:** [http://localhost:5173](http://localhost:5173)
- **API & Health:** [http://localhost:4000/health](http://localhost:4000/health)
- **MCP Endpoint:** `http://localhost:4000/mcp`

---

## 👥 Demo Credentials

Only created by `npm run seed -w @bhavai/api`, or automatically at startup when `DEMO_MODE=true`. Demo mode is off by default so a deployed instance never ships sample accounts.

Shared Demo Password: **`BhavAI!2026`**

| Persona | Email | Purpose |
|---|---|---|
| **Aaranya Crafts (Seller)** | `seller@bhavai.demo` | Indian artisan brass seller (USD catalog) |
| **Meera Textiles (Seller)** | `meera@bhavai.demo` | Indian artisan seller (INR catalog) |
| **Alex Rivera (Buyer)** | `alex@bhavai.demo` | US buyer (Cross-border PayPal flow) |
| **Priya Nair (Buyer)** | `priya@bhavai.demo` | Indian buyer (Domestic manual settlement) |

---

## 🤖 Model Context Protocol (MCP) Integration

BhavAI hosts a native, production-grade MCP server using the official `@modelcontextprotocol/sdk` over **Streamable HTTP**.

```bash
# Run the standalone MCP client demonstration
npm run demo:mcp
```

### Supported Tools:
- **Buyer Tools:** `search_products`, `get_product_details`, `start_negotiation`, `submit_offer`, `get_negotiation`, `get_deal_details`, `advance_negotiation`.
- **Seller Tools:** `evaluate_offer`, `generate_counteroffer`, `check_inventory`, `accept_offer`, `reject_offer`, `list_products`, `get_product_rules`, `update_product_rules`.
- **Commerce Tools:** `create_payment`, `get_payment_status`, `get_order`, `list_orders`.

*Floor prices are strictly isolated and never returned to buyer-facing tools.*

---

## 💳 PayPal Orders API v2 & Two-Market Settlement

BhavAI enforces a strict payment state machine:
`CREATED` → `APPROVAL_PENDING` → `APPROVED` → `CAPTURE_PENDING` → `COMPLETED`

1. **Cross-Border Orders (India → Global):**
   - Buyer confirms the agreed deal.
   - Server validates stock and creates a PayPal order with `intent: CAPTURE`.
   - Buyer approves via PayPal Sandbox.
   - Server captures payment and verifies amounts against the agreed deal.
   - PayPal webhook signature verification ensures idempotency.

2. **Domestic Orders (India → India):**
   - Clearly routed to an off-platform manual settlement workflow (`MANUAL` provider).
   - Marked `SETTLEMENT_PENDING`, transitioning to `SETTLED` once the seller acknowledges receipt.
   - Never simulates PayPal completion.

---

## 📊 AG Grid Business Intelligence

The Seller Studio features deep operational analytics powered by **AG Grid React**:
- **Negotiation History Table:** Multi-column sorting, filtering, and status grouping.
- **Order Management Table:** Payment rail tracking and settlement state.
- **Product Performance Table:** Conversion rates, average discounts, and stock levels.
- **Real Metrics:** All charts and AI summaries are derived from transactional database records without synthetic placeholders.

---

## 🎬 3-Minute Hackathon Demonstration Script

- **00:00–00:20 (The Problem):** Ordinary storefronts are static websites unreadable by autonomous AI buyers. Small businesses miss out on agentic commerce.
- **00:20–00:40 (Seller Studio):** Aaranya Crafts configures confidential rules for Handmade Brass Diyas ($12 list price, $9 confidential floor, 20% max discount).
- **00:40–01:00 (AI Discovery):** A US buyer asks their AI agent for 50 handmade brass diyas within a $400 budget. The agent discovers Aaranya Crafts via MCP/public API.
- **01:00–01:35 (Negotiation Arena):** Watch the split-screen Negotiation Arena as the Buyer Agent and Seller Agent exchange offers within enforceable policy rules. An agreement is struck at $9.60/unit.
- **01:35–02:10 (PayPal Checkout):** The buyer confirms the deal. The backend generates a PayPal Sandbox checkout order. The buyer approves, and the server captures payment.
- **02:10–02:35 (Order & Analytics):** The seller dashboard updates instantly with AG Grid performance analytics reflecting the confirmed transaction.
- **02:35–03:00 (MCP & Developer Extensibility):** Demonstrate `npm run demo:mcp` showing external AI agents interacting directly with the live server.

---

## 🧪 Verification & Testing

Run full verification:
```bash
npm run verify
```
This runs:
1. TypeScript strict typecheck across `@bhavai/api` and `@bhavai/web`
2. Vitest unit and integration test suites
3. Production builds (`tsup` for Node.js API, `vite` for React)

---

## 📜 License

Licensed under the [MIT License](./LICENSE).

---

**BhavAI — Commerce that speaks AI.**
