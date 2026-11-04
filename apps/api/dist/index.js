import {
  AppError,
  BuyerIntentInput,
  BuyerProfileInput,
  CATEGORIES,
  COUNTRIES,
  LoginInput,
  NegotiationCreateInput,
  OfferInput,
  ProductInput,
  RulesInput,
  SellerProfileInput,
  SignupInput,
  analyticsNarrative,
  apiKey,
  approveDeal,
  assertRulesConsistent,
  audit,
  badRequest,
  cancelNegotiation,
  closeDb,
  confirmDeal,
  conflict,
  createNegotiation,
  createProduct,
  deleteProduct,
  emailSchema,
  env,
  forbidden,
  formatMoney,
  geminiPing,
  getDb,
  getNegotiationDetail,
  getNegotiationForPayment,
  getPublicProduct,
  getPublicStore,
  getRulesForProduct,
  getSellerProduct,
  hashPassword,
  integrationSnapshot,
  listNegotiations,
  listPublicStoreProducts,
  listPublicStores,
  listRules,
  listSellerProducts,
  logger,
  mapProduct,
  mapRules,
  minimumAllowedPrice,
  money,
  newId,
  notFound,
  parseIntent,
  parseWith,
  passwordSchema,
  pathParam,
  policyFromRules,
  randomToken,
  rejectNegotiation,
  roundMoney,
  runNegotiationStep,
  searchMarket,
  sha256,
  slugify,
  submitBuyerOffer,
  targetPrice,
  toBool,
  toIso,
  toNumber,
  unauthorized,
  updateProduct,
  upsertRules,
  validateOffer,
  verifyPassword
} from "./chunk-IQWLNGBE.js";

// src/index.ts
import "dotenv/config";
import fs2 from "fs";
import path2 from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// src/db/migrate.ts
import fs from "fs";
import path from "path";
async function migrate() {
  const db = await getDb();
  const files = ["001_init.sql"];
  if (process.env.APPLY_RLS === "true") files.push("002_rls.sql");
  for (const file of files) {
    const full = path.join(env.migrationsDir, file);
    if (!fs.existsSync(full)) {
      throw new Error(`Migration file not found: ${full}`);
    }
    const sql = fs.readFileSync(full, "utf8");
    await db.exec(sql);
    logger.info("migration_applied", { file });
  }
  await ensureColumn("negotiations", "is_sample", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("offers", "explanation", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("deals", "is_sample", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("orders", "is_sample", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("sellers", "onboarding_complete", "BOOLEAN NOT NULL DEFAULT FALSE");
}
async function ensureColumn(table, column, definition) {
  const db = await getDb();
  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  if (cols.length === 0) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    logger.info("migration_column_added", { table, column });
  }
}

// src/db/seed.ts
var DEMO_PASSWORD = "BhavAI!2026";
var SELLER_EMAIL = "seller@bhavai.demo";
var BUYER_US_EMAIL = "alex@bhavai.demo";
var BUYER_IN_EMAIL = "priya@bhavai.demo";
var MEERA_EMAIL = "meera@bhavai.demo";
async function seedDemoData() {
  const db = await getDb();
  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [SELLER_EMAIL]);
  if (existing[0]) return { seeded: false, reason: "Demo accounts already exist." };
  const now = Date.now();
  const day = 864e5;
  const at = (daysAgo, hour = 11) => {
    const d = new Date(now - daysAgo * day);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const sellerUser = newId();
  const sellerId = newId();
  const alexUser = newId();
  const alexBuyer = newId();
  const priyaUser = newId();
  const priyaBuyer = newId();
  const meeraUser = newId();
  const meeraSeller = newId();
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const aaranyaProducts = [
    {
      id: newId(),
      name: "Hand-cast Brass Diya",
      description: "A small oil lamp cast by hand in Moradabad, with a warm antiqued finish. Each piece is slightly different. Sold individually; wick not included.",
      sku: "DIYA-001",
      category: "Home & Decor",
      price: 12,
      stock: 120,
      unit: "piece",
      rule: {
        floor: 9.6,
        maxDiscount: 20,
        minQty: 5,
        bulk: [
          { minimumQuantity: 20, discountPercent: 5 },
          { minimumQuantity: 50, discountPercent: 10 }
        ],
        maxRounds: 5,
        autoAccept: 11.4,
        approvalBelow: 10.2,
        approvalRequired: false
      }
    },
    {
      id: newId(),
      name: "Brass Incense Holder",
      description: "A minimal, weighted brass holder for incense sticks with a removable ash tray. Cast and finished by the same workshop as our diyas.",
      sku: "INC-002",
      category: "Home & Decor",
      price: 18,
      stock: 80,
      unit: "piece",
      rule: {
        floor: 14,
        maxDiscount: 18,
        minQty: 4,
        bulk: [{ minimumQuantity: 24, discountPercent: 8 }],
        maxRounds: 4,
        autoAccept: 16.5,
        approvalBelow: 15,
        approvalRequired: false
      }
    },
    {
      id: newId(),
      name: "Hammered Brass Bowl",
      description: "A medium serving bowl with a hand-hammered surface and food-safe lacquer. Suitable for dry snacks and display. Diameter 18 cm.",
      sku: "BOWL-003",
      category: "Kitchen & Dining",
      price: 24,
      stock: 60,
      unit: "piece",
      rule: {
        floor: 19,
        maxDiscount: 20,
        minQty: 4,
        bulk: [{ minimumQuantity: 20, discountPercent: 10 }],
        maxRounds: 5,
        autoAccept: 21.5,
        approvalBelow: null,
        approvalRequired: false
      }
    },
    {
      id: newId(),
      name: "Amber Glass Lantern",
      description: "A mouth-blown amber glass lantern with a brass frame. Designed for tea lights and warm evening light. Ships in recycled protective packaging.",
      sku: "LANT-004",
      category: "Home & Decor",
      price: 35,
      stock: 40,
      unit: "piece",
      rule: {
        floor: 28,
        maxDiscount: 18,
        minQty: 2,
        bulk: [{ minimumQuantity: 12, discountPercent: 7 }],
        maxRounds: 5,
        autoAccept: 32,
        approvalBelow: 29.5,
        approvalRequired: true
      }
    }
  ];
  const meeraProducts = [
    {
      id: newId(),
      name: "Handwoven Cotton Stole",
      description: "A light cotton stole woven on a pit loom in Kutch, with a natural-dye border. Breathable, reversible and finished by hand.",
      sku: "STOLE-101",
      category: "Textiles",
      price: 1450,
      stock: 50,
      unit: "piece",
      rule: {
        floor: 1150,
        maxDiscount: 20,
        minQty: 5,
        bulk: [{ minimumQuantity: 12, discountPercent: 8 }],
        maxRounds: 4,
        autoAccept: 1320,
        approvalBelow: 1220,
        approvalRequired: false
      }
    },
    {
      id: newId(),
      name: "Block-print Table Runner",
      description: "A cotton table runner block-printed by hand with a repeating indigo motif. 180 \xD7 35 cm. Machine washable on a gentle cycle.",
      sku: "RUN-102",
      category: "Home & Decor",
      price: 980,
      stock: 35,
      unit: "piece",
      rule: {
        floor: 780,
        maxDiscount: 20,
        minQty: 4,
        bulk: [{ minimumQuantity: 15, discountPercent: 10 }],
        maxRounds: 4,
        autoAccept: 900,
        approvalBelow: null,
        approvalRequired: false
      }
    },
    {
      id: newId(),
      name: "Indigo Cushion Cover Set",
      description: "A set of two indigo cushion covers in handloom cotton, with concealed zips. Covers only; inserts not included. 45 \xD7 45 cm.",
      sku: "CUSH-103",
      category: "Home & Decor",
      price: 1250,
      stock: 60,
      unit: "set",
      rule: {
        floor: 990,
        maxDiscount: 20,
        minQty: 3,
        bulk: [{ minimumQuantity: 10, discountPercent: 12 }],
        maxRounds: 5,
        autoAccept: 1150,
        approvalBelow: null,
        approvalRequired: false
      }
    }
  ];
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO users (id, email, password_hash, name, role, country, currency, created_at)
       VALUES ($1,$2,$3,$4,'SELLER','IN','USD',$5), ($6,$7,$8,$9,'BUYER','US','USD',$10),
              ($11,$12,$13,$14,'BUYER','IN','INR',$15), ($16,$17,$18,$19,'SELLER','IN','INR',$20)`,
      [
        sellerUser,
        SELLER_EMAIL,
        passwordHash,
        "Aaranya Crafts",
        at(40),
        alexUser,
        BUYER_US_EMAIL,
        passwordHash,
        "Alex Rivera",
        at(30),
        priyaUser,
        BUYER_IN_EMAIL,
        passwordHash,
        "Priya Nair",
        at(28),
        meeraUser,
        MEERA_EMAIL,
        passwordHash,
        "Meera Textiles",
        at(38)
      ]
    );
    await tx.query(
      `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, description, active, onboarding_complete, rules_confirmed, created_at, updated_at)
       VALUES ($1,$2,'Aaranya Crafts','IN','USD','aaranya-crafts',
               'Small-batch brass and glass objects made with a family workshop in Moradabad. We ship worldwide from Jaipur and negotiate fairly on volume orders.',TRUE,TRUE,TRUE,$3,$3),
              ($4,$5,'Meera Textiles','IN','INR','meera-textiles',
               'Handloom textiles from Kutch and Jaipur. Direct relationships with weaving families, natural dyes and small production runs. Domestic orders settle directly.',TRUE,TRUE,TRUE,$6,$6)`,
      [sellerId, sellerUser, at(39), meeraSeller, meeraUser, at(37)]
    );
    await tx.query(
      `INSERT INTO buyers (id, user_id, company_name, country, currency, preferences, created_at)
       VALUES ($1,$2,'Rivera Studio','US','USD','Boutique retail buyer focused on handmade homeware. Prefers consolidated volume orders.',$3),
              ($4,$5,'Nair Home','IN','INR','Independent homeware store in Bengaluru. Domestic settlement by bank transfer.',$6)`,
      [alexBuyer, alexUser, at(29), priyaBuyer, priyaUser, at(27)]
    );
    for (const product of [...aaranyaProducts, ...meeraProducts]) {
      const seller = aaranyaProducts.includes(product) ? sellerId : meeraSeller;
      await tx.query(
        `INSERT INTO products (id, seller_id, name, description, sku, category, images, listed_price, currency, stock, unit, country_of_origin, active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,$7,$8,$9,$10,'IN',TRUE,$11,$11)`,
        [
          product.id,
          seller,
          product.name,
          product.description,
          product.sku,
          product.category,
          product.price,
          aaranyaProducts.includes(product) ? "USD" : "INR",
          product.stock,
          product.unit,
          at(35)
        ]
      );
      await tx.query(
        `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
        [
          newId(),
          seller,
          product.id,
          product.rule.floor,
          product.rule.maxDiscount,
          product.rule.minQty,
          JSON.stringify(product.rule.bulk),
          product.rule.maxRounds,
          product.rule.autoAccept,
          product.rule.approvalBelow,
          product.rule.approvalRequired,
          at(34)
        ]
      );
    }
    const diya = aaranyaProducts[0];
    const lantern = aaranyaProducts[3];
    const stole = meeraProducts[0];
    const runner = meeraProducts[1];
    const neg1 = newId();
    const deal1 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'AGREED',20,'USD',12,210,'CROSS_BORDER',3,5,'POLICY','BUYER_AGENT',TRUE,$5,$6,$7)`,
      [neg1, alexBuyer, sellerId, diya.id, at(2), at(6), at(3)]
    );
    const offers1 = [
      [newId(), neg1, "BUYER_AGENT", 9.4, 188, "Offering 9.40 per unit for 20 units.", "Opens at 9.40 per unit, inside the buyer\u2019s budget ceiling of 10.50.", "OFFER", at(6)],
      [newId(), neg1, "SELLER_AGENT", 11.4, 228, "Countering at 11.40 per unit.", "The seller holds at 11.40 per unit for 20 units. A 5% tier applies at 20+ units.", "OFFER", at(5)],
      [newId(), neg1, "BUYER_AGENT", 10.4, 208, "Offering 10.40 per unit for 20 units.", "Raises the offer to 10.40 per unit while staying inside the buyer\u2019s budget.", "OFFER", at(4)],
      [newId(), neg1, "SELLER_AGENT", 11, 220, "Accepted at 11.00 per unit.", "The offer clears the seller\u2019s pre-approved auto-accept price.", "ACCEPTANCE", at(3)]
    ];
    for (let i = 0; i < offers1.length; i += 1) {
      const [oid, nid, actor, unit, total, message, explanation, kind, when] = offers1[i];
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
         VALUES ($1,$2,$3,'POLICY',$4,$5,20,'VALID',$6,$7,$8,$9,$10)`,
        [oid, nid, actor, unit, total, kind, message, explanation, i < 2 ? 1 : i, when]
      );
    }
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at, buyer_confirmed_at, created_at)
       VALUES ($1,$2,11,20,220,'USD','ACCEPTED','CROSS_BORDER',TRUE,$3,$3,$3)`,
      [deal1, neg1, at(3)]
    );
    const neg2 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'OPEN',6,'USD',35,190,'CROSS_BORDER',1,5,'POLICY','SELLER_AGENT',TRUE,$5,$6,$7)`,
      [neg2, alexBuyer, sellerId, lantern.id, at(-2), at(1), at(0)]
    );
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
       VALUES ($1,$2,'BUYER_AGENT','POLICY',27.3,163.8,6,'VALID','OFFER','Offering 27.30 per unit for 6 units.','Opens at 27.30 per unit, inside the buyer\u2019s budget ceiling of 31.67.',1,$3),
              ($4,$2,'SELLER_AGENT','POLICY',32.55,195.3,6,'VALID','OFFER','Countering at 32.55 per unit.','The seller holds at 32.55 per unit for 6 units.',1,$5)`,
      [newId(), neg2, at(1), newId(), at(0)]
    );
    const neg3 = newId();
    const deal3 = newId();
    const order3 = newId();
    const payment3 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'AGREED',12,'INR',1450,15600,'DOMESTIC',2,4,'POLICY','BUYER_AGENT',TRUE,$5,$6,$7)`,
      [neg3, priyaBuyer, meeraSeller, stole.id, at(-3), at(8), at(6)]
    );
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
       VALUES ($1,$2,'BUYER_AGENT','POLICY',1160,13920,12,'VALID','OFFER','Offering \u20B91,160.00 per unit for 12 units.','Opens at 1,160.00 per unit, inside the buyer\u2019s budget ceiling of 1,300.00.',1,$3),
              ($4,$2,'SELLER_AGENT','POLICY',1334,16008,12,'VALID','OFFER','Countering at \u20B91,334.00 per unit.','The seller holds at 1,334.00 per unit for 12 units. An 8% tier applies at 12+ units.',2,$5),
              ($6,$2,'BUYER_AGENT','POLICY',1250,15000,12,'VALID','ACCEPTANCE','Accepted at \u20B91,250.00 per unit.','The counter at 1,250.00 per unit fits the buyer\u2019s budget.',2,$7)`,
      [newId(), neg3, at(8), newId(), at(7), newId(), at(6)]
    );
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at, buyer_confirmed_at, created_at)
       VALUES ($1,$2,1250,12,15000,'INR','CONSUMED','DOMESTIC',TRUE,$3,$3,$3)`,
      [deal3, neg3, at(6)]
    );
    await tx.query(
      `INSERT INTO orders (id, deal_id, seller_id, buyer_id, payment_provider, external_order_id, market_type, status, payment_state,
        total_amount, currency, settlement_note, is_sample, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'MANUAL',NULL,'DOMESTIC','SETTLEMENT_PENDING','CREATED',15000,'INR',
        'Sample order. India domestic settlement is agreed off-platform; BhavAI has not received or verified funds.',TRUE,$5,$5)`,
      [order3, deal3, meeraSeller, priyaBuyer, at(6)]
    );
    await tx.query(
      `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_capture_id, amount, currency, status, approval_url, payload, created_at, updated_at)
       VALUES ($1,$2,'MANUAL',NULL,NULL,15000,'INR','CREATED',NULL,'{"mode":"manual_off_platform","sample":true}'::jsonb,$3,$3)`,
      [payment3, order3, at(6)]
    );
    const neg4 = newId();
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'OPEN',6,'INR',980,5400,'DOMESTIC',1,4,'POLICY','SELLER_AGENT',TRUE,$5,$6,$7)`,
      [neg4, priyaBuyer, meeraSeller, runner.id, at(4), at(2), at(1)]
    );
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
       VALUES ($1,$2,'BUYER_AGENT','POLICY',790,4740,6,'VALID','OFFER','Offering \u20B9790.00 per unit for 6 units.','Opens at 790.00 per unit, inside the buyer\u2019s budget ceiling of 900.00.',1,$3)`,
      [newId(), neg4, at(2)]
    );
  });
  logger.info("demo_seeded", {
    sellers: ["aaranya-crafts", "meera-textiles"],
    accounts: [SELLER_EMAIL, BUYER_US_EMAIL, BUYER_IN_EMAIL, MEERA_EMAIL]
  });
  return { seeded: true };
}

// src/middleware/error.ts
import { ZodError } from "zod";
function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.originalUrl}`, requestId: req.requestId }
  });
}
function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) {
    if (error.status >= 500) logger.error("request_failed", { requestId: req.requestId, code: error.code, message: error.message });
    else logger.info("request_rejected", { requestId: req.requestId, code: error.code, message: error.message });
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details, requestId: req.requestId }
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        details: { fields: Object.fromEntries(error.issues.map((i) => [i.path.join(".") || "_", i.message])) },
        requestId: req.requestId
      }
    });
    return;
  }
  const anyError = error;
  if (anyError?.type === "entity.too.large") {
    res.status(413).json({
      error: { code: "PAYLOAD_TOO_LARGE", message: "That file or request is too large.", requestId: req.requestId }
    });
    return;
  }
  logger.error("unhandled_error", {
    requestId: req.requestId,
    message: anyError?.message,
    stack: process.env.NODE_ENV === "production" ? void 0 : error?.stack
  });
  res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong on our side. Try again.", requestId: req.requestId }
  });
}
function requestId(req, res, next) {
  req.requestId = String(req.headers["x-request-id"] || crypto.randomUUID());
  res.setHeader("x-request-id", req.requestId);
  next();
}
function requestLogger(req, res, next) {
  const start2 = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start2;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs: duration
    });
  });
  next();
}

// src/routes/auth.ts
import { Router } from "express";
import { z } from "zod";

// src/utils/jwt.ts
import { SignJWT, jwtVerify } from "jose";
var secret = new TextEncoder().encode(env.jwtSecret);
var ISSUER = "bhavai";
var AUDIENCE = "bhavai-web";
async function signSession(claims) {
  return new SignJWT({ role: claims.role, email: claims.email }).setProtectedHeader({ alg: "HS256" }).setSubject(claims.sub).setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().setExpirationTime("7d").sign(secret);
}
async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub || typeof payload.role !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, role: payload.role, email: payload.email };
  } catch {
    return null;
  }
}
var SESSION_COOKIE = "bhavai_session";

// src/middleware/auth.ts
function mapUser(row) {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role,
    country: String(row.country ?? "IN"),
    currency: String(row.currency ?? "INR")
  };
}
function mapSeller(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    businessName: String(row.business_name),
    country: String(row.country),
    currency: String(row.currency),
    storeSlug: String(row.store_slug),
    description: String(row.description ?? ""),
    active: row.active === true,
    onboardingComplete: row.onboarding_complete === true
  };
}
function mapBuyer(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyName: String(row.company_name ?? ""),
    country: String(row.country),
    currency: String(row.currency),
    preferences: String(row.preferences ?? "")
  };
}
async function loadAuthContext(userId, source, apiKeyId) {
  const db = await getDb();
  const users = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!users[0]) return null;
  const user = mapUser(users[0]);
  let seller = null;
  let buyer = null;
  if (user.role === "SELLER" || user.role === "ADMIN") {
    const rows = await db.query(`SELECT * FROM sellers WHERE user_id = $1`, [userId]);
    if (rows[0]) seller = mapSeller(rows[0]);
  }
  if (user.role === "BUYER" || user.role === "ADMIN") {
    const rows = await db.query(`SELECT * FROM buyers WHERE user_id = $1`, [userId]);
    if (rows[0]) buyer = mapBuyer(rows[0]);
  }
  return { user, seller, buyer, source, apiKeyId };
}
async function loadApiKey(secret2) {
  const db = await getDb();
  const hash = sha256(secret2);
  const rows = await db.query(
    `SELECT k.id AS key_id, k.user_id FROM api_keys k WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
    [hash]
  );
  if (!rows[0]) return null;
  const ctx = await loadAuthContext(String(rows[0].user_id), "api_key", String(rows[0].key_id));
  if (ctx) {
    void db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].key_id]).catch(() => void 0);
  }
  return ctx;
}
async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      if (token.startsWith("bvk_")) {
        req.auth = await loadApiKey(token) ?? void 0;
      } else {
        const claims = await verifySession(token);
        if (claims) {
          req.auth = await loadAuthContext(claims.sub, "session") ?? void 0;
        }
      }
    }
    if (!req.auth) {
      const cookieToken = req.cookies?.[SESSION_COOKIE];
      if (cookieToken) {
        const claims = await verifySession(cookieToken);
        if (claims) req.auth = await loadAuthContext(claims.sub, "session") ?? void 0;
      }
    }
    next();
  } catch (error) {
    logger.warn("auth_middleware_error", { message: error.message });
    next();
  }
}
function requireAuth(req) {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
function requireRole(req, ...roles) {
  const auth = requireAuth(req);
  if (!roles.includes(auth.user.role)) {
    throw unauthorized("This account does not have access to that area.");
  }
  return auth;
}
function requireSeller(req) {
  const auth = requireRole(req, "SELLER", "ADMIN");
  if (!auth.seller) throw unauthorized("Complete seller onboarding first.");
  return auth;
}
function requireBuyer(req) {
  const auth = requireRole(req, "BUYER", "ADMIN");
  if (!auth.buyer) throw unauthorized("Complete buyer onboarding first.");
  return auth;
}

// src/middleware/rateLimit.ts
import { rateLimit } from "express-rate-limit";
var json = (message) => ({
  error: { code: "RATE_LIMITED", message, requestId: "" }
});
var authLimiter = rateLimit({
  windowMs: 10 * 60 * 1e3,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: json("Too many sign-in attempts. Wait a few minutes and try again."),
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many sign-in attempts. Wait a few minutes and try again.",
        requestId: req.requestId
      }
    });
  }
});
var writeLimiter = rateLimit({
  windowMs: 60 * 1e3,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "You are moving faster than the API allows. Try again in a minute.",
        requestId: req.requestId
      }
    });
  }
});
var publicLimiter = rateLimit({
  windowMs: 60 * 1e3,
  limit: 240,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Try again shortly.",
        requestId: req.requestId
      }
    });
  }
});
var buckets = /* @__PURE__ */ new Map();
function mcpRateLimit(key, limit = 60, windowMs = 6e4) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// src/routes/auth.ts
var authRouter = Router();
var ForgotInput = z.object({ email: emailSchema });
var ResetInput = z.object({ token: z.string().min(10), password: passwordSchema });
var ProfileUpdate = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  country: z.string().length(2).optional(),
  currency: z.enum(["USD", "INR", "EUR", "GBP", "AED"]).optional()
});
function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1e3,
    path: "/"
  });
}
function currencyForCountry(code) {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "USD";
}
async function issueSession(user, res) {
  const token = await signSession({ sub: user.id, email: user.email, role: user.role });
  setSessionCookie(res, token);
}
async function uniqueSlug(base, excludeSellerId) {
  const db = await getDb();
  const root = slugify(base) || "store";
  let candidate = root;
  for (let i = 0; i < 40; i += 1) {
    const rows = excludeSellerId ? await db.query(`SELECT id FROM sellers WHERE store_slug = $1 AND id <> $2`, [candidate, excludeSellerId]) : await db.query(`SELECT id FROM sellers WHERE store_slug = $1`, [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}
authRouter.post("/signup", authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(SignupInput, req.body);
    const db = await getDb();
    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [input.email]);
    if (existing.length > 0) throw conflict("An account with that email already exists. Try signing in.");
    const country = input.country.toUpperCase();
    const currency = currencyForCountry(country);
    const userId = newId();
    const createdAt = /* @__PURE__ */ new Date();
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, password_hash, name, role, country, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, input.email, hashPassword(input.password), input.name, input.role, country, currency, createdAt]
      );
      if (input.role === "SELLER") {
        const slug = await uniqueSlug(input.name);
        await tx.query(
          `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, description, active, onboarding_complete)
           VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE)`,
          [newId(), userId, input.name, country, currency, slug, ""]
        );
      } else {
        await tx.query(
          `INSERT INTO buyers (id, user_id, company_name, country, currency, preferences)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId(), userId, "", country, currency, ""]
        );
      }
    });
    const ctx = await loadAuthContext(userId, "session");
    if (!ctx) throw new Error("Failed to load the new account");
    await issueSession(ctx.user, res);
    await audit({ actor: { id: userId, role: input.role }, action: "auth.signup", resourceType: "user", resourceId: userId });
    logger.info("signup", { userId, role: input.role });
    res.status(201).json({ data: { user: ctx.user, seller: ctx.seller, buyer: ctx.buyer } });
  } catch (error) {
    next(error);
  }
});
authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(LoginInput, req.body);
    const db = await getDb();
    const rows = await db.query(`SELECT * FROM users WHERE email = $1`, [input.email]);
    const row = rows[0];
    if (!row || !verifyPassword(input.password, String(row.password_hash))) {
      throw unauthorized("Email or password is incorrect.");
    }
    const ctx = await loadAuthContext(String(row.id), "session");
    if (!ctx) throw unauthorized("This account could not be loaded.");
    await issueSession(ctx.user, res);
    await audit({ actor: { id: ctx.user.id, role: ctx.user.role }, action: "auth.login", resourceType: "user", resourceId: ctx.user.id });
    res.json({ data: { user: ctx.user, seller: ctx.seller, buyer: ctx.buyer } });
  } catch (error) {
    next(error);
  }
});
authRouter.post("/logout", (req, res) => {
  void req;
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ data: { ok: true } });
});
authRouter.get("/me", optionalAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.json({ data: null });
      return;
    }
    const { user, seller, buyer, source } = req.auth;
    const db = await getDb();
    const integrations = await db.query(
      `SELECT (SELECT COUNT(*)::int FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL) AS api_keys`,
      [user.id]
    );
    res.json({
      data: {
        user,
        seller,
        buyer,
        source,
        apiKeys: Number(integrations[0]?.api_keys ?? 0),
        integrations: {
          gemini: env.gemini.configured,
          paypal: env.paypal.configured,
          mcp: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});
authRouter.post("/profile", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const input = parseWith(ProfileUpdate, req.body);
    const db = await getDb();
    const fields = [];
    const params = [];
    if (input.name) {
      params.push(input.name);
      fields.push(`name = $${params.length}`);
    }
    if (input.country) {
      params.push(input.country.toUpperCase());
      fields.push(`country = $${params.length}`);
    }
    if (input.currency) {
      params.push(input.currency);
      fields.push(`currency = $${params.length}`);
    }
    if (fields.length > 0) {
      params.push(auth.user.id);
      await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
    }
    const ctx = await loadAuthContext(auth.user.id, auth.source);
    res.json({ data: { user: ctx?.user ?? mapUser({ ...auth.user, id: auth.user.id }) } });
  } catch (error) {
    next(error);
  }
});
authRouter.post("/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(ForgotInput, req.body);
    const db = await getDb();
    const rows = await db.query(`SELECT id FROM users WHERE email = $1`, [input.email]);
    let devResetUrl = null;
    if (rows[0]) {
      const raw = randomToken(32);
      await db.query(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
        [newId(), rows[0].id, sha256(raw)]
      );
      if (!env.isProd) {
        devResetUrl = `${env.frontendUrl}/reset-password?token=${raw}`;
        logger.info("password_reset_link", { email: input.email, url: devResetUrl });
      }
    }
    res.status(202).json({
      data: {
        accepted: true,
        delivery: "not_configured",
        message: "If that email has an account, a 30-minute reset link was created.",
        devResetUrl
      }
    });
  } catch (error) {
    next(error);
  }
});
authRouter.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(ResetInput, req.body);
    const db = await getDb();
    const hash = sha256(input.token);
    const rows = await db.query(
      `SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [hash]
    );
    if (!rows[0]) throw badRequest("That reset link is invalid or has expired. Request a new one.");
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashPassword(input.password), rows[0].user_id]);
      await tx.query(`UPDATE password_resets SET used_at = NOW() WHERE id = $1`, [rows[0].id]);
    });
    await audit({
      actor: { id: String(rows[0].user_id), role: null },
      action: "auth.password_reset",
      resourceType: "user",
      resourceId: String(rows[0].user_id)
    });
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});

// src/routes/seller.ts
import { Router as Router2 } from "express";

// src/services/seller.ts
async function uniqueStoreSlug(base, excludeSellerId) {
  const db = await getDb();
  const root = slugify(base) || "store";
  let candidate = root;
  for (let i = 0; i < 50; i += 1) {
    const rows = excludeSellerId ? await db.query(`SELECT id FROM sellers WHERE store_slug = $1 AND id <> $2`, [candidate, excludeSellerId]) : await db.query(`SELECT id FROM sellers WHERE store_slug = $1`, [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// src/services/analytics.ts
function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return roundMoney((current - previous) / previous * 100);
}
function isPaid(status) {
  return ["PAID", "SETTLED", "FULFILLED"].includes(status);
}
function dayKey(iso) {
  return toIso(iso).slice(0, 10);
}
async function loadRows(sellerId) {
  const db = await getDb();
  const negRows = await db.query(
    `SELECT n.id, n.status, n.created_at, n.currency, n.market_type, n.is_sample, n.listed_price,
            n.requested_quantity AS quantity, n.rounds_used, bu.name AS buyer_name,
            p.id AS product_id, p.name AS product_name,
            d.agreed_unit_price AS deal_unit, d.total_amount AS deal_total, d.status AS deal_status,
            (SELECT o.unit_price FROM offers o WHERE o.negotiation_id = n.id AND o.submitted_by = 'BUYER_AGENT' AND o.kind = 'OFFER' ORDER BY o.created_at ASC LIMIT 1) AS first_offer
     FROM negotiations n
     JOIN buyers b ON b.id = n.buyer_id JOIN users bu ON bu.id = b.user_id
     JOIN products p ON p.id = n.product_id
     LEFT JOIN deals d ON d.negotiation_id = n.id
     WHERE n.seller_id = $1 ORDER BY n.created_at DESC`,
    [sellerId]
  );
  const orderRows = await db.query(
    `SELECT o.id, o.status, o.payment_state, o.total_amount, o.currency, o.market_type, o.created_at,
            o.payment_provider, o.is_sample, d.agreed_quantity AS quantity, d.id AS deal_id,
            p.id AS product_id, p.name AS product_name, bu.name AS buyer_name
     FROM orders o
     JOIN deals d ON d.id = o.deal_id
     JOIN negotiations n ON n.id = d.negotiation_id
     JOIN products p ON p.id = n.product_id
     JOIN buyers b ON b.id = o.buyer_id JOIN users bu ON bu.id = b.user_id
     WHERE o.seller_id = $1 ORDER BY o.created_at DESC`,
    [sellerId]
  );
  const productRows = await db.query(
    `SELECT * FROM products WHERE seller_id = $1 ORDER BY name ASC`,
    [sellerId]
  );
  return {
    negotiations: negRows.map((r) => ({
      id: String(r.id),
      status: r.status,
      createdAt: toIso(r.created_at),
      currency: String(r.currency),
      marketType: r.market_type,
      isSample: toBool(r.is_sample),
      listedPrice: toNumber(r.listed_price),
      quantity: toNumber(r.quantity),
      buyerName: String(r.buyer_name),
      productId: String(r.product_id),
      productName: String(r.product_name),
      dealUnit: r.deal_unit === null ? null : toNumber(r.deal_unit),
      dealTotal: r.deal_total === null ? null : toNumber(r.deal_total),
      dealStatus: r.deal_status ? String(r.deal_status) : null,
      rounds: toNumber(r.rounds_used),
      firstOffer: r.first_offer === null ? null : toNumber(r.first_offer)
    })),
    orders: orderRows.map((r) => ({
      id: String(r.id),
      status: String(r.status),
      paymentState: String(r.payment_state),
      totalAmount: toNumber(r.total_amount),
      currency: String(r.currency),
      marketType: r.market_type,
      createdAt: toIso(r.created_at),
      paymentProvider: String(r.payment_provider),
      productId: String(r.product_id),
      productName: String(r.product_name),
      buyerName: String(r.buyer_name),
      isSample: toBool(r.is_sample),
      quantity: toNumber(r.quantity),
      dealId: String(r.deal_id)
    })),
    products: productRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sku: String(r.sku),
      listedPrice: toNumber(r.listed_price),
      currency: String(r.currency),
      stock: toNumber(r.stock),
      active: toBool(r.active),
      category: String(r.category)
    }))
  };
}
async function getSellerAnalytics(seller) {
  const { negotiations, orders, products } = await loadRows(seller.id);
  const now = Date.now();
  const dayMs = 864e5;
  const startToday = /* @__PURE__ */ new Date();
  startToday.setUTCHours(0, 0, 0, 0);
  const totalNegotiations = negotiations.length;
  const negotiationsToday = negotiations.filter((n) => new Date(n.createdAt).getTime() >= startToday.getTime()).length;
  const acceptedDeals = negotiations.filter((n) => n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED").length;
  const paidOrders = orders.filter((o) => isPaid(o.status));
  const totalSales = roundMoney(paidOrders.reduce((sum, o) => sum + o.totalAmount, 0));
  const pendingPayments = roundMoney(
    orders.filter((o) => ["PENDING_PAYMENT", "APPROVAL_PENDING", "SETTLEMENT_PENDING"].includes(o.status)).reduce((sum, o) => sum + o.totalAmount, 0)
  );
  const discountValues = negotiations.filter((n) => n.dealUnit !== null && n.listedPrice > 0 && (n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED")).map((n) => (n.listedPrice - n.dealUnit) / n.listedPrice * 100);
  const averageDiscount = discountValues.length ? roundMoney(discountValues.reduce((a, b) => a + b, 0) / discountValues.length) : 0;
  const conversionRate = totalNegotiations === 0 ? 0 : roundMoney(acceptedDeals / totalNegotiations * 100);
  const last7 = negotiations.filter((n) => now - new Date(n.createdAt).getTime() <= 7 * dayMs);
  const prev7 = negotiations.filter((n) => {
    const age = now - new Date(n.createdAt).getTime();
    return age > 7 * dayMs && age <= 14 * dayMs;
  });
  const salesLast7 = paidOrders.filter((o) => now - new Date(o.createdAt).getTime() <= 7 * dayMs);
  const salesPrev7 = paidOrders.filter((o) => {
    const age = now - new Date(o.createdAt).getTime();
    return age > 7 * dayMs && age <= 14 * dayMs;
  });
  const revenueSeries = [];
  const negotiationSeries = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(startToday.getTime() - i * dayMs).toISOString().slice(0, 10);
    const dayOrders = paidOrders.filter((o) => dayKey(o.createdAt) === day);
    const dayNegs = negotiations.filter((n) => dayKey(n.createdAt) === day);
    revenueSeries.push({
      date: day,
      revenue: roundMoney(dayOrders.reduce((sum, o) => sum + o.totalAmount, 0)),
      orders: dayOrders.length
    });
    negotiationSeries.push({
      date: day,
      started: dayNegs.length,
      agreed: dayNegs.filter((n) => n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED").length
    });
  }
  const productMap = new Map(products.map((p) => [p.id, p]));
  const topMap = /* @__PURE__ */ new Map();
  for (const p of products) {
    topMap.set(p.id, { name: p.name, revenue: 0, quantity: 0, negotiations: 0 });
  }
  for (const n of negotiations) {
    const entry = topMap.get(n.productId);
    if (entry) entry.negotiations += 1;
  }
  for (const o of paidOrders) {
    const entry = topMap.get(o.productId);
    if (!entry) continue;
    entry.revenue = roundMoney(entry.revenue + o.totalAmount);
    const neg = negotiations.find((n) => n.productId === o.productId && (n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED"));
    if (neg) entry.quantity += neg.quantity;
  }
  const topProducts = [...topMap.values()].filter((p) => p.negotiations > 0 || p.revenue > 0).sort((a, b) => b.revenue - a.revenue || b.negotiations - a.negotiations).slice(0, 5);
  const domestic = negotiations.filter((n) => n.marketType === "DOMESTIC");
  const crossBorder = negotiations.filter((n) => n.marketType === "CROSS_BORDER");
  const markets = [
    {
      market: "DOMESTIC",
      count: domestic.length,
      value: roundMoney(domestic.filter((n) => n.dealTotal).reduce((s, n) => s + (n.dealTotal ?? 0), 0))
    },
    {
      market: "CROSS_BORDER",
      count: crossBorder.length,
      value: roundMoney(crossBorder.filter((n) => n.dealTotal).reduce((s, n) => s + (n.dealTotal ?? 0), 0))
    }
  ];
  const bands = [
    { label: "No discount", min: 0, max: 1e-3 },
    { label: "0\u20135%", min: 1e-3, max: 5 },
    { label: "5\u201310%", min: 5, max: 10 },
    { label: "10\u201315%", min: 10, max: 15 },
    { label: "15%+", min: 15, max: 1e3 }
  ];
  const discounts = {
    bands: bands.map((b) => ({
      label: b.label,
      count: discountValues.filter((d) => d >= b.min && d < b.max).length
    })),
    average: averageDiscount
  };
  const narrative = await analyticsNarrative({
    businessName: seller.businessName,
    currency: seller.currency,
    negotiationsToday,
    negotiationsTotal: totalNegotiations,
    agreed: acceptedDeals,
    salesToday: roundMoney(salesLast7.reduce((s, o) => s + o.totalAmount, 0)),
    salesTotal: totalSales,
    averageDiscount,
    conversionRate,
    pendingPayments,
    topProduct: topProducts[0]?.name ?? null,
    marketSplit: { domestic: domestic.length, crossBorder: crossBorder.length }
  });
  return {
    totals: {
      products: products.length,
      activeProducts: products.filter((p) => p.active).length,
      negotiationsToday,
      negotiationsAllTime: totalNegotiations,
      acceptedDeals,
      totalSales,
      pendingPayments,
      averageDiscountPercent: averageDiscount,
      conversionRate,
      orders: orders.length
    },
    deltas: {
      negotiationsToday: pctChange(last7.length, prev7.length),
      acceptedDeals: pctChange(
        last7.filter((n) => n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED").length,
        prev7.filter((n) => n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED").length
      ),
      totalSales: pctChange(
        salesLast7.reduce((s, o) => s + o.totalAmount, 0),
        salesPrev7.reduce((s, o) => s + o.totalAmount, 0)
      )
    },
    revenueSeries,
    negotiationSeries,
    topProducts,
    markets,
    discounts,
    aiSummary: {
      text: narrative.text,
      mode: narrative.mode,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    includesSample: negotiations.some((n) => n.isSample) || orders.some((o) => o.isSample)
  };
}
async function getNegotiationRows(sellerId) {
  const { negotiations } = await loadRows(sellerId);
  return negotiations.map((n) => ({
    id: n.id,
    buyerName: n.buyerName,
    productName: n.productName,
    listedPrice: n.listedPrice,
    initialOffer: n.firstOffer ?? n.listedPrice,
    finalPrice: n.dealUnit,
    quantity: n.quantity,
    discountPercent: n.dealUnit !== null && n.listedPrice > 0 ? roundMoney((n.listedPrice - n.dealUnit) / n.listedPrice * 100) : 0,
    rounds: n.rounds,
    status: n.status,
    currency: n.currency,
    marketType: n.marketType,
    isSample: n.isSample,
    createdAt: n.createdAt
  }));
}
async function getProductPerformance(sellerId) {
  const { negotiations, orders, products } = await loadRows(sellerId);
  return products.map((p) => {
    const productNegs = negotiations.filter((n) => n.productId === p.id);
    const agreed = productNegs.filter((n) => n.dealStatus === "ACCEPTED" || n.dealStatus === "CONSUMED");
    const discounts = agreed.filter((n) => n.dealUnit !== null && n.listedPrice > 0).map((n) => (n.listedPrice - n.dealUnit) / n.listedPrice * 100);
    const paid = orders.filter((o) => o.productId === p.id && isPaid(o.status));
    const quantitySold = paid.reduce((sum, o) => sum + o.quantity, 0);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      listedPrice: p.listedPrice,
      currency: p.currency,
      quantitySold,
      negotiations: productNegs.length,
      conversionRate: productNegs.length === 0 ? 0 : roundMoney(agreed.length / productNegs.length * 100),
      averageDiscount: discounts.length ? roundMoney(discounts.reduce((a, b) => a + b, 0) / discounts.length) : 0,
      stock: p.stock,
      active: p.active
    };
  });
}
async function getTransactionRows(sellerId) {
  const { orders } = await loadRows(sellerId);
  return orders.map((o) => ({
    id: o.id,
    dealId: o.dealId,
    sellerId,
    buyerId: "",
    customerName: o.buyerName,
    productName: o.productName,
    paymentProvider: o.paymentProvider,
    externalOrderId: null,
    marketType: o.marketType,
    status: o.status,
    paymentState: o.paymentState,
    totalAmount: o.totalAmount,
    currency: o.currency,
    isSample: o.isSample,
    settlementNote: null,
    createdAt: o.createdAt,
    updatedAt: o.createdAt
  }));
}

// src/routes/seller.ts
var sellerRouter = Router2();
sellerRouter.use(optionalAuth);
sellerRouter.get("/profile", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { seller: auth.seller, user: auth.user } });
  } catch (error) {
    next(error);
  }
});
sellerRouter.patch("/profile", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(SellerProfileInput.partial(), req.body);
    const db = await getDb();
    const seller = auth.seller;
    if (input.currency && input.currency !== seller.currency) {
      const products = await db.query(`SELECT COUNT(*)::text AS count FROM products WHERE seller_id = $1`, [seller.id]);
      if (Number(products[0]?.count ?? 0) > 0) {
        throw conflict("Currency cannot change while products exist. Create a new store for a different currency.");
      }
    }
    const slug = input.storeSlug && input.storeSlug !== seller.storeSlug ? await uniqueStoreSlug(input.storeSlug, seller.id) : null;
    const country = input.country ? input.country.toUpperCase() : seller.country;
    const currency = input.currency ?? seller.currency;
    const businessName = input.businessName ?? seller.businessName;
    const description = input.description ?? seller.description;
    await db.query(
      `UPDATE sellers SET business_name = $1, country = $2, currency = $3, store_slug = $4, description = $5,
        updated_at = NOW() WHERE id = $6`,
      [businessName, country, currency, slug ?? seller.storeSlug, description, seller.id]
    );
    await db.query(`UPDATE users SET country = $1, currency = $2 WHERE id = $3`, [country, currency, auth.user.id]);
    await audit({
      actor: { id: auth.user.id, role: "SELLER" },
      action: "seller.profile_updated",
      resourceType: "seller",
      resourceId: seller.id,
      metadata: { storeSlug: slug ?? seller.storeSlug }
    });
    res.json({
      data: {
        seller: { ...seller, businessName, country, currency, storeSlug: slug ?? seller.storeSlug, description }
      }
    });
  } catch (error) {
    next(error);
  }
});
sellerRouter.get("/onboarding", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const db = await getDb();
    const seller = auth.seller;
    const counts = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE seller_id = $1) AS products,
         (SELECT COUNT(*)::int FROM products WHERE seller_id = $1 AND active = TRUE) AS active,
         (SELECT COUNT(*)::int FROM seller_rules WHERE seller_id = $1) AS rules,
         (SELECT rules_confirmed FROM sellers WHERE id = $1) AS rules_confirmed`,
      [seller.id]
    );
    const row = counts[0] ?? { products: 0, active: 0, rules: 0, rules_confirmed: false };
    const profileComplete = seller.businessName.trim().length > 1 && seller.description.trim().length >= 10;
    const productsComplete = Number(row.products) > 0;
    const rulesComplete = row.rules_confirmed === true;
    const published = seller.active;
    res.json({
      data: {
        seller,
        steps: [
          { id: "account", label: "Create your account", complete: true, detail: auth.user.email },
          { id: "profile", label: "Describe your business", complete: profileComplete, detail: profileComplete ? "Business details saved" : "Add a description of at least 10 characters" },
          { id: "products", label: "Add your catalog", complete: productsComplete, detail: `${row.products} product${Number(row.products) === 1 ? "" : "s"} in your catalog` },
          { id: "rules", label: "Review pricing rules", complete: rulesComplete, detail: rulesComplete ? "Confidential rules saved" : "Review and save negotiation rules" },
          { id: "publish", label: "Publish your AI storefront", complete: published, detail: published ? "Live and agent-readable" : "Publish when the steps above are ready" }
        ],
        counts: { products: Number(row.products), activeProducts: Number(row.active), rules: Number(row.rules) },
        published,
        storeUrl: `/stores/${seller.storeSlug}`
      }
    });
  } catch (error) {
    next(error);
  }
});
sellerRouter.post("/publish", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const db = await getDb();
    const seller = auth.seller;
    const stats = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE seller_id = $1 AND active = TRUE) AS products,
         (SELECT COUNT(*)::int FROM seller_rules WHERE seller_id = $1) AS rules,
         (SELECT rules_confirmed FROM sellers WHERE id = $1) AS rules_confirmed`,
      [seller.id]
    );
    const row = stats[0];
    if (seller.description.trim().length < 10) throw conflict("Add a business description before publishing.");
    if (Number(row?.products ?? 0) < 1) throw conflict("Add at least one active product before publishing.");
    if (Number(row?.rules ?? 0) < 1) throw conflict("Set negotiation rules for your products before publishing.");
    if (row?.rules_confirmed !== true) throw conflict("Review and save your negotiation rules before publishing.");
    await db.query(`UPDATE sellers SET active = TRUE, onboarding_complete = TRUE, updated_at = NOW() WHERE id = $1`, [seller.id]);
    await audit({
      actor: { id: auth.user.id, role: "SELLER" },
      action: "seller.published",
      resourceType: "seller",
      resourceId: seller.id
    });
    res.json({ data: { published: true, storeUrl: `/stores/${seller.storeSlug}`, storefrontApi: `/api/public/stores/${seller.storeSlug}` } });
  } catch (error) {
    next(error);
  }
});
sellerRouter.post("/unpublish", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const db = await getDb();
    await db.query(`UPDATE sellers SET active = FALSE, updated_at = NOW() WHERE id = $1`, [auth.seller.id]);
    res.json({ data: { published: false } });
  } catch (error) {
    next(error);
  }
});
sellerRouter.get("/dashboard", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const [analytics, negotiations] = await Promise.all([
      getSellerAnalytics(auth.seller),
      listNegotiations(auth, { pageSize: 5 })
    ]);
    const db = await getDb();
    const recentOrders = await db.query(
      `SELECT o.*, bu.name AS customer_name, p.name AS product_name
       FROM orders o JOIN deals d ON d.id = o.deal_id JOIN negotiations n ON n.id = d.negotiation_id
       JOIN products p ON p.id = n.product_id JOIN buyers b ON b.id = o.buyer_id JOIN users bu ON bu.id = b.user_id
       WHERE o.seller_id = $1 ORDER BY o.created_at DESC LIMIT 4`,
      [auth.seller.id]
    );
    res.json({
      data: {
        analytics,
        negotiations: negotiations.negotiations,
        recentOrders: recentOrders.map((o) => ({
          id: String(o.id),
          status: String(o.status),
          paymentProvider: String(o.payment_provider),
          totalAmount: Number(o.total_amount),
          currency: String(o.currency),
          customerName: String(o.customer_name),
          productName: String(o.product_name),
          createdAt: toIso(o.created_at),
          marketType: String(o.market_type),
          isSample: o.is_sample === true
        })),
        integrations: {
          gemini: env.gemini.configured,
          paypal: env.paypal.configured,
          mcp: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// src/routes/products.ts
import { Router as Router3 } from "express";
import { z as z2 } from "zod";

// src/services/csv.ts
import { parse } from "csv-parse/sync";
var CSV_FIELDS = ["name", "sku", "listedPrice", "stock", "category", "description", "unit", "countryOfOrigin", "images", "currency", "active"];
var ALIASES = {
  name: ["name", "product name", "product", "title", "item"],
  sku: ["sku", "code", "product code", "item code", "item no", "id"],
  listedPrice: ["listed price", "listed_price", "price", "unit price", "mrp", "rate"],
  stock: ["stock", "quantity", "qty", "inventory", "available"],
  category: ["category", "type", "collection"],
  description: ["description", "desc", "details"],
  unit: ["unit", "uom", "unit name"],
  countryOfOrigin: ["country of origin", "origin", "country", "country_of_origin"],
  images: ["images", "image", "image url", "photo", "photos"],
  currency: ["currency", "currency code"],
  active: ["active", "status", "published"]
};
function normaliseHeader(header) {
  return header.trim().toLowerCase().replace(/[_\s]+/g, " ");
}
function suggestMapping(headers) {
  const mapping = {};
  for (const header of headers) {
    const norm = normaliseHeader(header);
    for (const field of CSV_FIELDS) {
      if (!Object.values(mapping).includes(field) && ALIASES[field].includes(norm)) {
        mapping[header] = field;
        break;
      }
    }
  }
  return mapping;
}
function parseCsvText(text) {
  if (text.length > 7e5) throw conflict("That CSV is too large. Keep it under 700 KB.");
  const rows = parse(text, {
    columns: (header) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true
  });
  if (rows.length === 0) throw conflict("The CSV has no data rows.");
  if (rows.length > 2e3) throw conflict("Import up to 2,000 products at a time.");
  const headers = Object.keys(rows[0] ?? {});
  return { headers, rows };
}
function parseImages(value) {
  if (!value) return [];
  return value.split(/[|;]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
}
function parseActive(value) {
  if (!value) return true;
  return !["false", "no", "0", "inactive", "draft", "unpublished"].includes(value.trim().toLowerCase());
}
function mapAndValidate(rows, mapping, seller) {
  const errors = [];
  const seen = /* @__PURE__ */ new Map();
  const duplicateSkus = [];
  const mapped = rows.map((raw, index) => {
    const rowNumber = index + 2;
    const get = (field) => {
      const header = Object.keys(mapping).find((h) => mapping[h] === field);
      if (!header) return void 0;
      const value = raw[header];
      return value === void 0 ? void 0 : String(value).trim();
    };
    const candidate = {
      name: get("name"),
      description: get("description") || "",
      sku: get("sku"),
      category: get("category") || "Other",
      images: parseImages(get("images")),
      listedPrice: get("listedPrice"),
      currency: get("currency") || seller.currency,
      stock: get("stock") || "0",
      unit: get("unit") || "piece",
      countryOfOrigin: get("countryOfOrigin") || seller.country,
      active: parseActive(get("active"))
    };
    const parsed = ProductInput.safeParse(candidate);
    if (!parsed.success) {
      const rowErrors = parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "row",
        message: issue.message
      }));
      for (const err of rowErrors) errors.push({ row: rowNumber, ...err });
      return { row: rowNumber, value: null, errors: rowErrors, rawSku: candidate.sku ?? "", raw };
    }
    const skuKey = parsed.data.sku.toLowerCase();
    if (seen.has(skuKey)) {
      const message = `Duplicate SKU in file (also on row ${seen.get(skuKey)})`;
      errors.push({ row: rowNumber, field: "sku", message });
      if (!duplicateSkus.includes(parsed.data.sku)) duplicateSkus.push(parsed.data.sku);
      return { row: rowNumber, value: null, errors: [{ field: "sku", message }], rawSku: candidate.sku ?? "", raw };
    }
    seen.set(skuKey, rowNumber);
    return { row: rowNumber, value: parsed.data, errors: [], rawSku: candidate.sku ?? "", raw };
  });
  return { mapped, errors, duplicateSkus };
}
async function previewCsv(seller, text, mapping) {
  const { headers, rows } = parseCsvText(text);
  const effectiveMapping = mapping && Object.keys(mapping).length > 0 ? mapping : suggestMapping(headers);
  const db = await getDb();
  const existing = await db.query(`SELECT sku FROM products WHERE seller_id = $1`, [seller.id]);
  const existingSet = new Set(existing.map((r) => String(r.sku).toLowerCase()));
  const { mapped, errors, duplicateSkus } = mapAndValidate(rows, effectiveMapping, seller);
  for (const row of mapped) {
    if (row.value && existingSet.has(row.value.sku.toLowerCase())) {
      errors.push({ row: row.row, field: "sku", message: `SKU ${row.value.sku} already exists in your catalog` });
    }
  }
  const valid = mapped.filter((r) => r.value && !errors.some((e) => e.row === r.row));
  const sample = rows.slice(0, 6).map((r) => {
    const out = {};
    for (const h of headers) out[h] = String(r[h] ?? "").slice(0, 120);
    return out;
  });
  return {
    headers,
    totalRows: rows.length,
    sampleRows: sample,
    suggestedMapping: effectiveMapping,
    unmappedHeaders: headers.filter((h) => !effectiveMapping[h]),
    errors: errors.slice(0, 100),
    validCount: valid.length,
    duplicateSkus,
    products: valid.slice(0, 25).map((r) => ({ ...r.value, row: r.row }))
  };
}
async function importCsv(seller, text, mapping, defaults) {
  const { rows } = parseCsvText(text);
  const effectiveMapping = { ...mapping };
  if (!Object.values(effectiveMapping).includes("currency") && defaults?.currency) {
    const header = Object.keys(effectiveMapping)[0];
    if (header) effectiveMapping[header] = effectiveMapping[header];
  }
  const { mapped, errors } = mapAndValidate(rows, effectiveMapping, seller);
  const db = await getDb();
  const existing = await db.query(`SELECT sku FROM products WHERE seller_id = $1`, [seller.id]);
  const existingSet = new Set(existing.map((r) => String(r.sku).toLowerCase()));
  const productsToInsert = mapped.filter((row) => {
    if (!row.value) return false;
    if (existingSet.has(row.value.sku.toLowerCase())) {
      errors.push({ row: row.row, field: "sku", message: `SKU ${row.value.sku} already exists in your catalog` });
      return false;
    }
    return !errors.some((e) => e.row === row.row);
  });
  if (productsToInsert.length === 0) {
    return { imported: 0, skipped: rows.length, products: [], errors };
  }
  const inserted = [];
  await db.transaction(async (tx) => {
    for (const row of productsToInsert) {
      if (!row.value) continue;
      const value = row.value;
      const id = newId();
      const currency = defaults?.currency && !Object.values(effectiveMapping).includes("currency") ? defaults.currency : value.currency;
      if (currency !== seller.currency) {
        errors.push({ row: row.row, field: "currency", message: `Expected store currency ${seller.currency}` });
        continue;
      }
      const country = defaults?.country && !Object.values(effectiveMapping).includes("countryOfOrigin") ? defaults.country : value.countryOfOrigin;
      await tx.query(
        `INSERT INTO products (id, seller_id, name, description, sku, category, images, listed_price, currency, stock, unit, country_of_origin, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
        [
          id,
          seller.id,
          value.name,
          value.description ?? "",
          value.sku,
          value.category,
          JSON.stringify(value.images ?? []),
          value.listedPrice,
          currency,
          value.stock,
          value.unit,
          country.toUpperCase(),
          value.active ?? true
        ]
      );
      await tx.query(
        `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
        [
          newId(),
          seller.id,
          id,
          money(value.listedPrice * 0.85),
          15,
          1,
          JSON.stringify([]),
          5,
          money(value.listedPrice * 0.95),
          null,
          false
        ]
      );
      const rowsOut = await tx.query(`SELECT * FROM products WHERE id = $1`, [id]);
      if (rowsOut[0]) inserted.push(mapProduct(rowsOut[0]));
    }
  });
  await audit({
    actor: { id: seller.userId, role: "SELLER" },
    action: "product.imported",
    resourceType: "seller",
    resourceId: seller.id,
    metadata: { imported: inserted.length, skipped: rows.length - inserted.length }
  });
  return { imported: inserted.length, skipped: rows.length - inserted.length, products: inserted, errors };
}

// src/routes/products.ts
var productsRouter = Router3();
productsRouter.use(optionalAuth);
var Mapping = z2.record(z2.string(), z2.string());
function castMapping(mapping) {
  const out = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!CSV_FIELDS.includes(field)) {
      throw badRequest(`Unknown CSV field \u201C${field}\u201D.`);
    }
    out[header] = field;
  }
  return out;
}
productsRouter.get("/", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const result = await listSellerProducts(auth.seller.id, {
      search: typeof req.query.search === "string" ? req.query.search : void 0,
      status: typeof req.query.status === "string" ? req.query.status : void 0,
      category: typeof req.query.category === "string" ? req.query.category : void 0,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
productsRouter.post("/", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(ProductInput, req.body);
    const product = await createProduct(auth.seller, input);
    res.status(201).json({ data: { product } });
  } catch (error) {
    next(error);
  }
});
productsRouter.get("/import/template", optionalAuth, async (req, res, next) => {
  try {
    requireSeller(req);
    const csv = "name,sku,listed_price,stock,category,description,unit,country_of_origin,images\nHandmade Brass Diya,DIYA-001,12,120,Home & Decor,Hand-cast brass diya with a warm antique finish.,piece,IN,\nBrass Incense Holder,INC-002,18,80,Home & Decor,Minimal brass holder for incense sticks.,piece,IN,\n";
    res.type("text/csv").send(csv);
  } catch (error) {
    next(error);
  }
});
productsRouter.post("/import/preview", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const body = parseWith(
      z2.object({
        csv: z2.string().min(1, "Choose a CSV file").max(7e5, "Keep the CSV under 700 KB"),
        mapping: Mapping.optional()
      }),
      req.body
    );
    const mapping = body.mapping ? castMapping(body.mapping) : void 0;
    const preview = await previewCsv(auth.seller, body.csv, mapping);
    if (!body.mapping) {
      const headers = preview.headers;
      res.json({ data: { ...preview, suggestedMapping: suggestMapping(headers) } });
      return;
    }
    res.json({ data: preview });
  } catch (error) {
    next(error);
  }
});
productsRouter.post("/import", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const body = parseWith(
      z2.object({
        csv: z2.string().min(1, "Choose a CSV file").max(7e5, "Keep the CSV under 700 KB"),
        mapping: Mapping.refine((m) => Object.keys(m).length > 0, "Map at least one column"),
        defaultCurrency: z2.enum(["USD", "INR", "EUR", "GBP", "AED"]).optional(),
        defaultCountry: z2.string().length(2).optional()
      }),
      req.body
    );
    const result = await importCsv(auth.seller, body.csv, castMapping(body.mapping), {
      currency: body.defaultCurrency ?? auth.seller.currency,
      country: body.defaultCountry ?? auth.seller.country
    });
    res.status(result.imported > 0 ? 201 : 200).json({ data: result });
  } catch (error) {
    next(error);
  }
});
productsRouter.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const product = await getSellerProduct(auth.seller.id, pathParam(req, "id"));
    res.json({ data: { product } });
  } catch (error) {
    next(error);
  }
});
productsRouter.patch("/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(ProductInput.partial(), req.body);
    const product = await updateProduct(auth.seller, pathParam(req, "id"), input);
    res.json({ data: { product } });
  } catch (error) {
    next(error);
  }
});
productsRouter.delete("/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const result = await deleteProduct(auth.seller, pathParam(req, "id"));
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
productsRouter.get("/:id/activity", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const product = await getSellerProduct(auth.seller.id, pathParam(req, "id"));
    const db = await getDb();
    const rows = await db.query(
      `SELECT n.id, n.status, n.created_at FROM negotiations n WHERE n.product_id = $1 AND n.seller_id = $2 ORDER BY n.created_at DESC LIMIT 10`,
      [product.id, auth.seller.id]
    );
    if (!rows) throw notFound("Product not found");
    res.json({
      data: {
        product,
        negotiations: rows.map((r) => ({ id: String(r.id), status: String(r.status), createdAt: String(r.created_at) }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// src/routes/rules.ts
import { Router as Router4 } from "express";
import { z as z3 } from "zod";
var rulesRouter = Router4();
rulesRouter.use(optionalAuth);
rulesRouter.get("/", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const rules = await listRules(auth.seller.id);
    res.json({ data: { rules, currency: auth.seller.currency } });
  } catch (error) {
    next(error);
  }
});
rulesRouter.post("/validate", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const body = parseWith(
      z3.object({
        rules: RulesInput,
        listedPrice: z3.coerce.number().positive(),
        sampleUnitPrice: z3.coerce.number().positive().optional(),
        sampleQuantity: z3.coerce.number().int().positive().optional()
      }),
      req.body
    );
    assertRulesConsistent(body.rules, body.listedPrice);
    const policy = {
      listedPrice: body.listedPrice,
      floorPrice: body.rules.floorPrice,
      maxDiscountPercent: body.rules.maxDiscountPercent,
      minimumQuantity: body.rules.minimumQuantity,
      bulkDiscounts: body.rules.bulkDiscounts,
      maxRounds: body.rules.maxRounds,
      autoAcceptThreshold: body.rules.autoAcceptThreshold ?? null,
      requireApprovalBelow: body.rules.requireApprovalBelow ?? null
    };
    const minimumAllowed = minimumAllowedPrice(policy);
    const target = targetPrice(policy, body.sampleQuantity ?? policy.minimumQuantity);
    const sample = body.sampleUnitPrice !== void 0 ? validateOffer({
      unitPrice: body.sampleUnitPrice,
      quantity: body.sampleQuantity ?? policy.minimumQuantity,
      stock: 1e6,
      policy
    }) : null;
    res.json({
      data: {
        minimumAllowed,
        target,
        bulkTiers: body.rules.bulkDiscounts,
        sample,
        note: "The floor price and minimum allowed price are confidential and never returned by buyer-facing APIs."
      }
    });
  } catch (error) {
    next(error);
  }
});
rulesRouter.get("/:productId", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const rules = await getRulesForProduct(auth.seller.id, pathParam(req, "productId"));
    const db = await getDb();
    const product = await db.query(`SELECT name, sku, listed_price, currency FROM products WHERE id = $1 AND seller_id = $2`, [
      pathParam(req, "productId"),
      auth.seller.id
    ]);
    res.json({
      data: {
        rules,
        product: product[0] ? {
          name: String(product[0].name),
          sku: String(product[0].sku),
          listedPrice: roundMoney(Number(product[0].listed_price)),
          currency: String(product[0].currency)
        } : null,
        minimumAllowed: minimumAllowedPrice({
          listedPrice: Number(product[0]?.listed_price ?? 0),
          floorPrice: rules.floorPrice,
          maxDiscountPercent: rules.maxDiscountPercent
        })
      }
    });
  } catch (error) {
    next(error);
  }
});
rulesRouter.put("/:productId", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(RulesInput, req.body);
    const rules = await upsertRules(auth.seller.id, pathParam(req, "productId"), input);
    const db = await getDb();
    await db.query(`UPDATE sellers SET rules_confirmed = TRUE, updated_at = NOW() WHERE id = $1`, [auth.seller.id]);
    res.json({ data: { rules } });
  } catch (error) {
    next(error);
  }
});

// src/routes/public.ts
import { Router as Router5 } from "express";
var publicRouter = Router5();
publicRouter.use(publicLimiter);
publicRouter.get("/stores", async (_req, res, next) => {
  try {
    res.setHeader("cache-control", "public, max-age=20, stale-while-revalidate=40");
    res.json({
      data: {
        stores: await listPublicStores(),
        api: { mcp: "/mcp", protocolVersion: "2025-06-18" },
        llmConfigured: env.gemini.configured
      }
    });
  } catch (error) {
    next(error);
  }
});
publicRouter.get("/stores/:slug", async (req, res, next) => {
  try {
    const store = await getPublicStore(pathParam(req, "slug"));
    res.setHeader("cache-control", "public, max-age=30, stale-while-revalidate=60");
    res.json({ data: { store } });
  } catch (error) {
    next(error);
  }
});
publicRouter.get("/stores/:slug/products", async (req, res, next) => {
  try {
    const result = await listPublicStoreProducts(pathParam(req, "slug"), {
      search: typeof req.query.q === "string" ? req.query.q : void 0,
      category: typeof req.query.category === "string" ? req.query.category : void 0,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : void 0,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : void 0,
      inStock: req.query.inStock === "true",
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 24
    });
    res.setHeader("cache-control", "public, max-age=20, stale-while-revalidate=40");
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
publicRouter.get("/products/:id", async (req, res, next) => {
  try {
    const product = await getPublicProduct(pathParam(req, "id"));
    res.setHeader("cache-control", "public, max-age=20, stale-while-revalidate=40");
    res.json({ data: { product } });
  } catch (error) {
    next(error);
  }
});
publicRouter.get("/market/products", async (req, res, next) => {
  try {
    const result = await searchMarket({
      search: typeof req.query.q === "string" ? req.query.q : void 0,
      category: typeof req.query.category === "string" ? req.query.category : void 0,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : void 0,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : void 0,
      maxTotal: req.query.maxTotal ? Number(req.query.maxTotal) : void 0,
      quantity: req.query.quantity ? Number(req.query.quantity) : void 0,
      currency: typeof req.query.currency === "string" ? req.query.currency : void 0,
      country: typeof req.query.country === "string" ? req.query.country : void 0,
      inStock: req.query.inStock !== "false",
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 12
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// src/routes/buyer.ts
import { Router as Router6 } from "express";
var buyerRouter = Router6();
buyerRouter.use(optionalAuth);
buyerRouter.get("/profile", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    res.json({ data: { buyer: auth.buyer, user: auth.user } });
  } catch (error) {
    next(error);
  }
});
buyerRouter.put("/profile", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(BuyerProfileInput.partial(), req.body);
    const db = await getDb();
    const buyer = auth.buyer;
    const company = input.companyName ?? buyer.companyName;
    const country = input.country?.toUpperCase() ?? buyer.country;
    const currency = input.currency ?? buyer.currency;
    const preferences = input.preferences ?? buyer.preferences;
    await db.query(`UPDATE buyers SET company_name = $1, country = $2, currency = $3, preferences = $4 WHERE id = $5`, [
      company,
      country,
      currency,
      preferences,
      buyer.id
    ]);
    await db.query(`UPDATE users SET country = $1, currency = $2 WHERE id = $3`, [country, currency, auth.user.id]);
    await audit({
      actor: { id: auth.user.id, role: "BUYER" },
      action: "buyer.profile_updated",
      resourceType: "buyer",
      resourceId: buyer.id
    });
    res.json({ data: { buyer: { ...buyer, companyName: company, country, currency, preferences } } });
  } catch (error) {
    next(error);
  }
});
buyerRouter.post("/intent", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(BuyerIntentInput, req.body);
    const intent = await parseIntent(input.query, input.currency ?? auth.buyer.currency);
    const budget = input.budgetTotal ?? intent.budgetTotal;
    res.json({
      data: {
        intent: { ...intent, budgetTotal: budget },
        unitBudget: budget && intent.quantity ? roundMoney(budget / intent.quantity) : null,
        agentMode: intent.mode,
        llmModel: env.gemini.configured ? env.gemini.model : null
      }
    });
  } catch (error) {
    next(error);
  }
});
buyerRouter.post("/discover", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(BuyerIntentInput, req.body);
    const intent = await parseIntent(input.query, input.currency ?? auth.buyer.currency);
    const budgetTotal = input.budgetTotal ?? intent.budgetTotal;
    const currency = (input.currency ?? intent.currency ?? auth.buyer.currency) || auth.buyer.currency;
    const result = await searchMarket({
      search: intent.productQuery,
      category: intent.category ?? void 0,
      currency,
      quantity: intent.quantity,
      maxTotal: budgetTotal ?? void 0,
      inStock: true,
      pageSize: 24
    });
    const unitBudget = budgetTotal ? roundMoney(budgetTotal / intent.quantity) : null;
    const products = result.products.map((product) => {
      const listedTotal = roundMoney(product.listedPrice * intent.quantity);
      const overBudget = budgetTotal ? listedTotal > budgetTotal : false;
      const negotiableIntoBudget = budgetTotal ? listedTotal <= budgetTotal * 1.35 : false;
      const unitGapPercent = unitBudget && product.listedPrice > 0 ? roundMoney((product.listedPrice - unitBudget) / product.listedPrice * 100) : null;
      return {
        ...product,
        fit: {
          quantity: intent.quantity,
          listedTotal,
          unitBudget,
          withinListedBudget: !overBudget,
          negotiableIntoBudget,
          unitGapPercent,
          label: !budgetTotal ? "Budget not set" : !overBudget ? "Inside budget at list price" : negotiableIntoBudget ? "May reach budget through negotiation" : "Above budget"
        }
      };
    });
    products.sort((a, b) => {
      if (a.fit.withinListedBudget !== b.fit.withinListedBudget) return a.fit.withinListedBudget ? -1 : 1;
      if (a.fit.negotiableIntoBudget !== b.fit.negotiableIntoBudget) return a.fit.negotiableIntoBudget ? -1 : 1;
      return a.listedPrice - b.listedPrice;
    });
    res.json({
      data: {
        intent: { ...intent, budgetTotal },
        budget: budgetTotal ? {
          total: budgetTotal,
          currency,
          perUnit: unitBudget,
          display: formatMoney(budgetTotal, currency)
        } : null,
        products,
        total: result.total,
        agentMode: intent.mode,
        note: products.length === 0 ? "No published storefront matched that search in this currency. BhavAI does not convert currencies in this build." : "Offers are negotiated inside each seller\u2019s confidential rules and revalidated server-side."
      }
    });
  } catch (error) {
    next(error);
  }
});
buyerRouter.get("/summary", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const db = await getDb();
    const [negotiations, orders] = await Promise.all([
      listNegotiations(auth, { pageSize: 5 }),
      db.query(
        `SELECT o.id, o.status, o.payment_state, o.total_amount, o.currency, o.payment_provider, o.market_type,
                o.created_at, o.is_sample, p.name AS product_name, s.business_name
         FROM orders o JOIN deals d ON d.id = o.deal_id JOIN negotiations n ON n.id = d.negotiation_id
         JOIN products p ON p.id = n.product_id JOIN sellers s ON s.id = o.seller_id
         WHERE o.buyer_id = $1 ORDER BY o.created_at DESC LIMIT 5`,
        [auth.buyer.id]
      )
    ]);
    const counts = await db.query(
      `SELECT
        (SELECT COUNT(*)::int FROM negotiations WHERE buyer_id = $1 AND status = 'OPEN') AS open,
        (SELECT COUNT(*)::int FROM negotiations WHERE buyer_id = $1 AND status = 'AGREED') AS agreed,
        (SELECT COUNT(*)::int FROM orders WHERE buyer_id = $1) AS orders`,
      [auth.buyer.id]
    );
    const recommended = await searchMarket({
      currency: auth.buyer.currency,
      inStock: true,
      pageSize: 6,
      quantity: 1
    });
    res.json({
      data: {
        counts: counts[0] ?? { open: 0, agreed: 0, orders: 0 },
        negotiations: negotiations.negotiations,
        orders: orders.map((o) => ({
          id: String(o.id),
          status: String(o.status),
          paymentState: String(o.payment_state),
          totalAmount: Number(o.total_amount),
          currency: String(o.currency),
          paymentProvider: String(o.payment_provider),
          marketType: String(o.market_type),
          createdAt: String(o.created_at),
          isSample: o.is_sample === true,
          productName: String(o.product_name),
          sellerName: String(o.business_name)
        })),
        recommended: recommended.products,
        agentMode: env.gemini.configured ? "GEMINI" : "POLICY"
      }
    });
  } catch (error) {
    next(error);
  }
});

// src/routes/negotiations.ts
import { Router as Router7 } from "express";
var negotiationsRouter = Router7();
negotiationsRouter.use(optionalAuth);
negotiationsRouter.post("/", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(NegotiationCreateInput, req.body);
    const negotiation = await createNegotiation(auth, input);
    res.status(201).json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.get("/", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const result = await listNegotiations(auth, {
      status: typeof req.query.status === "string" ? req.query.status : void 0,
      search: typeof req.query.search === "string" ? req.query.search : void 0,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await getNegotiationDetail(pathParam(req, "id"), auth);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.post("/:id/step", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await runNegotiationStep(pathParam(req, "id"), auth);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.post("/:id/offers", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(OfferInput, req.body);
    const detail = await getNegotiationDetail(pathParam(req, "id"), auth);
    if (detail.status !== "OPEN") throw badRequest("This negotiation is no longer open.");
    if (detail.quantity !== input.quantity) {
      throw badRequest(`This negotiation is for ${detail.quantity} units. Start a new negotiation to change quantity.`);
    }
    const { submitBuyerOffer: submitBuyerOffer2 } = await import("./negotiation-offers-ARNSJPKD.js");
    const negotiation = await submitBuyerOffer2(pathParam(req, "id"), auth, input);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.post("/:id/accept", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    if (auth.user.role === "SELLER") {
      const sellerAuth = requireSeller(req);
      const negotiation2 = await approveDeal(pathParam(req, "id"), sellerAuth);
      res.json({ data: { negotiation: negotiation2 } });
      return;
    }
    const buyerAuth = requireBuyer(req);
    const negotiation = await confirmDeal(pathParam(req, "id"), buyerAuth);
    res.json({ data: { negotiation, note: "Buyer confirmed the deal. Payment can now be created." } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.post("/:id/confirm", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const negotiation = await confirmDeal(pathParam(req, "id"), auth);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.post("/:id/reject", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await rejectNegotiation(pathParam(req, "id"), auth, typeof req.body?.reason === "string" ? req.body.reason : void 0);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
negotiationsRouter.post("/:id/cancel", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await cancelNegotiation(pathParam(req, "id"), auth, typeof req.body?.reason === "string" ? req.body.reason : void 0);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

// src/routes/payments.ts
import { Router as Router8 } from "express";

// src/payments/paypal.ts
var PayPalError = class extends Error {
  status;
  debugId;
  issue;
  constructor(message, status = 502, debugId, issue) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.debugId = debugId;
    this.issue = issue;
  }
};
var tokenCache = null;
function basicAuth() {
  return Buffer.from(`${env.paypal.clientId}:${env.paypal.clientSecret}`).toString("base64");
}
async function getAccessToken(force = false) {
  if (!env.paypal.configured) throw new PayPalError("PayPal is not configured.", 503);
  if (!force && tokenCache && tokenCache.expiresAt > Date.now() + 3e4) return tokenCache.token;
  const response = await fetch(`${env.paypal.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth()}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.error("paypal_token_failed", { status: response.status, body: text.slice(0, 300) });
    throw new PayPalError("PayPal authentication failed. Check the Sandbox client credentials.", 502);
  }
  const json2 = await response.json();
  tokenCache = { token: json2.access_token, expiresAt: Date.now() + json2.expires_in * 1e3 };
  return json2.access_token;
}
async function paypalFetch(path3, init = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${env.paypal.baseUrl}${path3}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers ?? {}
    },
    body: init.body ? JSON.stringify(init.body) : void 0,
    signal: AbortSignal.timeout(2e4)
  });
  const text = await response.text();
  let json2 = {};
  try {
    json2 = text ? JSON.parse(text) : {};
  } catch {
    json2 = {};
  }
  if (!response.ok) {
    const message = typeof json2.message === "string" ? json2.message : "PayPal rejected the request.";
    const debugId = typeof json2.debug_id === "string" ? json2.debug_id : void 0;
    const details = Array.isArray(json2.details) ? json2.details : [];
    const issue = details[0] && typeof details[0].issue === "string" ? String(details[0].issue) : void 0;
    logger.error("paypal_api_error", { path: path3, status: response.status, message, debugId, issue });
    throw new PayPalError(message, 502, debugId, issue);
  }
  return json2;
}
async function createPayPalOrder(input) {
  return paypalFetch("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `bhavai-order-${input.orderId}` },
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderId,
          description: input.description.slice(0, 127),
          amount: {
            currency_code: input.currency,
            value: input.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: input.currency,
                value: (input.unitPrice * input.quantity).toFixed(2)
              }
            }
          },
          items: [
            {
              name: input.itemName.slice(0, 127),
              quantity: String(input.quantity),
              unit_amount: {
                currency_code: input.currency,
                value: input.unitPrice.toFixed(2)
              },
              category: "PHYSICAL_GOODS"
            }
          ]
        }
      ],
      application_context: {
        brand_name: "BhavAI",
        locale: "en-US",
        landing_page: "LOGIN",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl
      }
    }
  });
}
function approvalUrl(order) {
  const links = order.links ?? [];
  return (links.find((l) => l.rel === "approve" || l.rel === "payer-action") ?? links.find((l) => l.rel === "checkout"))?.href ?? null;
}
async function capturePayPalOrder(paypalOrderId, requestId2) {
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": requestId2 },
    body: {}
  });
}
async function getPayPalOrder(paypalOrderId) {
  return paypalFetch(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
}
async function verifyPayPalWebhook(headers, event) {
  if (!env.paypal.webhookConfigured) {
    logger.error("paypal_webhook_unconfigured", { reason: "PAYPAL_WEBHOOK_ID missing" });
    return false;
  }
  const get = (key) => {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const transmissionId = get("paypal-transmission-id");
  const transmissionTime = get("paypal-transmission-time");
  const certUrl = get("paypal-cert-url");
  const authAlgo = get("paypal-auth-algo");
  const signature = get("paypal-transmission-sig");
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !signature) {
    logger.warn("paypal_webhook_missing_headers");
    return false;
  }
  try {
    const result = await paypalFetch("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: signature,
        webhook_id: env.paypal.webhookId,
        webhook_event: event
      }
    });
    return result.verification_status === "SUCCESS";
  } catch (error) {
    logger.error("paypal_webhook_verify_failed", { message: error.message });
    return false;
  }
}

// src/services/orders.ts
var PAYPAL_CURRENCIES = /* @__PURE__ */ new Set(["USD", "EUR", "GBP", "CAD", "AUD", "SGD", "JPY"]);
function mapPayment(row) {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    provider: row.provider,
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    providerCaptureId: row.provider_capture_id ? String(row.provider_capture_id) : null,
    amount: roundMoney(toNumber(row.amount)),
    currency: String(row.currency),
    status: row.status,
    approvalUrl: row.approval_url ? String(row.approval_url) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}
function mapOrderRow(row) {
  return {
    id: String(row.id),
    dealId: String(row.deal_id),
    sellerId: String(row.seller_id),
    buyerId: String(row.buyer_id),
    customerName: row.customer_name ? String(row.customer_name) : void 0,
    productName: row.product_name ? String(row.product_name) : void 0,
    paymentProvider: row.payment_provider,
    externalOrderId: row.external_order_id ? String(row.external_order_id) : null,
    marketType: row.market_type,
    status: row.status,
    paymentState: row.payment_state,
    totalAmount: roundMoney(toNumber(row.total_amount)),
    currency: String(row.currency),
    isSample: row.is_sample === true,
    settlementNote: row.settlement_note ? String(row.settlement_note) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}
var ORDER_SELECT = `
  SELECT o.*, bu.name AS customer_name, p.name AS product_name, n.product_id,
         d.negotiation_id, n.buyer_id AS neg_buyer_id, n.seller_id AS neg_seller_id,
         b.user_id AS buyer_user_id, s.user_id AS seller_user_id
  FROM orders o
  JOIN deals d ON d.id = o.deal_id
  JOIN negotiations n ON n.id = d.negotiation_id
  JOIN buyers b ON b.id = o.buyer_id
  JOIN users bu ON bu.id = b.user_id
  JOIN sellers s ON s.id = o.seller_id
  JOIN products p ON p.id = n.product_id
`;
function canAccessOrder(row, auth) {
  if (auth.user.role === "ADMIN") return true;
  return String(row.buyer_user_id) === auth.user.id || String(row.seller_user_id) === auth.user.id;
}
async function loadPaymentRow(paymentId, tx) {
  const db = tx ?? await getDb();
  const rows = await db.query(
    `SELECT pay.*, o.status AS order_status, o.payment_state AS order_payment_state, o.market_type AS order_market_type,
            o.deal_id, d.negotiation_id, d.status AS deal_status, d.agreed_quantity, d.agreed_unit_price,
            d.total_amount AS deal_total, d.currency AS deal_currency, n.buyer_id, n.seller_id, n.product_id,
            o.settlement_note,
            b.user_id AS buyer_user_id, s.user_id AS seller_user_id, p.name AS product_name,
            bu.name AS buyer_name
     FROM payments pay
     JOIN orders o ON o.id = pay.order_id
     JOIN deals d ON d.id = o.deal_id
     JOIN negotiations n ON n.id = d.negotiation_id
     JOIN buyers b ON b.id = n.buyer_id
     JOIN users bu ON bu.id = b.user_id
     JOIN sellers s ON s.id = n.seller_id
     JOIN products p ON p.id = n.product_id
     WHERE pay.id = $1`,
    [paymentId]
  );
  if (!rows[0]) throw notFound("Payment not found");
  return rows[0];
}
function paymentResponse(row, detail) {
  return {
    payment: mapPayment(row),
    orderId: String(row.order_id),
    market: row.order_market_type ?? detail?.mode,
    mode: row.provider === "MANUAL" ? "MANUAL" : "PAYPAL",
    settlementNote: row.provider === "MANUAL" ? String(row.settlement_note ?? "") || null : null
  };
}
async function createPaymentForDeal(negotiationId, auth, origin) {
  const detail = await getNegotiationForPayment(negotiationId, auth);
  if (!detail.deal) throw conflict("No deal exists for this negotiation.");
  if (detail.buyerId !== auth.buyer.id) throw forbidden("Only the buyer on this deal can start payment.");
  if (!detail.deal.buyerConfirmedAt) {
    throw conflict("Confirm the accepted deal before creating a payment.");
  }
  if (detail.deal.status !== "ACCEPTED") {
    throw conflict("This deal is not in a payable state.");
  }
  if (detail.order && ["PAID", "SETTLED", "FULFILLED"].includes(detail.order.status)) {
    const existing = await getDb().then(
      (db2) => db2.query(`SELECT * FROM payments WHERE order_id = $1`, [detail.order?.id])
    );
    if (existing[0]) return paymentResponse(existing[0]);
    throw conflict("This order is already complete.");
  }
  const db = await getDb();
  const productRows = await db.query(
    `SELECT p.*, r.floor_price, r.max_discount_percent, r.minimum_quantity, r.bulk_discounts, r.max_rounds,
            r.auto_accept_threshold, r.require_approval_below, r.approval_required
     FROM products p JOIN seller_rules r ON r.product_id = p.id WHERE p.id = $1`,
    [detail.productId]
  );
  if (!productRows[0]) throw conflict("The product is no longer available.");
  const product = mapProduct(productRows[0]);
  const rules = mapRules(productRows[0]);
  const policy = policyFromRules(rules, product);
  const check = validateOffer({
    unitPrice: detail.deal.agreedUnitPrice,
    quantity: detail.deal.agreedQuantity,
    stock: detail.deal.agreedQuantity,
    // stock is already reserved by the accepted deal
    policy
  });
  if (!check.valid) {
    logger.error("payment_revalidation_failed", { negotiationId, code: check.code });
    throw conflict("The agreed price no longer passes the seller\u2019s rules. Reopen the negotiation.");
  }
  const expectedTotal = money(detail.deal.agreedUnitPrice * detail.deal.agreedQuantity);
  if (Math.abs(expectedTotal - detail.deal.totalAmount) > 5e-3 || detail.deal.currency !== product.currency) {
    throw conflict("The deal totals do not reconcile. Payment was not created.");
  }
  const isDomestic = detail.marketType === "DOMESTIC";
  if (!isDomestic) {
    if (!PAYPAL_CURRENCIES.has(detail.currency)) {
      throw conflict(
        `PayPal cannot charge ${detail.currency} in this demonstration. Use a USD-priced storefront or settle the order off-platform.`
      );
    }
    if (!env.paypal.configured) {
      throw new AppError(
        503,
        "PAYPAL_NOT_CONFIGURED",
        "PayPal Sandbox is not configured on this deployment. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, then retry. No payment was created."
      );
    }
  }
  let orderId = "";
  let paymentId = "";
  const existingOrder = await db.query(`SELECT * FROM orders WHERE deal_id = $1`, [detail.deal.id]);
  if (existingOrder[0]) {
    orderId = String(existingOrder[0].id);
    const existingPayment = await db.query(
      `SELECT pay.*, o.market_type AS order_market_type, o.settlement_note FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.order_id = $1`,
      [orderId]
    );
    if (!existingPayment[0]) throw conflict("An order already exists for this deal but has no payment record.");
    const payment = existingPayment[0];
    paymentId = String(payment.id);
    if (payment.status === "COMPLETED" || payment.provider === "MANUAL") return paymentResponse(payment);
    if (payment.approval_url && payment.status !== "FAILED") return paymentResponse(payment);
    await db.query(`UPDATE payments SET status = 'CREATED', approval_url = NULL, updated_at = NOW() WHERE id = $1`, [
      paymentId
    ]);
    await db.query(
      `UPDATE orders SET status = 'PENDING_PAYMENT', payment_state = 'CREATED', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
  } else {
    await db.transaction(async (tx) => {
      const locked = await tx.query(
        `SELECT d.*, n.buyer_id, n.seller_id FROM deals d JOIN negotiations n ON n.id = d.negotiation_id
         WHERE d.id = $1 FOR UPDATE OF d`,
        [detail.deal.id]
      );
      const deal = locked[0];
      if (!deal || deal.status !== "ACCEPTED") throw conflict("The deal is no longer in an accepted state.");
      const dupe = await tx.query(`SELECT id FROM orders WHERE deal_id = $1`, [detail.deal.id]);
      if (dupe[0]) throw conflict("An order was created concurrently. Refresh and try again.");
      orderId = newId();
      paymentId = newId();
      const provider = isDomestic ? "MANUAL" : "PAYPAL";
      const orderStatus = isDomestic ? "SETTLEMENT_PENDING" : "PENDING_PAYMENT";
      const settlementNote = isDomestic ? "India domestic order. Settlement is agreed off-platform; BhavAI does not process Indian domestic PayPal payments." : null;
      await tx.query(
        `INSERT INTO orders (id, deal_id, seller_id, buyer_id, payment_provider, external_order_id, market_type, status, payment_state, total_amount, currency, settlement_note, is_sample)
         VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,'CREATED',$8,$9,$10,FALSE)`,
        [
          orderId,
          detail.deal.id,
          deal.seller_id,
          deal.buyer_id,
          provider,
          detail.marketType,
          orderStatus,
          expectedTotal,
          detail.currency,
          settlementNote
        ]
      );
      await tx.query(
        `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_capture_id, amount, currency, status, approval_url, payload)
         VALUES ($1,$2,$3,NULL,NULL,$4,$5,'CREATED',NULL,'{}'::jsonb)`,
        [paymentId, orderId, provider, expectedTotal, detail.currency]
      );
    });
  }
  if (isDomestic) {
    await audit({
      actor: { id: auth.user.id, role: "BUYER" },
      action: "order.domestic_created",
      resourceType: "order",
      resourceId: orderId,
      metadata: { total: expectedTotal, currency: detail.currency }
    });
    const rows = await db.query(
      `SELECT pay.*, o.market_type AS order_market_type, o.settlement_note FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.id = $1`,
      [paymentId]
    );
    return paymentResponse(rows[0]);
  }
  try {
    const paypalOrder = await createPayPalOrder({
      orderId,
      description: `${detail.productName} \xD7 ${detail.deal.agreedQuantity} \u2014 ${detail.sellerName}`,
      total: expectedTotal,
      currency: detail.currency,
      itemName: detail.productName,
      quantity: detail.deal.agreedQuantity,
      unitPrice: detail.deal.agreedUnitPrice,
      returnUrl: `${origin}/buyer/deals?paypal=return&order=${orderId}`,
      cancelUrl: `${origin}/buyer/deals?paypal=cancel&order=${orderId}`
    });
    const url = approvalUrl(paypalOrder);
    if (!url) throw new PayPalError("PayPal did not return an approval link.");
    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE payments SET provider_order_id = $1, approval_url = $2, status = 'APPROVAL_PENDING', payload = $3::jsonb, updated_at = NOW() WHERE id = $4`,
        [paypalOrder.id, url, JSON.stringify({ id: paypalOrder.id, status: paypalOrder.status }), paymentId]
      );
      await tx.query(
        `UPDATE orders SET external_order_id = $1, status = 'APPROVAL_PENDING', payment_state = 'APPROVAL_PENDING', updated_at = NOW() WHERE id = $2`,
        [paypalOrder.id, orderId]
      );
    });
    await audit({
      actor: { id: auth.user.id, role: "BUYER" },
      action: "paypal.order_created",
      resourceType: "order",
      resourceId: orderId,
      metadata: { paypalOrderId: paypalOrder.id, total: expectedTotal, currency: detail.currency }
    });
    const rows = await db.query(
      `SELECT pay.*, o.market_type AS order_market_type, o.settlement_note FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.id = $1`,
      [paymentId]
    );
    return paymentResponse(rows[0]);
  } catch (error) {
    await db.query(
      `UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
      [paymentId]
    );
    await db.query(
      `UPDATE orders SET status = 'FAILED', payment_state = 'FAILED', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
    logger.error("paypal_create_failed", {
      orderId,
      message: error.message,
      debugId: error instanceof PayPalError ? error.debugId : void 0
    });
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      "PAYPAL_ERROR",
      error instanceof PayPalError ? error.message : "PayPal could not create the order. No payment was taken.",
      { debugId: error instanceof PayPalError ? error.debugId : void 0 }
    );
  }
}
async function markCompleted(paymentId, captureId, source) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT pay.*, o.deal_id FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.id = $1 FOR UPDATE OF pay`,
      [paymentId]
    );
    const row = rows[0];
    if (!row) throw notFound("Payment not found");
    if (row.status === "COMPLETED") return;
    await tx.query(
      `UPDATE payments SET status = 'COMPLETED', provider_capture_id = COALESCE($1, provider_capture_id), updated_at = NOW() WHERE id = $2`,
      [captureId, paymentId]
    );
    await tx.query(
      `UPDATE orders SET status = 'PAID', payment_state = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [row.order_id]
    );
    await tx.query(`UPDATE deals SET status = 'CONSUMED' WHERE id = $1 AND status = 'ACCEPTED'`, [row.deal_id]);
    logger.info("payment_completed", { paymentId, source });
  });
}
async function capturePayment(paymentId, auth) {
  const db = await getDb();
  const row = await loadPaymentRow(paymentId);
  if (String(row.buyer_user_id) !== auth.user.id && auth.user.role !== "ADMIN") {
    throw forbidden("Only the buyer on this order can capture payment.");
  }
  if (row.provider === "MANUAL") {
    throw conflict("This is a domestic manual-settlement order. It is never captured through PayPal.");
  }
  if (row.status === "COMPLETED") return paymentResponse(row);
  if (!row.provider_order_id) throw conflict("PayPal has no order id for this payment yet.");
  try {
    const capture = await capturePayPalOrder(String(row.provider_order_id), `bhavai-capture-${paymentId}`);
    if (capture.status === "COMPLETED") {
      const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? capture.id;
      const capturedAmount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      if (capturedAmount) {
        const amount = Number(capturedAmount.value);
        if (capturedAmount.currency_code !== row.currency || Math.abs(amount - toNumber(row.amount)) > 5e-3) {
          logger.error("paypal_capture_amount_mismatch", {
            paymentId,
            expected: toNumber(row.amount),
            received: amount,
            currency: capturedAmount.currency_code
          });
          await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [paymentId]);
          throw new AppError(409, "PAYPAL_ERROR", "The captured amount did not match the agreed deal. The order was not marked paid.");
        }
      }
      await markCompleted(paymentId, captureId, "capture");
      await audit({
        actor: { id: auth.user.id, role: "BUYER" },
        action: "paypal.captured",
        resourceType: "payment",
        resourceId: paymentId,
        metadata: { captureId }
      });
    } else if (capture.status === "PENDING") {
      await db.query(`UPDATE payments SET status = 'CAPTURE_PENDING', updated_at = NOW() WHERE id = $1`, [paymentId]);
      await db.query(`UPDATE orders SET payment_state = 'CAPTURE_PENDING', updated_at = NOW() WHERE id = $1`, [row.order_id]);
    } else {
      await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [paymentId]);
      await db.query(
        `UPDATE orders SET status = 'FAILED', payment_state = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [row.order_id]
      );
      throw new AppError(402, "PAYPAL_ERROR", `PayPal did not complete the capture (status: ${capture.status}).`);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    const reconciled = await reconcilePayPal(String(row.provider_order_id), paymentId).catch(() => false);
    if (!reconciled) {
      logger.error("paypal_capture_failed", {
        paymentId,
        message: error.message,
        debugId: error instanceof PayPalError ? error.debugId : void 0
      });
      await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND status <> 'COMPLETED'`, [
        paymentId
      ]);
      throw new AppError(
        502,
        "PAYPAL_ERROR",
        error instanceof PayPalError ? error.message : "PayPal could not capture the payment. No payment was marked complete.",
        { debugId: error instanceof PayPalError ? error.debugId : void 0 }
      );
    }
  }
  const fresh = await loadPaymentRow(paymentId);
  return paymentResponse(fresh);
}
async function reconcilePayPal(paypalOrderId, paymentId) {
  const order = await getPayPalOrder(paypalOrderId);
  if (order.status === "COMPLETED") {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (capture) {
      await markCompleted(paymentId, capture.id, "reconcile");
      return true;
    }
  }
  return false;
}
async function getPaymentStatus(paymentId, auth, reconcile = false) {
  let row = await loadPaymentRow(paymentId);
  if (!canAccessOrder(row, auth)) throw forbidden("You do not have access to this payment.");
  if (reconcile && row.provider === "PAYPAL" && row.status !== "COMPLETED" && row.provider_order_id) {
    try {
      await reconcilePayPal(String(row.provider_order_id), paymentId);
      row = await loadPaymentRow(paymentId);
    } catch (error) {
      logger.warn("paypal_reconcile_failed", { paymentId, message: error.message });
    }
  }
  return paymentResponse(row);
}
async function getOrder(orderId, auth) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  if (!rows[0]) throw notFound("Order not found");
  if (!canAccessOrder(rows[0], auth)) throw forbidden("You do not have access to this order.");
  const paymentRows = await db.query(`SELECT * FROM payments WHERE order_id = $1`, [orderId]);
  return {
    ...mapOrderRow(rows[0]),
    payment: paymentRows[0] ? mapPayment(paymentRows[0]) : null
  };
}
async function listOrders(auth, filters) {
  const db = await getDb();
  const where = [];
  const params = [];
  if (auth.buyer) {
    params.push(auth.buyer.id);
    where.push(`o.buyer_id = $${params.length}`);
  } else if (auth.seller) {
    params.push(auth.seller.id);
    where.push(`o.seller_id = $${params.length}`);
  } else {
    where.push("1=0");
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`o.status = $${params.length}`);
  }
  if (filters.market) {
    params.push(filters.market);
    where.push(`o.market_type = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(o.id) LIKE $${params.length} OR LOWER(bu.name) LIKE $${params.length} OR LOWER(p.name) LIKE $${params.length})`);
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const rows = await db.query(
    `${ORDER_SELECT} WHERE ${where.join(" AND ")} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const count = await db.query(
    `SELECT COUNT(*)::text AS count FROM orders o
     JOIN deals d ON d.id = o.deal_id JOIN negotiations n ON n.id = d.negotiation_id
     JOIN buyers b ON b.id = o.buyer_id JOIN users bu ON bu.id = b.user_id
     JOIN products p ON p.id = n.product_id
     WHERE ${where.join(" AND ")}`,
    params
  );
  return {
    orders: rows.map((row) => {
      const payment = void 0;
      void payment;
      return mapOrderRow(row);
    }),
    total: Number(count[0]?.count ?? 0),
    page,
    pageSize
  };
}
async function settleDomesticOrder(orderId, auth, note) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  const row = rows[0];
  if (!row) throw notFound("Order not found");
  if (String(row.seller_user_id) !== auth.user.id) throw forbidden("Only the seller can confirm settlement.");
  if (row.payment_provider !== "MANUAL" || row.market_type !== "DOMESTIC") {
    throw conflict("Only domestic manual-settlement orders can be settled this way.");
  }
  if (!["SETTLEMENT_PENDING", "SETTLED"].includes(String(row.status))) {
    throw conflict("This order is not awaiting settlement.");
  }
  const settlementNote = note?.trim() || "Seller confirmed receipt of funds off-platform. BhavAI did not process or verify this payment.";
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE orders SET status = 'SETTLED', payment_state = 'COMPLETED', settlement_note = $1, updated_at = NOW() WHERE id = $2`,
      [settlementNote, orderId]
    );
    await tx.query(
      `UPDATE payments SET status = 'COMPLETED', payload = $1::jsonb, updated_at = NOW() WHERE order_id = $2 AND provider = 'MANUAL'`,
      [JSON.stringify({ settlement: "manual_off_platform", confirmedBy: auth.user.id, note: settlementNote }), orderId]
    );
    await tx.query(`UPDATE deals SET status = 'CONSUMED' WHERE id = $1`, [row.deal_id]);
  });
  await audit({
    actor: { id: auth.user.id, role: "SELLER" },
    action: "order.manual_settled",
    resourceType: "order",
    resourceId: orderId,
    metadata: { note: settlementNote }
  });
  return getOrder(orderId, auth);
}
async function fulfillOrder(orderId, auth) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  const row = rows[0];
  if (!row) throw notFound("Order not found");
  if (String(row.seller_user_id) !== auth.user.id) throw forbidden("Only the seller can fulfil this order.");
  if (!["PAID", "SETTLED"].includes(String(row.status))) {
    throw conflict("Only a paid or settled order can be fulfilled.");
  }
  await db.query(`UPDATE orders SET status = 'FULFILLED', updated_at = NOW() WHERE id = $1`, [orderId]);
  await audit({
    actor: { id: auth.user.id, role: "SELLER" },
    action: "order.fulfilled",
    resourceType: "order",
    resourceId: orderId
  });
  return getOrder(orderId, auth);
}
async function cancelOrder(orderId, auth, reason) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  const row = rows[0];
  if (!row) throw notFound("Order not found");
  if (!canAccessOrder(row, auth)) throw forbidden("You do not have access to this order.");
  if (["PAID", "SETTLED", "FULFILLED"].includes(String(row.status))) {
    throw conflict("A paid order cannot be cancelled here. Refund handling is out of scope for this Sandbox build.");
  }
  await db.transaction(async (tx) => {
    const locked = await tx.query(
      `UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'ACCEPTED' RETURNING agreed_quantity`,
      [row.deal_id]
    );
    if (locked[0]) {
      await tx.query(`UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`, [
        toNumber(locked[0].agreed_quantity),
        row.product_id
      ]);
    }
    await tx.query(
      `UPDATE orders SET status = 'CANCELLED', payment_state = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
    await tx.query(`UPDATE payments SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1 AND status <> 'COMPLETED'`, [
      orderId
    ]);
    await tx.query(
      `UPDATE negotiations SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 AND status IN ('AGREED','AWAITING_APPROVAL','OPEN')`,
      [row.negotiation_id]
    );
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: "order.cancelled",
    resourceType: "order",
    resourceId: orderId,
    metadata: { reason: reason ?? null }
  });
  return getOrder(orderId, auth);
}
async function handlePayPalWebhookEvent(event, processing) {
  const db = await getDb();
  const resource = event.resource ?? {};
  if (processing !== "PROCESSED") {
    await db.query(
      `UPDATE webhook_events SET processing_status = $1, processed_at = NOW() WHERE provider = 'PAYPAL' AND provider_event_id = $2`,
      [processing, event.id]
    );
    return;
  }
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    const paypalOrderId = resource.id ? String(resource.id) : null;
    if (paypalOrderId) {
      await db.query(
        `UPDATE payments SET status = 'APPROVED', updated_at = NOW() WHERE provider_order_id = $1 AND status IN ('CREATED','APPROVAL_PENDING')`,
        [paypalOrderId]
      );
      await db.query(
        `UPDATE orders SET payment_state = 'APPROVED', updated_at = NOW()
         WHERE id IN (SELECT order_id FROM payments WHERE provider_order_id = $1) AND status = 'APPROVAL_PENDING'`,
        [paypalOrderId]
      );
    }
  }
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const supplementary = resource.supplementary_data;
    const relatedOrderId = supplementary?.related_ids?.order_id ? String(supplementary.related_ids.order_id) : null;
    const captureId = resource.id ? String(resource.id) : null;
    const amountObj = resource.amount;
    if (!relatedOrderId) throw new Error("Capture event has no related order id");
    const rows = await db.query(`SELECT * FROM payments WHERE provider_order_id = $1`, [relatedOrderId]);
    const payment = rows[0];
    if (!payment) throw new Error("No local payment matches the captured PayPal order");
    if (amountObj?.value !== void 0) {
      const received = Number(amountObj.value);
      if (amountObj.currency_code !== payment.currency || Math.abs(received - toNumber(payment.amount)) > 5e-3) {
        throw new Error("Captured amount did not match the local payment");
      }
    }
    await markCompleted(String(payment.id), captureId, "webhook");
  }
  if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
    const supplementary = resource.supplementary_data;
    const relatedOrderId = supplementary?.related_ids?.order_id ? String(supplementary.related_ids.order_id) : null;
    if (relatedOrderId) {
      const rows = await db.query(
        `SELECT p.order_id FROM payments p WHERE p.provider_order_id = $1`,
        [relatedOrderId]
      );
      if (rows[0]) {
        await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE provider_order_id = $1`, [relatedOrderId]);
        await db.query(`UPDATE orders SET status = 'FAILED', payment_state = 'FAILED', updated_at = NOW() WHERE id = $1`, [
          rows[0].order_id
        ]);
      }
    }
  }
  await db.query(
    `UPDATE webhook_events SET processing_status = 'PROCESSED', processed_at = NOW() WHERE provider = 'PAYPAL' AND provider_event_id = $1`,
    [event.id]
  );
}

// src/routes/payments.ts
var paymentsRouter = Router8();
paymentsRouter.use(optionalAuth);
paymentsRouter.post("/deals/:negotiationId", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const origin = typeof req.body?.origin === "string" && /^https?:\/\//.test(req.body.origin) ? req.body.origin.replace(/\/$/, "") : req.get("origin") || req.get("referer")?.replace(/\/[^/]*$/, "") || req.protocol + "://" + req.get("host");
    const result = await createPaymentForDeal(pathParam(req, "negotiationId"), auth, origin);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});
paymentsRouter.post("/:id/capture", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const result = await capturePayment(pathParam(req, "id"), auth);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
paymentsRouter.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const reconcile = req.query.reconcile === "true";
    const result = await getPaymentStatus(pathParam(req, "id"), auth, reconcile);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// src/routes/orders.ts
import { Router as Router9 } from "express";
var ordersRouter = Router9();
ordersRouter.use(optionalAuth);
ordersRouter.get("/", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const result = await listOrders(auth, {
      status: typeof req.query.status === "string" ? req.query.status : void 0,
      market: typeof req.query.market === "string" ? req.query.market : void 0,
      search: typeof req.query.search === "string" ? req.query.search : void 0,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
ordersRouter.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const order = await getOrder(pathParam(req, "id"), auth);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});
ordersRouter.post("/:id/settle", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const note = typeof req.body?.note === "string" ? req.body.note : void 0;
    const order = await settleDomesticOrder(pathParam(req, "id"), auth, note);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});
ordersRouter.post("/:id/fulfil", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const order = await fulfillOrder(pathParam(req, "id"), auth);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});
ordersRouter.post("/:id/cancel", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : void 0;
    const order = await cancelOrder(pathParam(req, "id"), auth, reason);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});

// src/routes/dashboard.ts
import { Router as Router10 } from "express";
var dashboardRouter = Router10();
dashboardRouter.use(optionalAuth);
dashboardRouter.get("/analytics", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const [analytics, negotiations, products, transactions] = await Promise.all([
      getSellerAnalytics(auth.seller),
      getNegotiationRows(auth.seller.id),
      getProductPerformance(auth.seller.id),
      getTransactionRows(auth.seller.id)
    ]);
    res.json({
      data: {
        analytics,
        negotiations,
        products,
        transactions,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        agentMode: analytics.aiSummary.mode,
        llmConfigured: env.gemini.configured,
        currency: auth.seller.currency
      }
    });
  } catch (error) {
    next(error);
  }
});
dashboardRouter.get("/negotiations", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { rows: await getNegotiationRows(auth.seller.id) } });
  } catch (error) {
    next(error);
  }
});
dashboardRouter.get("/products", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { rows: await getProductPerformance(auth.seller.id) } });
  } catch (error) {
    next(error);
  }
});
dashboardRouter.get("/transactions", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { rows: await getTransactionRows(auth.seller.id) } });
  } catch (error) {
    next(error);
  }
});

// src/routes/developer.ts
import { Router as Router11 } from "express";
import { z as z4 } from "zod";

// src/services/apiKeys.ts
function mapKey(row) {
  return {
    id: String(row.id),
    label: String(row.label),
    prefix: String(row.prefix),
    role: row.role,
    createdAt: toIso(row.created_at),
    lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : null,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : null
  };
}
async function listApiKeys(userId) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM api_keys WHERE user_id = $1 ORDER BY revoked_at NULLS FIRST, created_at DESC`,
    [userId]
  );
  return rows.map(mapKey);
}
async function createApiKey(input) {
  const db = await getDb();
  const generated = apiKey();
  const id = newId();
  await db.query(
    `INSERT INTO api_keys (id, user_id, label, key_hash, prefix, role) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.userId, input.label.trim().slice(0, 80), generated.hash, generated.prefix, input.role]
  );
  const rows = await db.query(`SELECT * FROM api_keys WHERE id = $1`, [id]);
  await audit({
    actor: { id: input.userId, role: input.role },
    action: "api_key.created",
    resourceType: "api_key",
    resourceId: id,
    metadata: { prefix: generated.prefix, label: input.label }
  });
  return { key: mapKey(rows[0]), secret: generated.raw };
}
async function revokeApiKey(userId, keyId) {
  const db = await getDb();
  const rows = await db.query(
    `UPDATE api_keys SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING *`,
    [keyId, userId]
  );
  if (!rows[0]) throw notFound("API key not found");
  await audit({
    actor: { id: userId, role: null },
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: keyId
  });
  return mapKey(rows[0]);
}

// src/mcp/catalog.ts
var MCP_TOOL_CATALOG = [
  /* Buyer tools */
  {
    name: "search_products",
    title: "Search products in the agent-readable market",
    description: "Search published BhavAI storefronts by keywords, category, currency, country, quantity and total budget.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "search_market",
    title: "Search the agent-readable market",
    description: "Search published BhavAI storefronts by product keywords, category, currency, country, quantity and total budget.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "get_product_details",
    title: "Read storefront product details",
    description: "Return one published product with its seller, stock, bulk tiers and public negotiation terms. Confidential floor prices are never returned.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "get_product",
    title: "Read a storefront product",
    description: "Return one published product with its seller, stock, bulk tiers and public negotiation terms. Confidential floor prices are never returned.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "start_negotiation",
    title: "Open a negotiation",
    description: "Open a buyer-agent negotiation for a product and quantity. Every price is validated by the deterministic pricing engine.",
    audience: "BUYER",
    invocation: "write"
  },
  {
    name: "get_negotiation",
    title: "Read a negotiation",
    description: "Return the full offer history, deal, order and public policy facts for a negotiation.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "get_negotiation_status",
    title: "Read negotiation status",
    description: "Retrieve current status, round count, latest offer and agreed deal summary for a negotiation.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "get_deal_details",
    title: "Read deal details",
    description: "Read the agreed price, quantity, total amount, currency and confirmation status for an accepted negotiation.",
    audience: "BUYER",
    invocation: "read-only"
  },
  {
    name: "advance_negotiation",
    title: "Advance one agent turn",
    description: "Ask the next agent (buyer or seller) to move once. Decisions are made by policy, not by the language model.",
    audience: "BUYER",
    invocation: "write"
  },
  {
    name: "submit_offer",
    title: "Submit a buyer offer",
    description: "Submit an explicit buyer unit price. The seller agent answers on the next turn or advance call.",
    audience: "BUYER",
    invocation: "write"
  },
  {
    name: "revise_offer",
    title: "Revise an existing offer",
    description: "Submit a revised unit price and message for an ongoing open negotiation.",
    audience: "BUYER",
    invocation: "write"
  },
  /* Seller tools */
  {
    name: "evaluate_offer",
    title: "Evaluate an offer against rules",
    description: "Evaluate an offered price and quantity against seller rules deterministically without exposing private floor prices.",
    audience: "SELLER",
    invocation: "read-only"
  },
  {
    name: "generate_counteroffer",
    title: "Generate policy counteroffer",
    description: "Generate the next counteroffer position adhering to target discount and confidential floor constraints.",
    audience: "SELLER",
    invocation: "write"
  },
  {
    name: "check_inventory",
    title: "Check inventory availability",
    description: "Check whether sufficient stock is available to satisfy an order quantity.",
    audience: "SELLER",
    invocation: "read-only"
  },
  {
    name: "list_products",
    title: "List seller products",
    description: "List your own catalog with stock and status. Requires a seller API key.",
    audience: "SELLER",
    invocation: "read-only"
  },
  {
    name: "get_product_rules",
    title: "Read confidential pricing rules",
    description: "Return your own product rules, including floor and minimum allowed prices. Seller API keys only.",
    audience: "SELLER",
    invocation: "read-only"
  },
  {
    name: "update_product_rules",
    title: "Update pricing rules",
    description: "Replace the negotiation rules for one of your products. Bounded and validated server-side.",
    audience: "SELLER",
    invocation: "write"
  },
  {
    name: "list_negotiations",
    title: "List negotiations",
    description: "List negotiations visible to the authenticated seller or buyer.",
    audience: "SELLER",
    invocation: "read-only"
  },
  {
    name: "accept_offer",
    title: "Accept or approve deal",
    description: "Approve a deal held for seller approval. Stock is reserved atomically at approval.",
    audience: "SELLER",
    invocation: "write"
  },
  {
    name: "approve_deal",
    title: "Approve a pending deal",
    description: "Approve a deal that was held for seller approval. Stock is reserved atomically at approval.",
    audience: "SELLER",
    invocation: "write"
  },
  {
    name: "reject_offer",
    title: "Reject a negotiation",
    description: "Close an open negotiation or pending deal with an explicit reason.",
    audience: "SELLER",
    invocation: "write"
  },
  /* Commerce tools */
  {
    name: "list_orders",
    title: "List orders",
    description: "List orders visible to the authenticated account, with payment and settlement state.",
    audience: "COMMERCE",
    invocation: "read-only"
  },
  {
    name: "get_order",
    title: "Read an order",
    description: "Read one order including its payment record and honest settlement note.",
    audience: "COMMERCE",
    invocation: "read-only"
  },
  {
    name: "get_order_status",
    title: "Read order status",
    description: "Read the latest fulfillment and payment state for an order.",
    audience: "COMMERCE",
    invocation: "read-only"
  },
  {
    name: "create_payment_order",
    title: "Create payment order",
    description: "Create payment order for an agreed deal. India domestic settles off-platform; cross-border uses PayPal Sandbox.",
    audience: "COMMERCE",
    invocation: "write"
  },
  {
    name: "create_payment",
    title: "Create a payment",
    description: "Create the server-authoritative payment for an agreed, buyer-confirmed deal. Domestic India deals use manual settlement.",
    audience: "COMMERCE",
    invocation: "write"
  },
  {
    name: "get_payment_status",
    title: "Read payment status",
    description: "Read payment state, optionally reconciling against PayPal. Amounts are always compared to the deal.",
    audience: "COMMERCE",
    invocation: "read-only"
  }
];

// src/routes/developer.ts
var developerRouter = Router11();
developerRouter.use(optionalAuth);
developerRouter.get("/integrations", optionalAuth, async (req, res, next) => {
  try {
    requireAuth(req);
    const db = await getDb();
    const snapshot = integrationSnapshot();
    const status = {
      database: { mode: db.mode, label: db.label, ok: true },
      gemini: { ...snapshot.gemini, lastCheck: null },
      paypal: snapshot.paypal,
      mcp: {
        enabled: true,
        path: "/mcp",
        authenticated: Boolean(env.mcpApiKey),
        toolCount: MCP_TOOL_CATALOG.length
      },
      channel3: {
        configured: snapshot.channel3.configured,
        note: snapshot.channel3.configured ? "Channel3 product enrichment is configured." : "Optional. Channel3 enrichment is not configured; catalog data comes from the seller."
      },
      email: {
        configured: false,
        note: "No transactional email provider is configured. Password-reset links are created but not emailed; the development link is returned in non-production only."
      }
    };
    res.json({ data: { integrations: status, environment: env.nodeEnv, apiBaseUrl: env.apiBaseUrl, mcpEndpoint: `${env.apiBaseUrl}/mcp` } });
  } catch (error) {
    next(error);
  }
});
developerRouter.get("/tools", optionalAuth, async (req, res, next) => {
  try {
    requireAuth(req);
    res.json({
      data: {
        tools: MCP_TOOL_CATALOG,
        endpoint: `${env.apiBaseUrl}/mcp`,
        protocolVersion: "2025-06-18",
        auth: "Authorization: Bearer bvk_\u2026 (create a key below) or x-bhavai-key"
      }
    });
  } catch (error) {
    next(error);
  }
});
developerRouter.get("/keys", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    res.json({ data: { keys: await listApiKeys(auth.user.id) } });
  } catch (error) {
    next(error);
  }
});
developerRouter.post("/keys", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const input = parseWith(
      z4.object({ label: z4.string().trim().min(2, "Add a label so you can recognise this key").max(80) }),
      req.body
    );
    const { key, secret: secret2 } = await createApiKey({ userId: auth.user.id, role: auth.user.role, label: input.label });
    res.status(201).json({
      data: {
        key,
        secret: secret2,
        warning: "Copy this key now. It is shown once and cannot be recovered."
      }
    });
  } catch (error) {
    next(error);
  }
});
developerRouter.delete("/keys/:id", optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const key = await revokeApiKey(auth.user.id, pathParam(req, "id"));
    res.json({ data: { key } });
  } catch (error) {
    next(error);
  }
});
developerRouter.post("/test/paypal", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    requireAuth(req);
    if (!env.paypal.configured) {
      res.status(503).json({
        error: {
          code: "PAYPAL_NOT_CONFIGURED",
          message: "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set. No PayPal request was made.",
          requestId: req.requestId
        }
      });
      return;
    }
    await getAccessToken(true);
    res.json({
      data: {
        ok: true,
        environment: env.paypal.environment,
        message: "PayPal Sandbox OAuth succeeded. This checked credentials only; it did not move money."
      }
    });
  } catch (error) {
    next(error);
  }
});
developerRouter.post("/test/gemini", writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    requireAuth(req);
    const result = await geminiPing();
    if (!env.gemini.configured) {
      res.status(503).json({
        error: {
          code: "LLM_UNAVAILABLE",
          message: result.message,
          requestId: req.requestId
        }
      });
      return;
    }
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// src/routes/webhooks.ts
import { Router as Router12 } from "express";
var webhooksRouter = Router12();
webhooksRouter.post("/paypal", async (req, res, next) => {
  try {
    if (!env.paypal.webhookConfigured) {
      res.status(503).json({
        error: {
          code: "PAYPAL_NOT_CONFIGURED",
          message: "PayPal webhooks are not configured: set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID.",
          requestId: req.requestId
        }
      });
      return;
    }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Webhook body is not valid JSON.", requestId: req.requestId }
      });
      return;
    }
    if (!event.id || !event.event_type) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Webhook event is missing id or event_type.", requestId: req.requestId }
      });
      return;
    }
    const verified = await verifyPayPalWebhook(req.headers, event);
    if (!verified) {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Webhook signature verification failed. The event was not processed.",
          requestId: req.requestId
        }
      });
      return;
    }
    const db = await getDb();
    const existing = await db.query(
      `SELECT id, processing_status FROM webhook_events WHERE provider = 'PAYPAL' AND provider_event_id = $1`,
      [event.id]
    );
    if (existing[0]) {
      if (String(existing[0].processing_status) === "FAILED") {
        await db.query(
          `UPDATE webhook_events SET processing_status = 'RECEIVED', payload = $1::jsonb WHERE id = $2`,
          [raw, existing[0].id]
        );
      } else {
        res.json({ data: { received: true, duplicate: true, eventId: event.id } });
        return;
      }
    } else {
      await db.query(
        `INSERT INTO webhook_events (id, provider, provider_event_id, event_type, payload, processing_status)
         VALUES ($1, 'PAYPAL', $2, $3, $4::jsonb, 'RECEIVED')`,
        [newId(), event.id, event.event_type, raw]
      );
    }
    try {
      await handlePayPalWebhookEvent(
        { id: event.id, event_type: event.event_type, resource: event.resource },
        "PROCESSED"
      );
    } catch (error) {
      logger.error("paypal_webhook_processing_failed", {
        eventId: event.id,
        eventType: event.event_type,
        message: error.message
      });
      await handlePayPalWebhookEvent(
        { id: event.id, event_type: event.event_type, resource: event.resource },
        "FAILED"
      ).catch(() => void 0);
      res.status(500).json({
        error: {
          code: "INTERNAL",
          message: "The verified event could not be applied. PayPal may retry it.",
          requestId: req.requestId
        }
      });
      return;
    }
    res.json({ data: { received: true, eventId: event.id, processedAt: toIso(/* @__PURE__ */ new Date()) } });
  } catch (error) {
    next(error);
  }
});

// src/mcp/server.ts
import { Router as Router13 } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// src/mcp/tools.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as z5 } from "zod";
function ok(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data
  };
}
function fail(error) {
  const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "The tool could not complete.";
  return {
    content: [{ type: "text", text: `BhavAI error: ${message}` }],
    structuredContent: { error: message },
    isError: true
  };
}
function requireBuyerContext(auth) {
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Connect with a buyer API key to use this tool.");
  if (!auth.buyer) throw new AppError(403, "FORBIDDEN", "This API key belongs to a seller. Use a buyer key for negotiation tools.");
  return auth;
}
function requireSellerContext(auth) {
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Connect with a seller API key to use this tool.");
  if (!auth.seller) throw new AppError(403, "FORBIDDEN", "This API key belongs to a buyer. Use a seller key for seller tools.");
  return auth;
}
function requireAnyAuth(auth) {
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Connect with a BhavAI API key to use this tool.");
  return auth;
}
function createMcpServer(auth) {
  const server2 = new McpServer(
    { name: "bhavai-commerce", version: "1.0.0" },
    {
      instructions: "BhavAI exposes agent-readable storefronts and policy-bounded negotiation. Confidential floor prices are never returned. All prices, stock checks, acceptances and payment amounts are decided server-side by deterministic rules. Domestic India orders settle manually off-platform; cross-border orders use PayPal Sandbox."
    }
  );
  const handleSearchMarket = async (args) => {
    try {
      const result = await searchMarket({
        search: args.query,
        category: args.category,
        currency: args.currency,
        country: args.country,
        quantity: args.quantity,
        maxTotal: args.maxTotal,
        inStock: true,
        pageSize: args.pageSize ?? 12
      });
      return ok({
        products: result.products,
        total: result.total,
        query: result.query,
        note: "Listed prices are not offers. Use start_negotiation to ask for a price inside the seller rules."
      });
    } catch (error) {
      return fail(error);
    }
  };
  const searchSchema = {
    query: z5.string().trim().max(200).optional().describe("Product keywords"),
    category: z5.enum(CATEGORIES).optional(),
    currency: z5.enum(["USD", "INR", "EUR", "GBP", "AED"]).optional(),
    country: z5.string().length(2).optional().describe("Seller country code"),
    quantity: z5.number().int().positive().max(1e5).optional(),
    maxTotal: z5.number().positive().optional().describe("Buyer total budget in the search currency"),
    pageSize: z5.number().int().min(1).max(40).optional()
  };
  server2.registerTool(
    "search_products",
    {
      title: "Search products in the agent-readable market",
      description: "Search published BhavAI storefronts. Returns public products with seller, stock, bulk tiers and public negotiation terms.",
      inputSchema: searchSchema,
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    handleSearchMarket
  );
  server2.registerTool(
    "search_market",
    {
      title: "Search the agent-readable market",
      description: "Search published BhavAI storefronts. Returns public products with seller, stock, bulk tiers and public negotiation terms. No confidential pricing is exposed.",
      inputSchema: searchSchema,
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    handleSearchMarket
  );
  const handleGetProduct = async (args) => {
    try {
      return ok({ product: await getPublicProduct(args.productId) });
    } catch (error) {
      return fail(error);
    }
  };
  server2.registerTool(
    "get_product_details",
    {
      title: "Read storefront product details",
      description: "Return one published product, its seller and public negotiation terms. Confidential floor prices are never included.",
      inputSchema: { productId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    handleGetProduct
  );
  server2.registerTool(
    "get_product",
    {
      title: "Read a storefront product",
      description: "Return one published product, its seller and public negotiation terms. Confidential floor prices are never included.",
      inputSchema: { productId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    handleGetProduct
  );
  server2.registerTool(
    "start_negotiation",
    {
      title: "Open a negotiation",
      description: "Open a buyer-agent negotiation for a product and quantity. Optionally state a total budget and an opening unit price. The deterministic engine validates everything.",
      inputSchema: {
        productId: z5.string().min(1),
        quantity: z5.number().int().positive().max(1e5),
        budgetTotal: z5.number().positive().nullable().optional(),
        unitPrice: z5.number().positive().optional(),
        message: z5.string().trim().max(600).optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async (args) => {
      try {
        const buyerAuth = requireBuyerContext(auth);
        const negotiation = await createNegotiation(buyerAuth, {
          productId: args.productId,
          quantity: args.quantity,
          budgetTotal: args.budgetTotal ?? null,
          unitPrice: args.unitPrice,
          message: args.message ?? ""
        });
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "get_negotiation",
    {
      title: "Read a negotiation",
      description: "Return offer history, deal, order and public policy facts for a negotiation.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const negotiation = await getNegotiationDetail(args.negotiationId, requireAnyAuth(auth));
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "get_negotiation_status",
    {
      title: "Read negotiation status",
      description: "Retrieve current status, round count, latest offer and agreed deal summary for a negotiation.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const negotiation = await getNegotiationDetail(args.negotiationId, requireAnyAuth(auth));
        return ok({
          negotiationId: negotiation.id,
          status: negotiation.status,
          round: negotiation.roundsUsed,
          maxRounds: negotiation.maxRounds,
          currentOffer: negotiation.currentOffer,
          deal: negotiation.deal,
          currency: negotiation.currency
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "get_deal_details",
    {
      title: "Read deal details",
      description: "Read the agreed price, quantity, total amount, currency and confirmation status for an accepted negotiation.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const negotiation = await getNegotiationDetail(args.negotiationId, requireAnyAuth(auth));
        if (!negotiation.deal) {
          return ok({ hasDeal: false, message: "No agreed deal yet for this negotiation." });
        }
        return ok({ hasDeal: true, deal: negotiation.deal, marketType: negotiation.marketType });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "advance_negotiation",
    {
      title: "Advance one agent turn",
      description: "Ask the next agent to move exactly once. Buyer and seller agents alternate; the policy engine decides and the database commits atomically.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const negotiation = await runNegotiationStep(args.negotiationId, requireAnyAuth(auth));
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "submit_offer",
    {
      title: "Submit a human counteroffer",
      description: "Submit an explicit buyer unit price for an open negotiation. The seller agent responds on the next advance_negotiation call.",
      inputSchema: {
        negotiationId: z5.string().min(1),
        unitPrice: z5.number().positive(),
        message: z5.string().trim().max(600).optional()
      },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const buyerAuth = requireBuyerContext(auth);
        const detail = await getNegotiationDetail(args.negotiationId, buyerAuth);
        const negotiation = await submitBuyerOffer(args.negotiationId, buyerAuth, {
          unitPrice: args.unitPrice,
          quantity: detail.quantity,
          message: args.message ?? ""
        });
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "revise_offer",
    {
      title: "Revise an existing offer",
      description: "Submit a revised unit price and message for an ongoing open negotiation.",
      inputSchema: {
        negotiationId: z5.string().min(1),
        unitPrice: z5.number().positive(),
        message: z5.string().trim().max(600).optional()
      },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const buyerAuth = requireBuyerContext(auth);
        const detail = await getNegotiationDetail(args.negotiationId, buyerAuth);
        const negotiation = await submitBuyerOffer(args.negotiationId, buyerAuth, {
          unitPrice: args.unitPrice,
          quantity: detail.quantity,
          message: args.message ?? ""
        });
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "list_products",
    {
      title: "List seller products",
      description: "List your own catalog with prices, stock and status.",
      inputSchema: {
        search: z5.string().trim().max(120).optional(),
        status: z5.enum(["active", "inactive", "out"]).optional()
      },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const result = await listSellerProducts(sellerAuth.seller.id, {
          search: args.search,
          status: args.status,
          pageSize: 100
        });
        return ok({ products: result.products, total: result.total });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "get_product_rules",
    {
      title: "Read confidential pricing rules",
      description: "Return your own product rules, including the floor and minimum allowed price. Seller API keys only.",
      inputSchema: { productId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const rules = await getRulesForProduct(sellerAuth.seller.id, args.productId);
        const db = await getDb();
        const rows = await db.query(
          `SELECT listed_price, currency FROM products WHERE id = $1 AND seller_id = $2`,
          [args.productId, sellerAuth.seller.id]
        );
        return ok({
          rules,
          listedPrice: roundMoney(Number(rows[0]?.listed_price ?? 0)),
          currency: String(rows[0]?.currency ?? sellerAuth.seller.currency),
          confidentiality: "These values are seller-only and are never returned by buyer-facing tools."
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "update_product_rules",
    {
      title: "Update pricing rules",
      description: "Replace the negotiation rules for one of your products. The server validates consistency with the listed price and marks the rules as seller-confirmed.",
      inputSchema: {
        productId: z5.string().min(1),
        rules: RulesInput
      },
      annotations: { readOnlyHint: false, destructiveHint: true }
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
    }
  );
  server2.registerTool(
    "list_negotiations",
    {
      title: "List negotiations",
      description: "List negotiations visible to the authenticated seller or buyer, newest first.",
      inputSchema: {
        status: z5.enum(["OPEN", "AWAITING_APPROVAL", "AGREED", "REJECTED", "CANCELLED", "EXPIRED"]).optional(),
        pageSize: z5.number().int().min(1).max(100).optional()
      },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const result = await listNegotiations(requireAnyAuth(auth), {
          status: args.status,
          pageSize: args.pageSize ?? 25
        });
        return ok(result);
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "evaluate_offer",
    {
      title: "Evaluate an offer against rules",
      description: "Evaluate an offered price and quantity against seller rules deterministically without exposing private floor prices.",
      inputSchema: {
        productId: z5.string().min(1),
        unitPrice: z5.number().positive(),
        quantity: z5.number().int().positive()
      },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const [rules, product] = await Promise.all([
          getRulesForProduct(sellerAuth.seller.id, args.productId),
          getSellerProduct(sellerAuth.seller.id, args.productId)
        ]);
        const policy = policyFromRules(rules, product);
        const check = validateOffer({
          unitPrice: args.unitPrice,
          quantity: args.quantity,
          stock: product.stock,
          policy
        });
        return ok({
          valid: check.valid,
          code: check.code,
          message: check.message,
          discountPercent: check.discountPercent,
          total: check.total,
          quantity: check.quantity,
          unitPrice: check.unitPrice
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "generate_counteroffer",
    {
      title: "Generate policy counteroffer",
      description: "Generate the next counteroffer position adhering to target discount and confidential floor constraints.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const negotiation = await runNegotiationStep(args.negotiationId, sellerAuth);
        return ok({ negotiation });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "check_inventory",
    {
      title: "Check inventory availability",
      description: "Check whether sufficient stock is available to satisfy an order quantity.",
      inputSchema: {
        productId: z5.string().min(1),
        quantity: z5.number().int().positive()
      },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const product = await getPublicProduct(args.productId);
        const available = product.stock >= args.quantity;
        return ok({
          productId: product.id,
          requestedQuantity: args.quantity,
          availableStock: product.stock,
          sufficient: available,
          inStock: product.stock > 0
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "accept_offer",
    {
      title: "Accept or approve deal",
      description: "Approve a deal held for seller approval. Stock is reserved atomically at approval.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        return ok({ negotiation: await approveDeal(args.negotiationId, sellerAuth) });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "approve_deal",
    {
      title: "Approve a pending deal",
      description: "Approve a deal held for seller approval. Stock is reserved atomically; approval fails if stock is insufficient.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        return ok({ negotiation: await approveDeal(args.negotiationId, sellerAuth) });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "reject_offer",
    {
      title: "Reject a negotiation",
      description: "Close an open negotiation or pending deal with an explicit reason.",
      inputSchema: {
        negotiationId: z5.string().min(1),
        reason: z5.string().trim().max(300).optional()
      },
      annotations: { readOnlyHint: false }
    },
    async (args) => {
      try {
        const sellerAuth = requireSellerContext(auth);
        const negotiation = await rejectNegotiation(args.negotiationId, sellerAuth, args.reason);
        return ok({ negotiation, rejected: true });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "list_orders",
    {
      title: "List orders",
      description: "List orders visible to the authenticated account with payment and settlement state.",
      inputSchema: {
        status: z5.enum(["PENDING_PAYMENT", "APPROVAL_PENDING", "PAID", "SETTLEMENT_PENDING", "SETTLED", "FULFILLED", "CANCELLED", "FAILED"]).optional(),
        market: z5.enum(["DOMESTIC", "CROSS_BORDER"]).optional(),
        pageSize: z5.number().int().min(1).max(100).optional()
      },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const result = await listOrders(requireAnyAuth(auth), {
          status: args.status,
          market: args.market,
          pageSize: args.pageSize ?? 25
        });
        return ok(result);
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "get_order",
    {
      title: "Read an order",
      description: "Read one order including its payment record and honest settlement note.",
      inputSchema: { orderId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        return ok({ order: await getOrder(args.orderId, requireAnyAuth(auth)) });
      } catch (error) {
        return fail(error);
      }
    }
  );
  server2.registerTool(
    "get_order_status",
    {
      title: "Read order status",
      description: "Read the latest fulfillment and payment state for an order.",
      inputSchema: { orderId: z5.string().min(1) },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        const order = await getOrder(args.orderId, requireAnyAuth(auth));
        return ok({
          orderId: order.id,
          status: order.status,
          paymentState: order.paymentState,
          paymentProvider: order.paymentProvider,
          settlementNote: order.settlementNote,
          totalAmount: order.totalAmount,
          currency: order.currency
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
  const handleCreatePayment = async (args) => {
    try {
      const buyerAuth = requireBuyerContext(auth);
      const result = await createPaymentForDeal(args.negotiationId, buyerAuth, env.appUrl);
      return ok({
        ...result,
        amountDisplay: formatMoney(result.payment.amount, result.payment.currency)
      });
    } catch (error) {
      return fail(error);
    }
  };
  server2.registerTool(
    "create_payment_order",
    {
      title: "Create payment order",
      description: "Create payment order for an agreed deal. India domestic settles off-platform; cross-border uses PayPal Sandbox.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    handleCreatePayment
  );
  server2.registerTool(
    "create_payment",
    {
      title: "Create a payment",
      description: "Create the server-authoritative payment for an agreed, buyer-confirmed deal. Domestic India orders become manual-settlement orders. Cross-border orders use PayPal Sandbox and fail honestly if it is not configured.",
      inputSchema: { negotiationId: z5.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    handleCreatePayment
  );
  server2.registerTool(
    "get_payment_status",
    {
      title: "Read payment status",
      description: "Read payment state, optionally reconciling against PayPal. Amounts are always compared with the agreed deal.",
      inputSchema: {
        paymentId: z5.string().min(1),
        reconcile: z5.boolean().optional()
      },
      annotations: { readOnlyHint: true }
    },
    async (args) => {
      try {
        return ok(await getPaymentStatus(args.paymentId, requireAnyAuth(auth), args.reconcile ?? false));
      } catch (error) {
        return fail(error);
      }
    }
  );
  return server2;
}
var MCP_TOOL_COUNT = MCP_TOOL_CATALOG.length;

// src/mcp/server.ts
var mcpRouter = Router13();
async function resolveMcpAuth(req) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const apiKeyHeader = typeof req.headers["x-bhavai-key"] === "string" ? req.headers["x-bhavai-key"] : null;
  const candidate = bearer?.startsWith("bvk_") ? bearer : apiKeyHeader?.startsWith("bvk_") ? apiKeyHeader : null;
  if (!candidate) return null;
  if (env.mcpApiKey && apiKeyHeader === env.mcpApiKey && !candidate) return null;
  return loadApiKey(candidate);
}
function serverKeyAllowed(req) {
  if (!env.mcpApiKey) return true;
  const apiKeyHeader = typeof req.headers["x-bhavai-key"] === "string" ? req.headers["x-bhavai-key"] : "";
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : "";
  return apiKeyHeader === env.mcpApiKey || bearer === env.mcpApiKey;
}
mcpRouter.all("/", async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32e3, message: "This MCP endpoint is stateless. Use POST with JSON-RPC messages." },
      id: null
    });
    return;
  }
  try {
    const auth = await resolveMcpAuth(req);
    if (!auth && !serverKeyAllowed(req)) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized. Send Authorization: Bearer bvk_\u2026 for account tools." },
        id: null
      });
      return;
    }
    const rateKey = auth?.user.id ?? req.ip ?? "anonymous";
    if (!mcpRateLimit(`mcp:${rateKey}`, 120, 6e4)) {
      res.status(429).json({
        jsonrpc: "2.0",
        error: { code: -32002, message: "MCP rate limit reached. Try again in a minute." },
        id: null
      });
      return;
    }
    const server2 = createMcpServer(auth);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: void 0,
      enableJsonResponse: true
    });
    res.on("close", () => {
      void transport.close();
      void server2.close();
    });
    await server2.connect(transport);
    await transport.handleRequest(
      req,
      res,
      req.body
    );
  } catch (error) {
    logger.error("mcp_request_failed", { message: error.message });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "MCP request failed." },
        id: null
      });
    }
  }
});

// src/index.ts
var app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!env.isProd) return callback(null, true);
      return callback(null, env.corsOrigins.includes(origin));
    },
    credentials: true,
    allowedHeaders: ["content-type", "authorization", "x-bhavai-key", "x-request-id"],
    exposedHeaders: ["x-request-id", "rate-limit", "rate-limit-policy"]
  })
);
app.use(requestId);
app.use(requestLogger);
app.use("/api/webhooks/paypal", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(cookieParser());
app.get("/health", async (req, res) => {
  let database = { ok: false, mode: "unknown", label: "unknown" };
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    database = { ok: true, mode: db.mode, label: db.label };
  } catch (error) {
    logger.error("health_database_failed", { message: error.message });
  }
  const ok2 = database.ok;
  res.status(ok2 ? 200 : 503).json({
    data: {
      status: ok2 ? "ok" : "degraded",
      service: "bhavai-api",
      version: "1.0.0",
      uptimeSeconds: Math.round(process.uptime()),
      database,
      integrations: integrationSnapshot(),
      mcp: { endpoint: "/mcp", tools: MCP_TOOL_COUNT },
      requestId: req.requestId
    }
  });
});
app.use("/api/auth", authRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/products", productsRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/public", publicRouter);
app.use("/api/buyer", buyerRouter);
app.use("/api/negotiations", negotiationsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/developer", developerRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/mcp", mcpRouter);
var hasWebBuild = fs2.existsSync(env.webDist);
if (hasWebBuild) {
  app.use(
    express.static(env.webDist, {
      index: false,
      maxAge: env.isProd ? "1h" : 0,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path2.sep}assets${path2.sep}`)) {
          res.setHeader("cache-control", "public, max-age=31536000, immutable");
        }
      }
    })
  );
  app.get(/^\/(?!api(?:\/|$)|mcp(?:\/|$)|health$).*/, (_req, res) => {
    res.sendFile(`${env.webDist}/index.html`);
  });
}
app.use(notFoundHandler);
app.use(errorHandler);
var server = null;
async function start() {
  await migrate();
  if (env.seedDemo) {
    const result = await seedDemoData();
    if (result.seeded) logger.info("demo_data_ready", { reason: "seeded" });
    else logger.info("demo_data_skipped", { reason: result.reason });
  }
  server = app.listen(env.port, () => {
    logger.info("server_started", {
      port: env.port,
      environment: env.nodeEnv,
      webBuild: hasWebBuild,
      mcp: "/mcp",
      integrations: integrationSnapshot()
    });
    if (!env.isProd) {
      console.log(`
  BhavAI API  http://localhost:${env.port}`);
      console.log(`  MCP endpoint http://localhost:${env.port}/mcp`);
      console.log(`  Web build ${hasWebBuild ? "served from apps/web/dist" : "not found \u2014 run npm run build -w @bhavai/web"}
`);
      console.log(`  Demo accounts (sample data, password ${env.seedDemo ? "BhavAI!2026" : "n/a"}):`);
      console.log("    seller@bhavai.demo  (Aaranya Crafts, USD storefront)");
      console.log("    meera@bhavai.demo   (Meera Textiles, INR storefront)");
      console.log("    alex@bhavai.demo    (US buyer)");
      console.log("    priya@bhavai.demo   (India buyer)\n");
    }
  });
}
async function shutdown(signal) {
  logger.info("shutdown", { signal });
  if (server) {
    await new Promise((resolve) => server?.close(() => resolve()));
  }
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
var isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("/src/index.ts") || process.argv[1]?.replace(/\\/g, "/").endsWith("/dist/index.js");
if (isDirectRun) {
  start().catch((error) => {
    logger.error("startup_failed", { message: error.message, stack: error.stack });
    process.exit(1);
  });
}
export {
  app,
  start
};
//# sourceMappingURL=index.js.map