# PayPal Sandbox End-to-End Testing Guide

This document describes how to configure, run, and verify **PayPal Sandbox** payments in BhavAI using the official **PayPal JavaScript SDK** and **PayPal Orders v2 REST API**.

> **Security Warning:** Never paste `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, or `PAYPAL_WEBHOOK_ID` into source files, Git commits, logs, or screenshots. Store them only in your local gitignored `.env` or Render environment variables.

---

## 1. Prerequisites

- Node.js `>= 22.12.0` and npm `>= 10.0.0`
- A [PayPal Developer](https://developer.paypal.com/) account
- For webhook delivery testing: a public HTTPS tunnel (e.g., `ngrok` or `cloudflared`) or a deployed Render API URL (`https://<your-api>.onrender.com/api/webhooks/paypal`)

---

## 2. Sandbox Account & App Setup

1. **Sandbox Business Account (Merchant/Receiver):**
   - In the PayPal Developer Dashboard, go to **Sandbox → Accounts** and ensure you have a **Business** account (e.g. `sb-merchant@business.example.com`) in **USD** (or another supported PayPal currency).
2. **Sandbox Personal Account (Buyer/Payer):**
   - Ensure you have a **Personal** account (e.g. `sb-buyer@personal.example.com`) with a positive USD balance to approve checkouts.
3. **Sandbox REST Application:**
   - Go to **Apps & Credentials → Sandbox → Create App**.
   - Select your **Sandbox Business** account as the merchant.
   - Copy the **Client ID** and **Secret** from the **Sandbox** tab (not Live).
4. **Configure Local `.env`:**
   ```env
   PAYPAL_CLIENT_ID=<your-sandbox-client-id>
   PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>
   PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
   PAYPAL_WEBHOOK_ID=<your-sandbox-webhook-id>
   DEMO_MODE=true
   ```

---

## 3. Webhook Registration (Sandbox)

1. Expose your local API over HTTPS (e.g., `ngrok http 4000`) or use your deployed Render URL.
2. In your PayPal Sandbox App settings, scroll to **Webhooks → Add Webhook**.
3. Set the **Webhook URL** to:
   ```text
   https://<your-public-host>/api/webhooks/paypal
   ```
4. Subscribe **only** to the events handled by `apps/api/src/services/orders.ts`:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
5. Save the webhook and copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID` in `.env`.

---

## 4. Local & Public Verification Steps

### Step A: Verify Sandbox OAuth Connectivity
1. Start the application:
   ```bash
   npm run seed -w @bhavai/api
   npm run dev
   ```
2. Check `/health`:
   ```bash
   curl http://localhost:4000/health
   ```
   Confirm `integrations.paypal.configured` is `true` and `environment` is `"sandbox"`.
3. Sign in to the web app (`http://localhost:5173/login`) as `seller@bhavai.demo` (password `BhavAI!2026`), open **Developer Console** (`/seller/developer`), and click **Test PayPal OAuth** (`POST /api/developer/test/paypal`).
   - Expected response: `200 OK` with `{ "ok": true, "environment": "sandbox" }`.

### Step B: Buyer Checkout Flow (PayPal JS SDK)
1. Sign in as the US buyer (`alex@bhavai.demo` / `BhavAI!2026`).
2. Go to **Discover** (`/buyer/discover`) or **Agent Arena** (`/buyer/arena`) and select a **USD** product from **Aaranya Crafts** (cross-border).
3. Negotiate until status reaches `AGREED` (or seller approves if `AWAITING_APPROVAL`).
4. Open the negotiation room (`/buyer/deals/:id`) and click **Confirm deal** (`POST /api/negotiations/:id/confirm`).
5. The **PayPal Sandbox Checkout** section renders the official **PayPal JavaScript SDK** button (`PayPalCheckoutButton`).
6. Click **PayPal**:
   - Frontend calls `POST /api/payments/deals/:negotiationId` → backend creates internal `order` + `payment` (`CREATED` → `APPROVAL_PENDING`) and calls `POST /v2/checkout/orders` (`intent: "CAPTURE"`).
   - PayPal Sandbox popup opens.
7. Sign in with your **Sandbox Personal** buyer account and click **Complete Purchase / Pay Now**.
8. PayPal returns approval to `onApprove` in the frontend:
   - Frontend calls `POST /api/payments/:id/capture`.
   - Backend calls `POST /v2/checkout/orders/:paypalOrderId/capture`, validates `status === 'COMPLETED'`, verifies `amount.value` and `amount.currency_code` match the local payment record, persists the capture ID & full capture JSON in `payments.payload`, and marks `orders.status = 'PAID'`, `payments.status = 'COMPLETED'`, and `deals.status = 'CONSUMED'`.

### Step C: Webhook Delivery & Reconciliation
1. When PayPal sends `PAYMENT.CAPTURE.COMPLETED` to `POST /api/webhooks/paypal`:
   - Backend preserves the raw request body (`express.raw`) and verifies the signature via `POST /v1/notifications/verify-webhook-signature` using `PAYPAL_WEBHOOK_ID`.
   - Inserts into `webhook_events` with `UNIQUE (provider, provider_event_id)` for idempotency.
   - Re-checks amount/currency and reconciles `payments` / `orders`.
2. Open the **Seller Orders** (`/seller/orders`) and **Seller Analytics** (`/seller/analytics`) pages:
   - The new order appears with `PAID` status, PayPal Order ID, and PayPal Capture ID.
   - Recorded revenue and AG Grid **Transactions** table reflect the paid order.

---

## 5. Expected Database State Transitions

| Stage | `deals.status` | `orders.status` | `orders.payment_state` | `payments.status` |
|---|---|---|---|---|
| Deal agreed | `ACCEPTED` | *(none)* | *(none)* | *(none)* |
| Order & PayPal order created | `ACCEPTED` | `APPROVAL_PENDING` | `APPROVAL_PENDING` | `APPROVAL_PENDING` |
| `CHECKOUT.ORDER.APPROVED` webhook | `ACCEPTED` | `APPROVAL_PENDING` | `APPROVED` | `APPROVED` |
| Server-side capture succeeds | `CONSUMED` | `PAID` | `COMPLETED` | `COMPLETED` |
| Buyer cancels / `onCancel` | `ACCEPTED` | `APPROVAL_PENDING` | `APPROVAL_PENDING` | `APPROVAL_PENDING` |
| Explicit order cancel | `CANCELLED` | `CANCELLED` | `CANCELLED` | `CANCELLED` |
| Capture arrives after cancel | `ACCEPTED` | `CANCELLED` | `CANCELLED` | `COMPLETED` *(+ `payment.refund_required` audit)* |
| `PAYMENT.CAPTURE.REFUNDED` webhook | `CANCELLED` | `CANCELLED` | `CANCELLED` | `CANCELLED` *(+ `payment.refunded` audit)* |

---

## 6. Troubleshooting

- **`401 invalid_client` / `Client Authentication failed`**:
  - Verify you copied the **Sandbox** Client ID & Secret (not Live), with no leading/trailing spaces, and that the REST app is active in the PayPal Developer Dashboard.
- **PayPal button does not render**:
  - Check `/api/public/config` returns `paypal.configured: true` and a valid `clientId`, and ensure browser extensions / adblockers are not blocking `https://www.paypal.com/sdk/js`.
- **Webhook signature verification fails (`400`)**:
  - Confirm `PAYPAL_WEBHOOK_ID` matches the exact webhook registered for that public URL and `express.raw` is active on `/api/webhooks/paypal`.

---

## 7. Sandbox Verification Log (Current Session)

| Check | Result | Notes |
|---|---|---|
| Local `.env` root loading (`env.ts`) | **Fixed & Verified** | `GET /health` reports `paypal.configured: true`, `environment: "sandbox"`. |
| Sandbox OAuth (`POST /v1/oauth2/token`) | **PASSED (`200 OK`)** | `api-m.sandbox.paypal.com` issued a Bearer token (`expires_in: 32400`, 28 scopes); `POST /api/developer/test/paypal` returned `200 ok: true`. |
| End-to-End Sandbox Checkout & Capture | **PASSED (Live Sandbox)** | Order `f079c179-51ac-40ff-b38d-2d63605fee90`, Payment `5bae3a69-1c62-4669-a09f-d0e178d4848e`, PayPal Order `28177810G47001904`, PayPal Capture `7RL41742VJ0209603`, `57.50 USD`, Status `PAID` / `COMPLETED`. |
| Seller Dashboard & AG Grid Analytics | **PASSED (API Verified)** | `GET /api/orders` and `GET /api/dashboard/analytics` return order `f079c179-51ac-40ff-b38d-2d63605fee90` (`externalOrderId: 28177810G47001904`, `PAID`, `COMPLETED`, `$57.50 USD`, `isSample: false`). |
| Live Webhook Delivery | **PASSED (Sandbox Signed)** | Registered webhook `767458673P909210C` (`https://demonstrated-careers-surprised-tables.trycloudflare.com/api/webhooks/paypal`) for `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`. Unsigned test rejected (`400 BAD_REQUEST`); PayPal Sandbox `simulate-event` (`CHECKOUT.ORDER.APPROVED`, event `WH-COC11055RA711503B-4YM959094A144403T`) delivered over HTTPS, passed `verifyPayPalWebhook`, and returned `200 OK`. |

