# BhavAI — Hackathon Submission & Readiness Guide

**Verdict:** `CODE READY`  
**To reach `SANDBOX VERIFIED` / `SUBMISSION READY`:** Replace `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in local/Render env with valid PayPal Developer Sandbox REST app credentials, set `PAYPAL_WEBHOOK_ID`, and complete one live Sandbox capture + webhook cycle following [`docs/paypal-sandbox-testing.md`](./paypal-sandbox-testing.md).

---

## 1. Hackathon Submission Checklist

- [x] **Codebase builds & passes all automated gates:** `npm run typecheck`, `npm test` (104 API + 7 Web = 111 passing), `npm run build`, `npm run lint` (0 errors).
- [x] **Official PayPal JS SDK + Orders v2 + Webhook Verification:** Implemented in `PayPalCheckoutButton.tsx`, `apps/api/src/payments/paypal.ts`, `apps/api/src/services/orders.ts`, and `apps/api/src/routes/webhooks.ts`.
- [ ] **Live PayPal Sandbox E2E Transaction Recorded:** Blocked by `401 invalid_client` from `api-m.sandbox.paypal.com/v1/oauth2/token` and unset `PAYPAL_WEBHOOK_ID`.
- [x] **India Domestic Manual Settlement Preserved:** Domestic INR transactions route through the manual settlement path without requiring PayPal.
- [x] **MCP Server Exposed & Protected:** 20 tools at `/mcp` (`tools/list` verified live; protected tools enforce BhavAI API key auth).
- [x] **Seller Pricing Protections:** Floor prices are never leaked in agent responses (`outputIsSafe()` verified by unit tests).
- [x] **AG Grid Seller Analytics:** 3 interactive tabs (Negotiations, Products, Transactions) with keyboard navigation, ARIA labels, and CSV export.
- [x] **Secrets Hygiene:** `.env` is gitignored and untracked; `.env.example` contains placeholders only with `DEMO_MODE=false`.
- [ ] **Optional Gemini AI Mode:** Set `GEMINI_API_KEY` if you want live LLM phrasing instead of deterministic `POLICY` fallback mode.

---

## 2. Sponsor & Technical Capability Report

### PayPal AI Hackathon Integration
- **Architecture:** Server-authoritative PayPal Orders v2 (`createPayPalOrder`, `capturePayPalOrder`, `getPayPalOrder`) paired with official PayPal JS SDK (`https://www.paypal.com/sdk/js`) in `PayPalCheckoutButton.tsx`.
- **Integrity Guards:** Amount and currency are validated server-side; cancelled/failed orders cannot be silently revived by late captures (`REFUND_REQUIRED` flagged instead); webhook signatures are verified via PayPal's verification API; duplicate captures and webhooks are idempotent.
- **Current Limitation:** Live Sandbox OAuth returned `401 invalid_client` for the credentials tested during audit, and `PAYPAL_WEBHOOK_ID` is not yet configured.

### AG Grid Sponsor Eligibility
- **Actual Usage:** `ag-grid-community` (`^36.3.0`) and `ag-grid-react` (`^36.3.0`) power the three analytics tables in `apps/web/src/pages/seller/Analytics.tsx` via `apps/web/src/components/DataGrid.tsx`.
- **Features Verified:** Sorting, filtering, pagination, keyboard cell focus, `ariaLabel` region accessibility, and CSV export (`exportDataAsCsv`).
- **Important Disclosure:** **AG Studio is NOT used** in this repository. Do not claim AG Studio eligibility in submission forms.

### AI Agents & MCP
- **Agent Mode:** `apps/api/src/services/agent.ts` supports Gemini (`GEMINI_API_KEY`) with automatic deterministic `POLICY` fallback. When `GEMINI_API_KEY` is unset, `agentMode()` runs in `POLICY` mode while enforcing `outputIsSafe()` floor-price protections.
- **MCP Endpoint:** `POST /mcp` exposes **20 tools** for catalog discovery, negotiation, order inspection, and seller operations, with API-key authorization on protected tools.

---

## 3. Reproducible End-to-End Demo Script

### Prerequisites
1. Start the local stack: `npm run dev` (API on `http://localhost:4000`, Web on `http://localhost:5173`).
2. Demo accounts (when `DEMO_MODE=true`, password `BhavAI!2026`):
   - **US Buyer:** `alex@bhavai.demo`
   - **India Buyer:** `priya@bhavai.demo`
   - **USD Seller (Aaranya Crafts):** `seller@bhavai.demo`
   - **INR Seller (Meera Textiles):** `meera@bhavai.demo`

### Flow 1 — Cross-Border Negotiation & PayPal Checkout (US Buyer -> USD Seller)
1. Sign in as `alex@bhavai.demo` (`BhavAI!2026`).
2. Open the **Marketplace**, select a product from **Aaranya Crafts** (USD), and start a negotiation.
3. Submit a counter-offer; observe the seller agent negotiate within its hidden floor price rules.
4. Accept/confirm the agreed deal to create an internal order.
5. On the **Negotiation Room** or **Orders** page, click the **PayPal** checkout button (`PayPalCheckoutButton`), approve in the PayPal Sandbox popup (requires valid Sandbox REST credentials), and watch the status poll and transition to **PAID** with transaction IDs persisted.

### Flow 2 — India Domestic Manual Settlement (India Buyer -> INR Seller)
1. Sign in as `priya@bhavai.demo` (`BhavAI!2026`).
2. Negotiate a deal on an INR product from **Meera Textiles**.
3. Confirm the deal and verify it routes through BhavAI's **India Manual Settlement** path rather than PayPal.

### Flow 3 — Seller Analytics (AG Grid) & MCP
1. Sign in as `seller@bhavai.demo` (`BhavAI!2026`).
2. Open **Seller Dashboard** (shows `20 tools at /mcp`) and **Analytics**.
3. Switch across **Negotiations**, **Products**, and **Transactions** AG Grid tabs, test sorting/filtering/keyboard navigation, and click **Export CSV**.

---

## 4. Prioritized Remaining Actions Before Judging

1. **P0 — Update PayPal Sandbox Credentials & Webhook ID:** Generate a fresh Sandbox REST App Client ID + Secret in PayPal Developer Dashboard, register the public webhook URL, set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID`, and record one live Sandbox E2E capture in `docs/paypal-sandbox-testing.md`.
2. **P2 — Set `GEMINI_API_KEY` (Optional):** Enable live Gemini phrasing for buyer/seller agents if desired for the demo.
3. **P2 — Production Deployment Check:** Deploy to Render (`render.yaml`) with `DEMO_MODE=false` (or `true` only if intentional for judge sandbox) and verify `/health`.

