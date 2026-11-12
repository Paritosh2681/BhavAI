# BhavAI Setup & Developer Guide

## Prerequisites

- **Node.js**: `v22.12.0` or higher
- **npm**: `v10.0.0` or higher
- **Git**

No external database installation is required for development. BhavAI includes an embedded zero-dependency PostgreSQL engine powered by `@electric-sql/pglite`.

---

## 1. Quick Start

### 1.1 Clone the Repository
```bash
git clone <repo-url> bhavai
cd bhavai
```

### 1.2 Install Dependencies
```bash
npm install
```

### 1.3 Environment Setup
Copy the template configuration:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Configure your environment variables in `.env`:
- To enable natural language rephrasing: Set `GEMINI_API_KEY`.
- To enable live cross-border transactions: Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).

### 1.4 Seed Demo Accounts & Products
```bash
npm run seed -w @bhavai/api
```
This migrates the embedded database and provisions Aaranya Crafts, demo buyers, and sample negotiation history.
The dev server also runs this automatically when `DEMO_MODE=true`; it is off by default.

### 1.5 Start Development Servers
```bash
npm run dev
```
- Web Application: `http://localhost:5173`
- API & MCP Server: `http://localhost:4000`

---

## 2. Seeded Demo Accounts

All demo accounts share the password: **`BhavAI!2026`**

| Role | Email | Market Context |
|---|---|---|
| **Seller (Aaranya Crafts)** | `seller@bhavai.demo` | India seller, listed in USD |
| **Seller (Meera Textiles)** | `meera@bhavai.demo` | India seller, listed in INR |
| **Buyer (Alex Rivera)** | `alex@bhavai.demo` | US cross-border buyer |
| **Buyer (Priya Nair)** | `priya@bhavai.demo` | India domestic buyer |

---

## 3. Verifying the Build

Run the full verification pipeline (Typecheck + Vitest + Production Bundler):
```bash
npm run verify
```

---

## 4. Production Deployment to Render

1. Connect your repository to [Render](https://render.com).
2. Render detects `render.yaml` automatically, provisioning:
   - `bhavai-api`: Node.js Web Service running `dist/index.js`
   - `bhavai-web`: Static Site serving `apps/web/dist` with rewrites to the API.
3. Configure `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `GEMINI_API_KEY` in the Render Environment Dashboard. Keep `DEMO_MODE=false` so no sample accounts are created.

