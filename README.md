# BhavAI — Commerce That Speaks AI

> **Your products. Your prices. Your AI-powered salesperson.**  
> Built for the **PayPal AI Hackathon 2026**

**BhavAI** is an **Agent-Ready Commerce Platform** that transforms small business catalogs into structured, machine-readable digital storefronts where autonomous AI buyers can discover products, negotiate prices within seller-defined guardrails, and complete checkout.

Sellers keep absolute control over confidential floor prices, maximum discounts, quantity tiers, and negotiation rounds, while a deterministic backend policy engine validates every single offer and counter-offer 24/7.

---

## 🚀 Live Deployment

| Service | Platform | Live URL |
|---|---|---|
| **Web Application** | Render Static Site (`bhavai-web-k5vd`) | [https://bhavai-web-k5vd.onrender.com](https://bhavai-web-k5vd.onrender.com) |
| **API & MCP Server** | Render Web Service (`bhavai-api-k5vd`) | [https://bhavai-api-k5vd.onrender.com](https://bhavai-api-k5vd.onrender.com) |
| **Health Check** | Same-Origin Rewrite | [https://bhavai-web-k5vd.onrender.com/health](https://bhavai-web-k5vd.onrender.com/health) |
| **Database** | Supabase Managed PostgreSQL | Session Pooler (`001_init.sql` + `002_rls.sql` RLS active) |

---

## 🌟 The Core Innovation: "Make Your Business Transactable by AI"

Modern e-commerce was built for human eyes, mouse clicks, and static cart totals. As autonomous AI agents increasingly represent consumers and enterprise procurement teams, traditional storefronts fail:

1. **Unreadable Catalogs:** Autonomous LLM buyers cannot reliably scrape unstructured HTML, dynamic client scripts, or inconsistent product pages.
2. **Rigid Web Pricing:** Real B2B and wholesale commerce depends on quantity discounts and dynamic deal terms, but web stores only display static list prices.
3. **Hallucination & Prompt Injection Risk:** Giving a generative model direct authority to set financial prices creates catastrophic risk of prompt injection and arbitrary price drops.

### How BhavAI Solves All Three:
- **Agent-Readable Storefronts:** Published catalogs expose semantic JSON endpoints and **20 Model Context Protocol (MCP) tools** over Streamable HTTP (`/mcp`).
- **Deterministic Pricing Authority:** The LLM *never* sets financial terms. An algebraic backend policy engine validates every buyer offer against confidential seller floor prices, max discount caps, bulk volume tiers, and round limits. Gemini (optional) only generates the conversational phrasing around validated mathematical outcomes.
- **Honest Two-Market Settlement:** Cross-border transactions use **PayPal Orders v2** (Sandbox) with server-side order capture, currency/amount mismatch validation, and idempotent webhook reconciliation. Domestic Indian commerce routes to an explicit off-platform manual settlement ledger (`MANUAL`), respecting cross-border regulatory boundaries.

---

## 🎨 Apple-Inspired Design System & Liquid Glass Interface

Grounded in **Apple’s Human Interface Guidelines (HIG)** and tailored for B2B SaaS commerce:
- **Brand Palette:** Mint Green (`#DBE8D8`), Teal Blue (`#01949A`), Soft Ivory (`#F6F8F3`), Deep Forest (`#173C3D`), and Warm Amber (`#D99A55`).
- **Liquid Glass Materials:** Translucent floating navigation, specular edge highlights, and subtle backdrop blurs reserved for active agent state and floating navigation, preserving high readability on solid surfaces for tabular financial records.
- **Ergonomics:** Tabular numerals for prices and percentages, 44px minimum touch targets, and full keyboard accessibility.

---

## 🏗️ Architecture & Monorepo Structure

```text
bhavai/
├── apps/
│   ├── api/                        # Node.js 22 + Express 5 API & MCP Server
│   │   └── src/
│   │       ├── config/             # Zod-validated environment configuration
│   │       ├── db/                 # PostgreSQL (pg) & local embedded PGlite adapter
│   │       ├── mcp/                # Official @modelcontextprotocol/sdk Streamable HTTP server
│   │       ├── middleware/         # Cookie/JWT session auth, API key auth, rate limiting
│   │       ├── payments/           # PayPal Orders v2 REST client & webhook signature verification
│   │       ├── pricing/            # Deterministic negotiation policy engine & unit test suite
│   │       ├── routes/             # Auth, seller, buyer, products, rules, negotiations, orders, webhooks
│   │       └── services/           # Agent orchestration, analytics, CSV export, audit logs
│   └── web/                        # React 19 + Vite + Tailwind CSS v4 + AG Grid
│       └── src/
│           ├── components/         # NegotiationRoom, PayPalCheckoutButton, DataGrid (AG Grid), UI
│           ├── context/            # AuthContext (httpOnly cookie session)
│           ├── layouts/            # AppLayout & PublicLayout
│           └── pages/              # Seller Studio, Buyer Workspace, Live Arena, Docs
├── packages/
│   └── shared/                     # Shared Zod schemas, currency/money formatters, status labels
├── database/
│   └── migrations/
│       ├── 001_init.sql            # Core relational schema (14 tables)
│       └── 002_rls.sql             # Row-Level Security policies for managed Supabase PostgreSQL
├── docs/                           # Architecture, API, MCP, Setup, and PayPal Sandbox guides
├── scripts/
│   └── mcp-client.ts               # Standalone MCP demo client
├── render.yaml                     # Render Blueprint (API + Static Web with same-origin rewrites)
└── bhavai.postman_collection.json  # Importable Postman API collection
```

---

## 🤖 Model Context Protocol (MCP) Integration

BhavAI hosts a native, production-grade MCP server using the official `@modelcontextprotocol/sdk` over **Streamable HTTP**.

```bash
# Run the standalone MCP client demonstration
npm run demo:mcp
```

### 20 Implemented Tools:
- **Buyer Tools:** `search_products`, `get_product_details`, `start_negotiation`, `submit_offer`, `get_negotiation`, `get_deal_details`, `advance_negotiation`.
- **Seller Tools:** `evaluate_offer`, `generate_counteroffer`, `check_inventory`, `accept_offer`, `reject_offer`, `list_products`, `get_product_rules`, `update_product_rules`.
- **Commerce & Settlement Tools:** `create_payment`, `get_payment_status`, `get_order`, `list_orders`.

*Security Boundary:* Confidential seller floor prices and rules are strictly isolated on the backend and are **never** exposed to buyer-facing tools or public JSON endpoints.

---

## 💳 PayPal Orders API v2 & Two-Market Settlement

BhavAI enforces a strict payment state machine:
`CREATED` → `APPROVAL_PENDING` → `APPROVED` → `CAPTURE_PENDING` → `COMPLETED`

1. **Cross-Border Orders (India → Global):**
   - Buyer confirms the agreed deal.
   - Server validates stock and creates a PayPal order with `intent: CAPTURE`.
   - Buyer approves via the official PayPal JavaScript SDK popup.
   - Server executes server-side capture and validates received amount and currency match the deal.
   - PayPal webhook signature verification ensures idempotency.

2. **Domestic Orders (India → India):**
   - Cleanly routed to an off-platform manual settlement workflow (`MANUAL` provider).
   - Marked `SETTLEMENT_PENDING`, transitioning to `SETTLED` once the seller acknowledges receipt.
   - Never simulates fake PayPal completion.

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

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js ≥ 22.12.0
- npm ≥ 10.0.0

*No external database daemon needed — embedded PostgreSQL (PGlite) runs locally out-of-the-box!*

### Setup & Run
```bash
git clone https://github.com/Paritosh2681/BhavAI.git
cd BhavAI
npm install
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
npm run seed -w @bhavai/api     # Migrates schema and provisions demo catalog & users
npm run dev                     # Starts API (:4000) + Web (:5173)
```

- **Web Application:** [http://localhost:5173](http://localhost:5173)
- **API & Health:** [http://localhost:4000/health](http://localhost:4000/health)
- **MCP Endpoint:** `http://localhost:4000/mcp`

---

## 👥 Demo Credentials (Local / `DEMO_MODE=true` Only)

Demo accounts are created by `npm run seed -w @bhavai/api`, or automatically at startup when `DEMO_MODE=true`. Production deployments keep `DEMO_MODE=false`.

Shared Demo Password: **`BhavAI!2026`**

| Persona | Email | Purpose |
|---|---|---|
| **Aaranya Crafts (Seller)** | `seller@bhavai.demo` | Indian artisan brass seller (USD catalog) |
| **Meera Textiles (Seller)** | `meera@bhavai.demo` | Indian artisan seller (INR catalog) |
| **Alex Rivera (Buyer)** | `alex@bhavai.demo` | US buyer (Cross-border PayPal flow) |
| **Priya Nair (Buyer)** | `priya@bhavai.demo` | Indian buyer (Domestic manual settlement) |

---

## 🧪 Verification & Testing

```bash
npm run verify   # Runs typecheck, Vitest suites (@bhavai/api + @bhavai/web), and production builds
npm run lint     # ESLint across all workspaces
npm run demo:mcp # Standalone MCP client demo
```

---

## 📜 License

Licensed under the [MIT License](./LICENSE).

---

**BhavAI — Commerce that speaks AI.**
