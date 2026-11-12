# BhavAI REST API Reference

All requests and responses use JSON. Successful responses wrap payloads under `{ data: ... }`. Errors return `{ error: { code: string, message: string, details?: unknown } }`.

Base URLs:
- Local development: `http://localhost:4000/api`
- Production: `https://<your-render-app>.onrender.com/api`

---

## 1. Authentication (`/api/auth`)

### Register Account
`POST /api/auth/signup`
```json
{
  "name": "Meera Patel",
  "email": "meera@aaranyacrafts.com",
  "password": "Password123!",
  "role": "SELLER",
  "country": "IN"
}
```

### Sign In
`POST /api/auth/login`
```json
{
  "email": "seller@bhavai.demo",
  "password": "BhavAI!2026"
}
```

### Current Session
`GET /api/auth/me`  
Returns authenticated user session, seller profile, and buyer profile.

### Sign Out
`POST /api/auth/logout`

---

## 2. Public Storefronts & Discovery (`/api/public`)

*No authentication required. Floor prices are strictly omitted.*

### Runtime Config
`GET /api/public/config` → `{ "data": { "demoMode": false } }`  
Tells the web app whether demo accounts exist; `DEMO_MODE` defaults to `false`.

### List Public Stores
`GET /api/public/stores`

### Get Store Details
`GET /api/public/stores/:slug`

### List Store Products
`GET /api/public/stores/:slug/products?page=1&pageSize=20`

### Get Product by ID
`GET /api/public/products/:id`

### Search Market (Natural Language Intent / Keyword)
`GET /api/public/market/products?search=brass+diya&category=Home+%26+Decor&currency=USD&inStock=true`

---

## 3. Products Management (`/api/products`)

*Requires Seller Authentication (`Cookie` or `Authorization: Bearer <token>`)*

### List Seller Products
`GET /api/products?search=diya&status=active`

### Create Product
`POST /api/products`
```json
{
  "name": "Handmade Brass Diya",
  "sku": "BD-001",
  "category": "Home & Decor",
  "listedPrice": 12.00,
  "currency": "USD",
  "stock": 100,
  "unit": "piece",
  "countryOfOrigin": "IN",
  "active": true
}
```

### Update Product
`PATCH /api/products/:id`

### Delete / Deactivate Product
`DELETE /api/products/:id`

### Preview CSV Catalog Import
`POST /api/products/import/preview`
Payload: `{ text: "<csv-string>", mapping?: { ... } }`

### Commit CSV Catalog Import
`POST /api/products/import/commit`

---

## 4. Negotiation Rules Engine (`/api/seller/rules`)

*Requires Seller Authentication*

### Get Rules for All Products
`GET /api/seller/rules`

### Upsert Rules for Product
`PUT /api/seller/rules/:productId`
```json
{
  "floorPrice": 9.00,
  "maxDiscountPercent": 25,
  "minimumQuantity": 1,
  "bulkDiscounts": [
    { "minimumQuantity": 20, "discountPercent": 10 },
    { "minimumQuantity": 50, "discountPercent": 20 }
  ],
  "maxRounds": 5,
  "autoAcceptThreshold": 11.00,
  "requireApprovalBelow": 10.00
}
```

---

## 5. Negotiations (`/api/negotiations`)

### Create Negotiation
`POST /api/negotiations` *(Buyer only)*
```json
{
  "productId": "prod_123",
  "quantity": 50,
  "unitPrice": 8.00,
  "budgetTotal": 400.00,
  "message": "Interested in bulk order for corporate gifting."
}
```

### Advance Agent Turn
`POST /api/negotiations/:id/step`  
Triggers the next deterministic agent turn. Alternate between buyer agent and seller agent.

### Submit Counteroffer
`POST /api/negotiations/:id/offers`
```json
{
  "unitPrice": 9.50,
  "quantity": 50,
  "message": "Can you meet at $9.50?"
}
```

### Accept / Approve Deal
`POST /api/negotiations/:id/accept` *(Seller approval for gated deals)*

### Buyer Confirm Deal
`POST /api/negotiations/:id/confirm` *(Required prior to initiating payment)*

### Reject Negotiation
`POST /api/negotiations/:id/reject`
```json
{ "reason": "Price exceeds budget ceiling." }
```

---

## 6. Payments & Settlement (`/api/payments`)

### Create Payment for Confirmed Deal
`POST /api/payments/deals/:dealId`
```json
{ "origin": "http://localhost:5173" }
```
- If cross-border: Initializes PayPal Orders v2 Sandbox order and returns `approvalUrl`.
- If India domestic: Creates an off-platform manual settlement order with `mode: "MANUAL"`.

### Capture PayPal Payment
`POST /api/payments/:paymentId/capture`  
Executes server-side capture against PayPal Sandbox and reconciles deal amount.

### Check Payment Status
`GET /api/payments/:paymentId/status?reconcile=true`

### PayPal Webhook Receiver
`POST /api/webhooks/paypal`  
Validates transmission headers, verifies signature against PayPal, and idempotently records events.

---

## 7. Business Intelligence & Analytics (`/api/dashboard`)

### Analytics Overview
`GET /api/dashboard/analytics`  
Returns sales totals, discount averages, negotiation conversion rate, and 7-day trend history.

