// ../../packages/shared/src/index.ts
import { z } from "zod";
var Role = z.enum(["SELLER", "BUYER", "ADMIN"]);
var MarketType = z.enum(["DOMESTIC", "CROSS_BORDER"]);
var NegotiationStatus = z.enum([
  "OPEN",
  "AWAITING_APPROVAL",
  "AGREED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED"
]);
var OfferActor = z.enum(["BUYER_AGENT", "SELLER_AGENT", "BUYER", "SELLER"]);
var OfferValidation = z.enum([
  "VALID",
  "BELOW_MINIMUM",
  "ABOVE_LISTED",
  "QUANTITY_UNAVAILABLE",
  "BELOW_MIN_QUANTITY",
  "INVALID"
]);
var DealStatus = z.enum(["PENDING_APPROVAL", "ACCEPTED", "CANCELLED", "CONSUMED"]);
var OrderStatus = z.enum([
  "PENDING_PAYMENT",
  "APPROVAL_PENDING",
  "PAID",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "FULFILLED",
  "CANCELLED",
  "FAILED"
]);
var PaymentStatus = z.enum([
  "CREATED",
  "APPROVAL_PENDING",
  "APPROVED",
  "CAPTURE_PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
]);
var PaymentProvider = z.enum(["PAYPAL", "MANUAL"]);
var CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED"];
var CurrencyCode = z.enum(CURRENCIES);
var COUNTRIES = [
  { code: "IN", name: "India", currency: "INR", dial: "+91" },
  { code: "US", name: "United States", currency: "USD", dial: "+1" },
  { code: "GB", name: "United Kingdom", currency: "GBP", dial: "+44" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", dial: "+971" },
  { code: "DE", name: "Germany", currency: "EUR", dial: "+49" },
  { code: "FR", name: "France", currency: "EUR", dial: "+33" },
  { code: "NL", name: "Netherlands", currency: "EUR", dial: "+31" },
  { code: "SG", name: "Singapore", currency: "USD", dial: "+65" },
  { code: "AU", name: "Australia", currency: "USD", dial: "+61" },
  { code: "CA", name: "Canada", currency: "USD", dial: "+1" },
  { code: "JP", name: "Japan", currency: "USD", dial: "+81" },
  { code: "ZA", name: "South Africa", currency: "USD", dial: "+27" }
];
function resolveMarket(sellerCountry, buyerCountry) {
  return sellerCountry === "IN" && buyerCountry === "IN" ? "DOMESTIC" : "CROSS_BORDER";
}
var CURRENCY_META = {
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  INR: { symbol: "\u20B9", locale: "en-IN", decimals: 2 },
  EUR: { symbol: "\u20AC", locale: "de-DE", decimals: 2 },
  GBP: { symbol: "\xA3", locale: "en-GB", decimals: 2 },
  AED: { symbol: "AED", locale: "en-AE", decimals: 2 }
};
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function formatMoney(amount, currency, options) {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.USD;
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
    ...options
  }).format(amount);
}
function minimumAllowedPrice(policy) {
  const discountFloor = policy.listedPrice * (1 - policy.maxDiscountPercent / 100);
  return roundMoney(Math.max(policy.floorPrice, discountFloor));
}
function applicableBulkDiscount(quantity, rules) {
  return [...rules].filter((r) => quantity >= r.minimumQuantity).sort((a, b) => b.minimumQuantity - a.minimumQuantity)[0] ?? null;
}
function targetPrice(policy, quantity) {
  const min = minimumAllowedPrice(policy);
  const bulk = applicableBulkDiscount(quantity, policy.bulkDiscounts);
  if (!bulk) return policy.listedPrice;
  const discounted = policy.listedPrice * (1 - Math.min(bulk.discountPercent, policy.maxDiscountPercent) / 100);
  return roundMoney(Math.max(min, discounted));
}
var emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
var passwordSchema = z.string().min(8, "Use at least 8 characters").max(128, "Password is too long");
var SignupInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, "Enter your name").max(80),
  role: z.enum(["SELLER", "BUYER"]),
  country: z.string().length(2)
});
var LoginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password")
});
var SellerProfileInput = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(100),
  country: z.string().length(2),
  currency: CurrencyCode,
  description: z.string().trim().max(1200).optional().default(""),
  storeSlug: z.string().trim().toLowerCase().min(3, "Use at least 3 characters").max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  active: z.boolean().optional()
});
var BuyerProfileInput = z.object({
  companyName: z.string().trim().max(100).optional().default(""),
  country: z.string().length(2),
  currency: CurrencyCode,
  preferences: z.string().trim().max(600).optional().default("")
});
var ProductInput = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(140),
  description: z.string().trim().max(4e3).optional().default(""),
  sku: z.string().trim().min(2, "Enter a SKU").max(48).regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, underscore or hyphen"),
  category: z.string().trim().min(2, "Choose a category").max(60),
  images: z.array(z.string().trim().max(500)).max(6).optional().default([]),
  listedPrice: z.coerce.number().finite("Enter a price").positive("Price must be greater than zero").max(1e7),
  currency: CurrencyCode,
  stock: z.coerce.number().int("Use a whole number").min(0).max(1e6),
  unit: z.string().trim().min(1).max(20).default("piece"),
  countryOfOrigin: z.string().length(2),
  active: z.boolean().optional().default(true)
});
var BulkRuleInput = z.object({
  minimumQuantity: z.coerce.number().int().min(2).max(1e6),
  discountPercent: z.coerce.number().min(0).max(90)
});
var RulesInput = z.object({
  floorPrice: z.coerce.number().positive("Floor price must be greater than zero"),
  maxDiscountPercent: z.coerce.number().min(0).max(90),
  minimumQuantity: z.coerce.number().int().min(1).max(1e6),
  bulkDiscounts: z.array(BulkRuleInput).max(10).default([]),
  maxRounds: z.coerce.number().int().min(1).max(12).default(5),
  autoAcceptThreshold: z.coerce.number().positive().nullable().optional(),
  requireApprovalBelow: z.coerce.number().positive().nullable().optional(),
  approvalRequired: z.boolean().default(false)
});
var OfferInput = z.object({
  unitPrice: z.coerce.number().finite().positive("Enter an offer above zero"),
  quantity: z.coerce.number().int().positive(),
  message: z.string().trim().max(600).optional().default("")
});
var NegotiationCreateInput = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(1e6),
  unitPrice: z.coerce.number().finite().positive().optional(),
  budgetTotal: z.coerce.number().finite().positive().nullable().optional(),
  message: z.string().trim().max(600).optional().default(""),
  buyerCountry: z.string().length(2).optional()
});
var BuyerIntentInput = z.object({
  query: z.string().trim().min(3, "Describe what you need").max(800),
  budgetTotal: z.coerce.number().positive().nullable().optional(),
  currency: CurrencyCode.optional()
});
var CsvMapInput = z.object({
  mapping: z.record(z.string(), z.string()),
  defaultCurrency: CurrencyCode.optional(),
  defaultCountry: z.string().length(2).optional()
});
var NEGOTIATION_LABEL = {
  OPEN: "In negotiation",
  AWAITING_APPROVAL: "Awaiting seller approval",
  AGREED: "Deal agreed",
  REJECTED: "No deal",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired"
};
var CATEGORIES = [
  "Home & Decor",
  "Jewellery",
  "Textiles",
  "Handicrafts",
  "Kitchen & Dining",
  "Stationery",
  "Apparel",
  "Art",
  "Other"
];

// src/db/index.ts
import { PGlite } from "@electric-sql/pglite";
import fs2 from "fs";
import path2 from "path";
import pg from "pg";

// src/config/env.ts
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { z as z2 } from "zod";
function findRepoRoot(start = process.cwd()) {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.workspaces) return dir;
      } catch {
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}
var repoRoot = findRepoRoot();
var EnvSchema = z2.object({
  NODE_ENV: z2.enum(["development", "test", "production"]).default("development"),
  PORT: z2.coerce.number().int().positive().default(4e3),
  APP_URL: z2.string().default(""),
  API_BASE_URL: z2.string().default(""),
  CORS_ORIGIN: z2.string().default(""),
  DATABASE_URL: z2.string().default(""),
  PGLITE_DIR: z2.string().default(""),
  JWT_SECRET: z2.string().default(""),
  COOKIE_SECURE: z2.string().default(""),
  GEMINI_API_KEY: z2.string().default(""),
  GEMINI_MODEL: z2.string().default("gemini-2.5-flash"),
  PAYPAL_CLIENT_ID: z2.string().default(""),
  PAYPAL_CLIENT_SECRET: z2.string().default(""),
  PAYPAL_BASE_URL: z2.string().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_WEBHOOK_ID: z2.string().default(""),
  MCP_API_KEY: z2.string().default(""),
  CHANNEL3_API_KEY: z2.string().default(""),
  SEED_DEMO: z2.string().default("true"),
  LOG_LEVEL: z2.enum(["debug", "info", "warn", "error"]).default("info"),
  FRONTEND_URL: z2.string().default("")
});
var parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] Invalid environment configuration:", z2.prettifyError(parsed.error));
  process.exit(1);
}
var raw = parsed.data;
var isProd = raw.NODE_ENV === "production";
var warnings = [];
var jwtSecret = raw.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    console.error("[env] JWT_SECRET is required in production.");
    process.exit(1);
  }
  jwtSecret = crypto.createHash("sha256").update(`bhavai-dev-${repoRoot}`).digest("hex");
  warnings.push("JWT_SECRET not set \u2014 using a deterministic development-only secret.");
}
var appUrl = raw.APP_URL || raw.FRONTEND_URL || `http://localhost:${raw.PORT}`;
var frontendUrl = raw.FRONTEND_URL || (isProd ? appUrl : "http://localhost:5173");
var env = {
  nodeEnv: raw.NODE_ENV,
  isProd,
  isTest: raw.NODE_ENV === "test",
  port: raw.PORT,
  appUrl,
  frontendUrl,
  apiBaseUrl: raw.API_BASE_URL || appUrl,
  corsOrigins: raw.CORS_ORIGIN ? raw.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean) : [appUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
  databaseUrl: raw.DATABASE_URL,
  pgliteDir: raw.PGLITE_DIR || path.join(repoRoot, "data", "bhavai.db"),
  jwtSecret,
  cookieSecure: raw.COOKIE_SECURE ? raw.COOKIE_SECURE === "true" : isProd,
  gemini: {
    apiKey: raw.GEMINI_API_KEY,
    model: raw.GEMINI_MODEL,
    configured: Boolean(raw.GEMINI_API_KEY)
  },
  paypal: {
    clientId: raw.PAYPAL_CLIENT_ID,
    clientSecret: raw.PAYPAL_CLIENT_SECRET,
    baseUrl: raw.PAYPAL_BASE_URL.replace(/\/$/, ""),
    webhookId: raw.PAYPAL_WEBHOOK_ID,
    configured: Boolean(raw.PAYPAL_CLIENT_ID && raw.PAYPAL_CLIENT_SECRET),
    webhookConfigured: Boolean(raw.PAYPAL_CLIENT_ID && raw.PAYPAL_CLIENT_SECRET && raw.PAYPAL_WEBHOOK_ID),
    environment: raw.PAYPAL_BASE_URL.includes("sandbox") ? "sandbox" : "live"
  },
  mcpApiKey: raw.MCP_API_KEY,
  channel3ApiKey: raw.CHANNEL3_API_KEY,
  seedDemo: raw.SEED_DEMO !== "false",
  logLevel: raw.LOG_LEVEL,
  webDist: path.join(repoRoot, "apps", "web", "dist"),
  migrationsDir: path.join(repoRoot, "database", "migrations"),
  warnings
};
function integrationSnapshot() {
  return {
    gemini: { configured: env.gemini.configured, model: env.gemini.configured ? env.gemini.model : null },
    paypal: {
      configured: env.paypal.configured,
      environment: env.paypal.environment,
      webhookConfigured: env.paypal.webhookConfigured,
      clientIdSuffix: env.paypal.clientId ? env.paypal.clientId.slice(-6) : null
    },
    channel3: { configured: Boolean(env.channel3ApiKey) },
    mcp: { authenticated: Boolean(env.mcpApiKey) }
  };
}
if (warnings.length) {
  for (const w of warnings) console.warn(`[env] ${w}`);
}

// src/utils/logger.ts
var levels = { debug: 10, info: 20, warn: 30, error: 40 };
var REDACT_KEYS = /secret|password|token|authorization|api[_-]?key|client[_-]?id/i;
function redact(value, depth = 0) {
  if (depth > 4 || value === null || value === void 0) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}
function write(level, event, data) {
  if (levels[level] < levels[env.logLevel]) return;
  const payload = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    event,
    ...data ? redact(data) : {}
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
var logger = {
  debug: (event, data) => write("debug", event, data),
  info: (event, data) => write("info", event, data),
  warn: (event, data) => write("warn", event, data),
  error: (event, data) => write("error", event, data)
};

// src/db/index.ts
function normaliseParams(params) {
  return params.map((p) => {
    if (p === void 0) return null;
    if (p instanceof Date) return p;
    return p;
  });
}
async function createPostgres() {
  const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    max: 10,
    ssl: /sslmode=require|supabase\.co|supabase\.com/.test(env.databaseUrl) ? { rejectUnauthorized: false } : void 0
  });
  await pool.query("SELECT 1");
  const client = {
    async query(sql, params = []) {
      const result = await pool.query(sql, normaliseParams(params));
      return result.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    }
  };
  return {
    ...client,
    mode: "postgres",
    label: "PostgreSQL (managed)",
    async transaction(fn) {
      const conn = await pool.connect();
      try {
        await conn.query("BEGIN");
        const tx = {
          async query(sql, params = []) {
            const result = await conn.query(sql, normaliseParams(params));
            return result.rows;
          },
          async exec(sql) {
            await conn.query(sql);
          }
        };
        const value = await fn(tx);
        await conn.query("COMMIT");
        return value;
      } catch (error) {
        await conn.query("ROLLBACK").catch(() => void 0);
        throw error;
      } finally {
        conn.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}
async function createEmbedded() {
  fs2.mkdirSync(path2.dirname(env.pgliteDir), { recursive: true });
  const db = await PGlite.create(env.pgliteDir);
  const client = {
    async query(sql, params = []) {
      const result = await db.query(sql, normaliseParams(params));
      return result.rows;
    },
    async exec(sql) {
      await db.exec(sql);
    }
  };
  return {
    ...client,
    mode: "embedded",
    label: "Embedded PostgreSQL (PGlite)",
    async transaction(fn) {
      return db.transaction(async (trx) => {
        const wrapper = {
          async query(sql, params = []) {
            const result = await trx.query(sql, normaliseParams(params));
            return result.rows;
          },
          async exec(sql) {
            await trx.exec(sql);
          }
        };
        return fn(wrapper);
      });
    },
    async close() {
      await db.close();
    }
  };
}
var instance = null;
async function getDb() {
  if (instance) return instance;
  instance = env.databaseUrl ? await createPostgres() : await createEmbedded();
  logger.info("database_connected", { mode: instance.mode, label: instance.label });
  return instance;
}
async function closeDb() {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
function toNumber(value, fallback = 0) {
  if (value === null || value === void 0) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function toBool(value) {
  return value === true || value === "true" || value === "t" || value === 1 || value === "1";
}
function toIso(value) {
  if (!value) return (/* @__PURE__ */ new Date(0)).toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? (/* @__PURE__ */ new Date(0)).toISOString() : d.toISOString();
}
function parseJson(value, fallback) {
  if (value === null || value === void 0) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

// src/utils/crypto.ts
import crypto2 from "crypto";
function newId() {
  return crypto2.randomUUID();
}
function hashPassword(password) {
  const salt = crypto2.randomBytes(16).toString("hex");
  const derived = crypto2.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$16384$8$${salt}$${derived}`;
}
function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const derived = crypto2.scryptSync(password, salt, 64, {
      N: Number(n),
      r: Number(r),
      p: 1
    });
    const expected = Buffer.from(hash, "hex");
    return expected.length === derived.length && crypto2.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
function sha256(input) {
  return crypto2.createHash("sha256").update(input).digest("hex");
}
function randomToken(bytes = 24) {
  return crypto2.randomBytes(bytes).toString("base64url");
}
function apiKey() {
  const raw2 = `bvk_${crypto2.randomBytes(24).toString("hex")}`;
  return { raw: raw2, hash: sha256(raw2), prefix: `${raw2.slice(0, 12)}\u2026` };
}
function slugify(input) {
  return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// src/utils/errors.ts
var AppError = class extends Error {
  status;
  code;
  details;
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
};
var badRequest = (message, details) => new AppError(400, "BAD_REQUEST", message, details);
var unauthorized = (message = "Sign in to continue") => new AppError(401, "UNAUTHORIZED", message);
var forbidden = (message = "You do not have access to this resource") => new AppError(403, "FORBIDDEN", message);
var notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
var conflict = (message, details) => new AppError(409, "CONFLICT", message, details);

// src/utils/http.ts
function pathParam(req, key = "id") {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function parseWith(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new AppError(422, "VALIDATION_ERROR", "Check the highlighted fields.", {
      fields: fieldErrors
    });
  }
  return result.data;
}
function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// src/services/audit.ts
async function audit(input) {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO audit_logs (id, actor_id, actor_role, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        newId(),
        input.actor?.id ?? null,
        input.actor?.role ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  } catch (error) {
    logger.warn("audit_write_failed", { action: input.action, message: error.message });
  }
}

// src/services/products.ts
function mapProduct(row) {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    sku: String(row.sku),
    category: String(row.category),
    images: parseJson(row.images, []),
    listedPrice: roundMoney(toNumber(row.listed_price)),
    currency: String(row.currency),
    stock: toNumber(row.stock),
    unit: String(row.unit ?? "piece"),
    countryOfOrigin: String(row.country_of_origin),
    active: row.active === true,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}
function mapRules(row) {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    productId: row.product_id ? String(row.product_id) : null,
    floorPrice: roundMoney(toNumber(row.floor_price)),
    maxDiscountPercent: roundMoney(toNumber(row.max_discount_percent)),
    minimumQuantity: toNumber(row.minimum_quantity, 1),
    bulkDiscounts: parseJson(row.bulk_discounts, []),
    maxRounds: toNumber(row.max_rounds, 5),
    autoAcceptThreshold: row.auto_accept_threshold === null ? null : roundMoney(toNumber(row.auto_accept_threshold)),
    requireApprovalBelow: row.require_approval_below === null ? null : roundMoney(toNumber(row.require_approval_below)),
    approvalRequired: row.approval_required === true,
    updatedAt: toIso(row.updated_at)
  };
}
function policyFromRules(rules, product) {
  return {
    listedPrice: product.listedPrice,
    floorPrice: rules.floorPrice,
    maxDiscountPercent: rules.maxDiscountPercent,
    minimumQuantity: rules.minimumQuantity,
    bulkDiscounts: rules.bulkDiscounts,
    maxRounds: rules.maxRounds,
    autoAcceptThreshold: rules.autoAcceptThreshold,
    requireApprovalBelow: rules.requireApprovalBelow
  };
}
async function listSellerProducts(sellerId, filters) {
  const db = await getDb();
  const where = ["p.seller_id = $1"];
  const params = [sellerId];
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length})`);
  }
  if (filters.status === "active") where.push("p.active = TRUE");
  if (filters.status === "inactive") where.push("p.active = FALSE");
  if (filters.status === "out") where.push("p.stock = 0");
  if (filters.category) {
    params.push(filters.category);
    where.push(`p.category = $${params.length}`);
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const countRows = await db.query(
    `SELECT COUNT(*)::text AS count FROM products p WHERE ${where.join(" AND ")}`,
    params
  );
  const rows = await db.query(
    `SELECT p.* FROM products p WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );
  return {
    products: rows.map(mapProduct),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize
  };
}
async function getSellerProduct(sellerId, productId) {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM products WHERE id = $1 AND seller_id = $2`, [productId, sellerId]);
  if (!rows[0]) throw notFound("Product not found");
  return mapProduct(rows[0]);
}
async function createProduct(seller, input) {
  const db = await getDb();
  if (input.currency !== seller.currency) {
    throw badRequest(`This store is priced in ${seller.currency}. Create the product in the store currency.`);
  }
  const existing = await db.query(`SELECT id FROM products WHERE seller_id = $1 AND LOWER(sku) = LOWER($2)`, [
    seller.id,
    input.sku
  ]);
  if (existing[0]) throw conflict(`SKU ${input.sku} already exists in your catalog.`);
  const id = newId();
  await db.query(
    `INSERT INTO products (id, seller_id, name, description, sku, category, images, listed_price, currency, stock, unit, country_of_origin, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      seller.id,
      input.name,
      input.description ?? "",
      input.sku,
      input.category,
      JSON.stringify(input.images ?? []),
      input.listedPrice,
      input.currency,
      input.stock,
      input.unit,
      input.countryOfOrigin.toUpperCase(),
      input.active ?? true
    ]
  );
  await db.query(
    `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
    [
      newId(),
      seller.id,
      id,
      money(input.listedPrice * 0.85),
      15,
      1,
      JSON.stringify([]),
      5,
      money(input.listedPrice * 0.95),
      null,
      false
    ]
  );
  await audit({
    actor: { id: seller.userId, role: "SELLER" },
    action: "product.created",
    resourceType: "product",
    resourceId: id,
    metadata: { sku: input.sku }
  });
  return getSellerProduct(seller.id, id);
}
async function updateProduct(seller, productId, input) {
  const db = await getDb();
  const current = await getSellerProduct(seller.id, productId);
  if (input.currency && input.currency !== seller.currency) {
    throw badRequest(`This store is priced in ${seller.currency}.`);
  }
  if (input.sku && input.sku.toLowerCase() !== current.sku.toLowerCase()) {
    const dupe = await db.query(`SELECT id FROM products WHERE seller_id = $1 AND LOWER(sku) = LOWER($2) AND id <> $3`, [
      seller.id,
      input.sku,
      productId
    ]);
    if (dupe[0]) throw conflict(`SKU ${input.sku} already exists in your catalog.`);
  }
  const fields = [];
  const params = [];
  const push = (column, value, cast = "") => {
    params.push(value);
    fields.push(`${column} = $${params.length}${cast}`);
  };
  if (input.name !== void 0) push("name", input.name);
  if (input.description !== void 0) push("description", input.description);
  if (input.sku !== void 0) push("sku", input.sku);
  if (input.category !== void 0) push("category", input.category);
  if (input.images !== void 0) push("images", JSON.stringify(input.images), "::jsonb");
  if (input.listedPrice !== void 0) push("listed_price", input.listedPrice);
  if (input.stock !== void 0) push("stock", input.stock);
  if (input.unit !== void 0) push("unit", input.unit);
  if (input.countryOfOrigin !== void 0) push("country_of_origin", input.countryOfOrigin.toUpperCase());
  if (input.active !== void 0) push("active", input.active);
  if (fields.length === 0) return current;
  params.push(productId, seller.id);
  fields.push("updated_at = NOW()");
  await db.query(
    `UPDATE products SET ${fields.join(", ")} WHERE id = $${params.length - 1} AND seller_id = $${params.length}`,
    params
  );
  await audit({
    actor: { id: seller.userId, role: "SELLER" },
    action: "product.updated",
    resourceType: "product",
    resourceId: productId
  });
  return getSellerProduct(seller.id, productId);
}
async function deleteProduct(seller, productId) {
  const db = await getDb();
  await getSellerProduct(seller.id, productId);
  const history = await db.query(
    `SELECT COUNT(*)::text AS count FROM negotiations WHERE product_id = $1`,
    [productId]
  );
  if (Number(history[0]?.count ?? 0) > 0) {
    await db.query(`UPDATE products SET active = FALSE, updated_at = NOW() WHERE id = $1 AND seller_id = $2`, [
      productId,
      seller.id
    ]);
    await audit({
      actor: { id: seller.userId, role: "SELLER" },
      action: "product.deactivated_for_history",
      resourceType: "product",
      resourceId: productId,
      metadata: { negotiations: Number(history[0]?.count ?? 0) }
    });
    return {
      deleted: false,
      deactivated: true,
      message: "This product has negotiation history, so it was deactivated instead of deleted. Historical deals stay intact."
    };
  }
  await db.query(`DELETE FROM products WHERE id = $1 AND seller_id = $2`, [productId, seller.id]);
  await audit({
    actor: { id: seller.userId, role: "SELLER" },
    action: "product.deleted",
    resourceType: "product",
    resourceId: productId
  });
  return { deleted: true, deactivated: false, message: "Product deleted." };
}
async function getRulesForProduct(sellerId, productId) {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM seller_rules WHERE seller_id = $1 AND product_id = $2`, [sellerId, productId]);
  if (!rows[0]) throw notFound("Pricing rules not found for this product");
  return mapRules(rows[0]);
}
async function listRules(sellerId) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT r.*, p.name AS product_name, p.sku, p.listed_price, p.currency, p.stock, p.active
     FROM seller_rules r JOIN products p ON p.id = r.product_id
     WHERE r.seller_id = $1 ORDER BY p.name ASC`,
    [sellerId]
  );
  return rows.map((row) => ({
    rules: mapRules(row),
    product: {
      id: String(row.product_id),
      name: String(row.product_name),
      sku: String(row.sku),
      listedPrice: roundMoney(toNumber(row.listed_price)),
      currency: String(row.currency),
      stock: toNumber(row.stock),
      active: row.active === true
    },
    minimumAllowed: minimumAllowedPrice({
      listedPrice: toNumber(row.listed_price),
      floorPrice: toNumber(row.floor_price),
      maxDiscountPercent: toNumber(row.max_discount_percent)
    })
  }));
}
function assertRulesConsistent(rules, listedPrice) {
  if (rules.floorPrice > listedPrice) {
    throw badRequest("The confidential floor price cannot be above the listed price.");
  }
  const minimum = minimumAllowedPrice({
    listedPrice,
    floorPrice: rules.floorPrice,
    maxDiscountPercent: rules.maxDiscountPercent
  });
  if (rules.autoAcceptThreshold != null && rules.autoAcceptThreshold > listedPrice) {
    throw badRequest("The auto-accept price cannot be above the listed price.");
  }
  if (rules.autoAcceptThreshold != null && rules.autoAcceptThreshold < minimum) {
    throw badRequest("The auto-accept price cannot be below the minimum the rules already authorise.");
  }
  if (rules.requireApprovalBelow != null && rules.requireApprovalBelow > listedPrice) {
    throw badRequest("The approval threshold cannot be above the listed price.");
  }
  const seen = /* @__PURE__ */ new Set();
  for (const tier of rules.bulkDiscounts) {
    if (seen.has(tier.minimumQuantity)) throw badRequest("Each bulk tier needs a unique minimum quantity.");
    seen.add(tier.minimumQuantity);
    if (tier.discountPercent > rules.maxDiscountPercent) {
      throw badRequest("A bulk tier discount cannot exceed the maximum discount.");
    }
  }
}
async function upsertRules(sellerId, productId, input) {
  const db = await getDb();
  const product = await getSellerProduct(sellerId, productId);
  assertRulesConsistent(input, product.listedPrice);
  const existing = await db.query(`SELECT id FROM seller_rules WHERE product_id = $1 AND seller_id = $2`, [
    productId,
    sellerId
  ]);
  const id = existing[0] ? String(existing[0].id) : newId();
  const payload = [
    input.floorPrice,
    input.maxDiscountPercent,
    input.minimumQuantity,
    JSON.stringify(input.bulkDiscounts ?? []),
    input.maxRounds,
    input.autoAcceptThreshold ?? null,
    input.requireApprovalBelow ?? null,
    input.approvalRequired
  ];
  if (existing[0]) {
    await db.query(
      `UPDATE seller_rules SET floor_price=$1, max_discount_percent=$2, minimum_quantity=$3, bulk_discounts=$4::jsonb,
       max_rounds=$5, auto_accept_threshold=$6, require_approval_below=$7, approval_required=$8, updated_at=NOW()
       WHERE id=$9`,
      [...payload, id]
    );
  } else {
    await db.query(
      `INSERT INTO seller_rules (floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required, id, seller_id, product_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)`,
      [...payload, id, sellerId, productId]
    );
  }
  await audit({
    actor: { id: null, role: "SELLER" },
    action: "rules.updated",
    resourceType: "product",
    resourceId: productId,
    metadata: { maxRounds: input.maxRounds, approvalRequired: input.approvalRequired }
  });
  return getRulesForProduct(sellerId, productId);
}
async function listPublicStores() {
  const db = await getDb();
  const rows = await db.query(
    `SELECT s.*, (SELECT COUNT(*)::int FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS product_count,
            (SELECT COALESCE(json_agg(DISTINCT p.category), '[]'::json) FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS categories,
            (SELECT COALESCE(MAX(max_rounds), 5)::int FROM seller_rules r WHERE r.seller_id = s.id) AS max_rounds
     FROM sellers s WHERE s.active = TRUE ORDER BY s.business_name ASC LIMIT 50`
  );
  return rows.map((row) => ({
    id: String(row.id),
    businessName: String(row.business_name),
    storeSlug: String(row.store_slug),
    description: String(row.description ?? ""),
    country: String(row.country),
    currency: String(row.currency),
    productCount: toNumber(row.product_count),
    categories: parseJson(row.categories, []),
    negotiation: { supported: true, maxRounds: toNumber(row.max_rounds, 5) },
    regions: String(row.country) === "IN" ? ["India (domestic, manual settlement)", "International (PayPal Sandbox)"] : ["International (PayPal Sandbox)"],
    purchaseConditions: [
      "Prices are shown in the store currency.",
      "AI negotiation is bounded by confidential seller rules and revalidated server-side.",
      String(row.country) === "IN" ? "Indian domestic orders settle off-platform. No domestic PayPal payment is implied." : "Cross-border orders use PayPal Sandbox in this demonstration.",
      "Stock is reserved only when a deal is accepted."
    ],
    api: {
      storefront: `/api/public/stores/${row.store_slug}`,
      mcp: "/mcp",
      protocolVersion: "2025-06-18"
    }
  }));
}
async function getPublicStore(slug) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT s.*, (SELECT COUNT(*)::int FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS product_count,
            (SELECT COALESCE(json_agg(DISTINCT p.category), '[]'::json) FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS categories
     FROM sellers s WHERE s.store_slug = $1 AND s.active = TRUE`,
    [slug]
  );
  const row = rows[0];
  if (!row) throw notFound("This storefront is not published or does not exist.");
  const maxRoundsRows = await db.query(
    `SELECT COALESCE(MAX(max_rounds), 5)::int AS max_rounds FROM seller_rules WHERE seller_id = $1`,
    [row.id]
  );
  return {
    id: String(row.id),
    businessName: String(row.business_name),
    storeSlug: String(row.store_slug),
    description: String(row.description ?? ""),
    country: String(row.country),
    currency: String(row.currency),
    productCount: toNumber(row.product_count),
    categories: parseJson(row.categories, []),
    negotiation: { supported: true, maxRounds: toNumber(maxRoundsRows[0]?.max_rounds, 5) },
    regions: String(row.country) === "IN" ? ["India (domestic, manual settlement)", "International (PayPal Sandbox)"] : ["International (PayPal Sandbox)"],
    purchaseConditions: [
      "Prices are shown in the store currency.",
      "AI negotiation is bounded by confidential seller rules and revalidated server-side.",
      String(row.country) === "IN" ? "Indian domestic orders settle off-platform. No domestic PayPal payment is implied." : "Cross-border orders use PayPal Sandbox in this demonstration.",
      "Stock is reserved only when a deal is accepted."
    ],
    api: {
      storefront: `/api/public/stores/${row.store_slug}`,
      mcp: "/mcp",
      protocolVersion: "2025-06-18"
    }
  };
}
function publicProduct(row) {
  const product = mapProduct(row);
  const rules = mapRules(row);
  return {
    ...product,
    seller: {
      businessName: String(row.business_name),
      storeSlug: String(row.store_slug),
      country: String(row.seller_country),
      currency: String(row.seller_currency)
    },
    negotiation: {
      negotiable: Boolean(row.neg_rules),
      minimumQuantity: rules.minimumQuantity,
      maxRounds: rules.maxRounds,
      bulkTiers: rules.bulkDiscounts.map((tier) => ({ minimumQuantity: tier.minimumQuantity, discountPercent: tier.discountPercent })).sort((a, b) => a.minimumQuantity - b.minimumQuantity)
    }
  };
}
var PUBLIC_PRODUCT_SELECT = `
  SELECT p.*, s.business_name, s.store_slug, s.country AS seller_country, s.currency AS seller_currency,
         r.id AS neg_rules, r.floor_price, r.max_discount_percent, r.minimum_quantity, r.bulk_discounts,
         r.max_rounds, r.auto_accept_threshold, r.require_approval_below, r.approval_required
  FROM products p
  JOIN sellers s ON s.id = p.seller_id
  LEFT JOIN seller_rules r ON r.product_id = p.id
`;
async function listPublicStoreProducts(slug, filters) {
  const db = await getDb();
  const storeRows = await db.query(`SELECT id, currency FROM sellers WHERE store_slug = $1 AND active = TRUE`, [slug]);
  if (!storeRows[0]) throw notFound("This storefront is not published or does not exist.");
  const storeId = String(storeRows[0].id);
  const where = ["p.seller_id = $1", "p.active = TRUE"];
  const params = [storeId];
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length} OR LOWER(p.category) LIKE $${params.length})`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`LOWER(p.category) = LOWER($${params.length})`);
  }
  if (filters.minPrice !== void 0) {
    params.push(filters.minPrice);
    where.push(`p.listed_price >= $${params.length}`);
  }
  if (filters.maxPrice !== void 0) {
    params.push(filters.maxPrice);
    where.push(`p.listed_price <= $${params.length}`);
  }
  if (filters.inStock) where.push("p.stock > 0");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 24));
  const count = await db.query(
    `SELECT COUNT(*)::text AS count FROM products p WHERE ${where.join(" AND ")}`,
    params
  );
  const rows = await db.query(
    `${PUBLIC_PRODUCT_SELECT} WHERE ${where.join(" AND ")}
     ORDER BY p.stock > 0 DESC, p.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return {
    products: rows.map(publicProduct),
    total: Number(count[0]?.count ?? 0),
    page,
    pageSize,
    currency: String(storeRows[0].currency)
  };
}
async function getPublicProduct(productId) {
  const db = await getDb();
  const rows = await db.query(
    `${PUBLIC_PRODUCT_SELECT} WHERE p.id = $1 AND p.active = TRUE AND s.active = TRUE`,
    [productId]
  );
  if (!rows[0]) throw notFound("Product not found or the storefront is not published.");
  return publicProduct(rows[0]);
}
async function searchMarket(filters) {
  const db = await getDb();
  const where = ["p.active = TRUE", "s.active = TRUE"];
  const params = [];
  const terms = (filters.search ?? "").split(/\s+/).map((t) => t.trim().toLowerCase()).filter((t) => t.length > 2).slice(0, 6);
  for (const term of terms) {
    params.push(`%${term}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length} OR LOWER(p.category) LIKE $${params.length})`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`LOWER(p.category) = LOWER($${params.length})`);
  }
  if (filters.minPrice !== void 0) {
    params.push(filters.minPrice);
    where.push(`p.listed_price >= $${params.length}`);
  }
  if (filters.maxPrice !== void 0) {
    params.push(filters.maxPrice);
    where.push(`p.listed_price <= $${params.length}`);
  }
  if (filters.currency) {
    params.push(filters.currency);
    where.push(`p.currency = $${params.length}`);
  }
  if (filters.country) {
    params.push(filters.country.toUpperCase());
    where.push(`s.country = $${params.length}`);
  }
  if (filters.inStock !== false) where.push("p.stock > 0");
  if (filters.quantity) {
    params.push(filters.quantity);
    where.push(`p.stock >= $${params.length}`);
    params.push(filters.quantity);
    where.push(`(SELECT COALESCE(minimum_quantity, 1) FROM seller_rules r WHERE r.product_id = p.id) <= $${params.length}`);
  }
  if (filters.maxTotal && filters.quantity) {
    params.push(filters.maxTotal, filters.quantity);
    where.push(`p.listed_price * $${params.length} <= $${params.length - 1} * 1.25`);
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(40, Math.max(1, filters.pageSize ?? 12));
  const rows = await db.query(
    `${PUBLIC_PRODUCT_SELECT} WHERE ${where.join(" AND ")}
     ORDER BY p.stock > 0 DESC, p.listed_price ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const count = await db.query(
    `SELECT COUNT(*)::text AS count FROM products p JOIN sellers s ON s.id = p.seller_id WHERE ${where.join(" AND ")}`,
    params
  );
  return {
    products: rows.map(publicProduct),
    total: Number(count[0]?.count ?? 0),
    page,
    pageSize,
    query: { ...filters, terms }
  };
}

// src/pricing/engine.ts
function validateOffer(input) {
  const { unitPrice, quantity, stock, policy } = input;
  const total = roundMoney(unitPrice * quantity);
  const minimumAllowed = minimumAllowedPrice(policy);
  const discountPercent = policy.listedPrice > 0 ? roundMoney((policy.listedPrice - unitPrice) / policy.listedPrice * 100) : 0;
  const base = { minimumAllowed, discountPercent, total, quantity, unitPrice };
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { ...base, valid: false, code: "INVALID", message: "Enter a valid price above zero." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ...base, valid: false, code: "INVALID", message: "Enter a whole quantity above zero." };
  }
  if (quantity < policy.minimumQuantity) {
    return {
      ...base,
      valid: false,
      code: "BELOW_MIN_QUANTITY",
      message: `This seller's minimum order is ${policy.minimumQuantity} units.`
    };
  }
  if (quantity > stock) {
    return {
      ...base,
      valid: false,
      code: "QUANTITY_UNAVAILABLE",
      message: `Only ${stock} units are available right now.`
    };
  }
  if (unitPrice > policy.listedPrice) {
    return {
      ...base,
      valid: false,
      code: "ABOVE_LISTED",
      message: "The offer is above the listed price. Accept the listed price to order."
    };
  }
  if (unitPrice < minimumAllowed) {
    return {
      ...base,
      valid: false,
      code: "BELOW_MINIMUM",
      message: "This offer is below the range the seller has authorised."
    };
  }
  return {
    ...base,
    valid: true,
    code: "VALID",
    message: "Offer is within the seller\u2019s authorised range."
  };
}
function requiresApproval(policy, unitPrice) {
  if (policy.requireApprovalBelow === null) return false;
  return unitPrice < policy.requireApprovalBelow;
}
function sellerDecision(input) {
  const { offerUnitPrice, quantity, stock, policy, round } = input;
  const check = validateOffer({ unitPrice: offerUnitPrice, quantity, stock, policy });
  const minimumAllowed = minimumAllowedPrice(policy);
  const target = targetPrice(policy, quantity);
  if (check.code === "ABOVE_LISTED" || check.code === "INVALID") {
    return {
      type: "REJECT",
      unitPrice: null,
      code: "INVALID_OFFER",
      explanation: check.message,
      check
    };
  }
  if (check.code === "BELOW_MIN_QUANTITY" || check.code === "QUANTITY_UNAVAILABLE") {
    return { type: "REJECT", unitPrice: null, code: "INVALID_OFFER", explanation: check.message, check };
  }
  if (offerUnitPrice >= target) {
    return {
      type: "ACCEPT",
      unitPrice: roundMoney(offerUnitPrice),
      code: "AT_OR_ABOVE_TARGET",
      explanation: "The offer meets the seller\u2019s target price for this quantity.",
      check
    };
  }
  if (policy.autoAcceptThreshold !== null && offerUnitPrice >= policy.autoAcceptThreshold) {
    return {
      type: "ACCEPT",
      unitPrice: roundMoney(offerUnitPrice),
      code: "AUTO_ACCEPT",
      explanation: "The offer clears the seller\u2019s pre-approved auto-accept price.",
      check
    };
  }
  if (check.valid && round >= policy.maxRounds) {
    return {
      type: "ACCEPT",
      unitPrice: roundMoney(offerUnitPrice),
      code: "WITHIN_AUTHORITY",
      explanation: "Final round: the offer is within the seller\u2019s authorised range.",
      check
    };
  }
  if (check.code === "BELOW_MINIMUM" && round >= policy.maxRounds) {
    return {
      type: "REJECT",
      unitPrice: null,
      code: "BELOW_AUTHORITY",
      explanation: "The negotiation reached its final round without a price inside the seller\u2019s authorised range.",
      check
    };
  }
  const progress = policy.maxRounds <= 1 ? 1 : Math.min(1, (round - 1) / (policy.maxRounds - 1));
  const opening = minimumAllowed + (target - minimumAllowed) * Math.pow(1 - progress, 1.45);
  let counter = roundMoney(Math.max(minimumAllowed, Math.min(target, opening)));
  if (counter <= offerUnitPrice) {
    return {
      type: "ACCEPT",
      unitPrice: roundMoney(offerUnitPrice),
      code: "WITHIN_AUTHORITY",
      explanation: "The offer is at least the seller\u2019s counter position, so the seller accepts.",
      check
    };
  }
  if (policy.autoAcceptThreshold !== null) counter = Math.min(counter, policy.autoAcceptThreshold);
  counter = roundMoney(Math.min(policy.listedPrice, Math.max(minimumAllowed, counter)));
  const bulk = applicableBulkDiscount(quantity, policy.bulkDiscounts);
  const bulkNote = bulk ? ` A ${bulk.discountPercent}% tier applies at ${bulk.minimumQuantity}+ units.` : "";
  return {
    type: "COUNTER",
    unitPrice: counter,
    code: "COUNTER_OFFER",
    explanation: `The seller holds at ${counter.toFixed(2)} per unit for ${quantity} units.${bulkNote}`,
    minimumAllowed,
    check
  };
}
function buyerDecision(input) {
  const { listedPrice, sellerUnitPrice, quantity, budgetTotal, previousOwnOffer, round, maxRounds } = input;
  const budgetUnit = budgetTotal ? roundMoney(budgetTotal / quantity) : listedPrice;
  const ceiling = roundMoney(Math.min(listedPrice, budgetUnit));
  if (sellerUnitPrice === null) {
    const opening = roundMoney(Math.max(0.01, Math.min(ceiling, listedPrice * 0.78)));
    return {
      type: "OFFER",
      unitPrice: opening,
      explanation: `Opens at ${opening.toFixed(2)} per unit, inside the buyer's budget ceiling of ${ceiling.toFixed(2)}.`
    };
  }
  if (sellerUnitPrice <= ceiling) {
    return {
      type: "ACCEPT",
      unitPrice: roundMoney(sellerUnitPrice),
      explanation: `The counter at ${sellerUnitPrice.toFixed(2)} per unit fits the buyer's budget.`
    };
  }
  const previous = previousOwnOffer ?? roundMoney(Math.min(ceiling, listedPrice * 0.78));
  if (round >= maxRounds) {
    return {
      type: "REJECT",
      unitPrice: null,
      explanation: "The seller\u2019s price remains above the buyer\u2019s budget at the final round."
    };
  }
  const raised = roundMoney(Math.min(ceiling, previous + (sellerUnitPrice - previous) * 0.5));
  if (raised <= previous) {
    return {
      type: "REJECT",
      unitPrice: null,
      explanation: `The buyer's budget ceiling of ${ceiling.toFixed(2)} per unit is below the seller's counter.`
    };
  }
  return {
    type: "OFFER",
    unitPrice: raised,
    explanation: `Raises the offer to ${raised.toFixed(2)} per unit while staying inside the buyer's budget.`
  };
}

// src/services/agent.ts
import { z as z3 } from "zod";

// src/services/gemini.ts
async function geminiJson(options) {
  if (!env.gemini.configured) return null;
  const model = env.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.gemini.apiKey)}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.system }] },
        contents: [{ role: "user", parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          responseMimeType: "application/json",
          responseSchema: options.schema,
          maxOutputTokens: 1024
        }
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 12e3)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn("gemini_error", { status: response.status, body: body.slice(0, 300) });
      return null;
    }
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) return null;
    const parsed2 = JSON.parse(text);
    return { data: parsed2, model };
  } catch (error) {
    logger.warn("gemini_unavailable", { message: error.message });
    return null;
  }
}
function geminiConfigured() {
  return env.gemini.configured;
}
async function geminiPing() {
  if (!env.gemini.configured) {
    return { ok: false, model: null, message: "GEMINI_API_KEY is not set. The policy engine remains fully functional." };
  }
  const result = await geminiJson({
    system: "You are a connectivity probe. Return JSON only.",
    prompt: 'Return {"ok": true}.',
    schema: {
      type: "OBJECT",
      properties: { ok: { type: "BOOLEAN" } },
      required: ["ok"]
    },
    temperature: 0,
    timeoutMs: 1e4
  });
  return result ? { ok: true, model: result.model, message: "Gemini responded to a live structured-output probe." } : { ok: false, model: env.gemini.model, message: "Gemini did not return a valid response. Check the key, model and quota." };
}

// src/services/agent.ts
function agentMode() {
  return geminiConfigured() ? "GEMINI" : "POLICY";
}
var IntentSchema = z3.object({
  productQuery: z3.string().trim().min(2).max(200),
  quantity: z3.coerce.number().int().min(1).max(1e5),
  budgetTotal: z3.coerce.number().positive().nullable().optional().default(null),
  currency: z3.string().trim().max(8).nullable().optional().default(null),
  category: z3.string().trim().max(60).nullable().optional().default(null),
  urgency: z3.string().trim().max(40).nullable().optional().default(null)
});
var STOPWORDS = /* @__PURE__ */ new Set([
  "i",
  "need",
  "want",
  "looking",
  "for",
  "from",
  "the",
  "a",
  "an",
  "please",
  "would",
  "like",
  "to",
  "buy",
  "order",
  "my",
  "we",
  "us",
  "me",
  "with",
  "maximum",
  "max",
  "total",
  "budget",
  "is",
  "of",
  "and",
  "or",
  "in",
  "units",
  "unit",
  "pieces",
  "piece",
  "pcs",
  "quantity",
  "about",
  "around",
  "up",
  "per",
  "each",
  "can",
  "you",
  "get",
  "source",
  "find",
  "handmade",
  "handcrafted",
  "indian",
  "india",
  "good",
  "quality",
  "best",
  "price",
  "quote",
  "under"
]);
function deterministicIntent(text, fallbackCurrency) {
  const lower = text.toLowerCase();
  const quantityMatch = lower.match(/\b(\d{1,6})\s*(?:x|units?|pieces?|pcs?|items?|diya?s?|bowls?|holders?|lanterns?|scarves?|stoles?)\b/) ?? lower.match(/\b(?:quantity|qty)[:\s]+(\d{1,6})\b/);
  let quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  let budgetTotal = null;
  const budgetMatch = lower.match(/(?:budget|max(?:imum)?|up to|under|within|spend)[^\d]{0,20}(?:[$₹€£]\s?)?([\d,]+(?:\.\d{1,2})?)/) ?? lower.match(/(?:[$₹€£]\s?)([\d,]+(?:\.\d{1,2})?)/);
  if (budgetMatch) {
    const parsed2 = Number(budgetMatch[1].replace(/,/g, ""));
    if (Number.isFinite(parsed2) && parsed2 > 0) budgetTotal = roundMoney(parsed2);
  }
  let currency = null;
  if (/\$|\busd\b|\bdollars?\b/.test(lower)) currency = "USD";
  else if (/₹|\binr\b|\brupees?\b/.test(lower)) currency = "INR";
  else if (/€|\beur\b|\beuros?\b/.test(lower)) currency = "EUR";
  else if (/£|\bgbp\b|\bpounds?\b/.test(lower)) currency = "GBP";
  else if (/\baed\b|\bdirhams?\b/.test(lower)) currency = "AED";
  currency = currency ?? fallbackCurrency ?? null;
  const category = CATEGORIES.find((c) => lower.includes(c.toLowerCase())) ?? (lower.includes("diya") || lower.includes("decor") || lower.includes("lantern") || lower.includes("bowl") ? "Home & Decor" : lower.includes("jewel") || lower.includes("necklace") || lower.includes("earring") ? "Jewellery" : lower.includes("textile") || lower.includes("scarf") || lower.includes("fabric") ? "Textiles" : null);
  const cleaned = lower.replace(/\b\d{1,6}\s*(?:x|units?|pieces?|pcs?|items?|diya?s?|bowls?|holders?|lanterns?)\b/g, " ").replace(/(?:budget|max(?:imum)?|up to|under|within|spend)[^\d]{0,20}(?:[$₹€£]\s?)?[\d,]+(?:\.\d{1,2})?/g, " ").replace(/[$₹€£][\d,]+(?:\.\d{1,2})?/g, " ").replace(/[^a-z\s-]/g, " ");
  const keywords = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)).slice(0, 6);
  return {
    productQuery: keywords.join(" ") || text.slice(0, 80),
    quantity,
    budgetTotal,
    currency,
    category,
    urgency: null,
    mode: "POLICY"
  };
}
async function parseIntent(text, fallbackCurrency) {
  const fallback = deterministicIntent(text, fallbackCurrency);
  if (!geminiConfigured()) return fallback;
  const result = await geminiJson({
    system: "You extract structured commerce requirements for an AI buyer. Never invent a budget, quantity, currency or product that the user did not state. Use null when absent. The quantity is the number of units requested. The budget is the TOTAL budget in the stated currency, not a unit price.",
    prompt: `User request: "${text}"

Return JSON with: productQuery (short search phrase, product nouns only), quantity (integer), budgetTotal (number or null), currency (ISO code or null), category (one of ${CATEGORIES.join(", ")} or null), urgency (short phrase or null).`,
    schema: {
      type: "OBJECT",
      properties: {
        productQuery: { type: "STRING" },
        quantity: { type: "INTEGER" },
        budgetTotal: { type: "NUMBER", nullable: true },
        currency: { type: "STRING", nullable: true },
        category: { type: "STRING", nullable: true },
        urgency: { type: "STRING", nullable: true }
      },
      required: ["productQuery", "quantity"]
    }
  });
  if (!result) return fallback;
  const parsed2 = IntentSchema.safeParse(result.data);
  if (!parsed2.success) {
    logger.warn("intent_schema_mismatch", { issues: parsed2.error.issues.length });
    return fallback;
  }
  const data = parsed2.data;
  return {
    productQuery: data.productQuery,
    quantity: data.quantity,
    budgetTotal: data.budgetTotal ?? null,
    currency: data.currency ? data.currency.toUpperCase().slice(0, 3) : fallbackCurrency ?? null,
    category: data.category,
    urgency: data.urgency,
    mode: "GEMINI"
  };
}
function numbersIn(text) {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", "."))).filter(Number.isFinite);
}
function outputIsSafe(text, allowedNumbers) {
  if (!text.trim() || text.length > 420) return false;
  if (/floor|minimum allowed|confidential|cost price|margin/i.test(text)) return false;
  const allowed = new Set(allowedNumbers.map((n) => roundMoney(n)));
  for (const n of numbersIn(text)) {
    if (!allowed.has(roundMoney(n))) return false;
  }
  return true;
}
async function sellerAgentMessage(input) {
  const total = roundMoney(input.unitPrice * input.quantity);
  const fallback = input.decision === "ACCEPT" ? `For ${input.quantity} \xD7 ${input.productName}, ${input.businessName} accepts at ${formatMoney(input.unitPrice, input.currency)} per unit \u2014 ${formatMoney(total, input.currency)} total.` : input.decision === "COUNTER" ? `For ${input.quantity} units, I can offer ${formatMoney(input.unitPrice, input.currency)} per ${input.productName.toLowerCase()} \u2014 ${formatMoney(total, input.currency)} total.` : `I can\u2019t meet that price for ${input.quantity} units. The seller has kept their authorised pricing policy in place.`;
  if (!geminiConfigured()) return { message: fallback, mode: "POLICY" };
  const result = await geminiJson({
    system: "You write one short, professional negotiation message in the voice of an Indian artisan business selling to an AI buyer. Use ONLY the prices supplied. Never mention floor prices, margins, cost, internal rules or confidential data. One to three sentences, no emoji, no markdown.",
    prompt: `Seller: ${input.businessName}
Product: ${input.productName}
Quantity: ${input.quantity}
Currency: ${input.currency}
Listed unit price: ${input.listedPrice}
Decision: ${input.decision}
Unit price in this move: ${input.unitPrice}
Total: ${total}
Round: ${input.round}
Policy note: ${input.explanation}

Write the seller agent's message.`,
    schema: {
      type: "OBJECT",
      properties: { message: { type: "STRING" } },
      required: ["message"]
    },
    temperature: 0.4
  });
  if (!result) return { message: fallback, mode: "POLICY" };
  const parsed2 = z3.object({ message: z3.string() }).safeParse(result.data);
  if (!parsed2.success) return { message: fallback, mode: "POLICY" };
  const safe = outputIsSafe(parsed2.data.message, [
    input.unitPrice,
    total,
    input.listedPrice,
    input.quantity,
    input.round
  ]);
  return { message: safe ? parsed2.data.message : fallback, mode: safe ? "GEMINI" : "POLICY" };
}
async function buyerAgentMessage(input) {
  const total = roundMoney(input.unitPrice * input.quantity);
  const budgetText = input.budgetTotal ? ` My total budget is ${formatMoney(input.budgetTotal, input.currency)}.` : "";
  const fallback = input.decision === "OFFER" ? `I can offer ${formatMoney(input.unitPrice, input.currency)} per ${input.productName.toLowerCase()} for ${input.quantity} units.${budgetText}` : input.decision === "ACCEPT" ? `That works. I accept ${formatMoney(input.unitPrice, input.currency)} per unit \u2014 ${formatMoney(total, input.currency)} total.` : `That price is outside my budget for ${input.quantity} units. I\u2019ll stop here rather than exceed it.`;
  if (!geminiConfigured()) return { message: fallback, mode: "POLICY" };
  const result = await geminiJson({
    system: "You write one short negotiation message in the voice of a procurement AI buying craft products. Use ONLY supplied prices and quantities. Never invent a budget or a discount. One to two sentences, no emoji, no markdown.",
    prompt: `Product: ${input.productName}
Quantity: ${input.quantity}
Currency: ${input.currency}
Decision: ${input.decision}
Unit price: ${input.unitPrice}
Total: ${total}
Budget: ${input.budgetTotal ?? "not stated"}
Round: ${input.round}
Note: ${input.explanation}`,
    schema: {
      type: "OBJECT",
      properties: { message: { type: "STRING" } },
      required: ["message"]
    },
    temperature: 0.4
  });
  if (!result) return { message: fallback, mode: "POLICY" };
  const parsed2 = z3.object({ message: z3.string() }).safeParse(result.data);
  if (!parsed2.success) return { message: fallback, mode: "POLICY" };
  const safe = outputIsSafe(parsed2.data.message, [
    input.unitPrice,
    total,
    input.quantity,
    input.round,
    input.budgetTotal ?? input.unitPrice
  ]);
  return { message: safe ? parsed2.data.message : fallback, mode: safe ? "GEMINI" : "POLICY" };
}
async function analyticsNarrative(input) {
  const money2 = (n) => formatMoney(n, input.currency);
  const fallback = buildFallbackNarrative(input, money2);
  if (!geminiConfigured()) return { text: fallback, mode: "POLICY" };
  const result = await geminiJson({
    system: "You summarise a seller's real commerce dashboard in two or three sentences. Use only the supplied figures; never invent metrics, trends, forecasts or customers. Be direct and specific. No markdown, no emoji, at most 90 words.",
    prompt: JSON.stringify(input),
    schema: {
      type: "OBJECT",
      properties: { summary: { type: "STRING" } },
      required: ["summary"]
    },
    temperature: 0.3
  });
  if (!result) return { text: fallback, mode: "POLICY" };
  const parsed2 = z3.object({ summary: z3.string() }).safeParse(result.data);
  if (!parsed2.success || parsed2.data.summary.length > 600) return { text: fallback, mode: "POLICY" };
  return { text: parsed2.data.summary, mode: "GEMINI" };
}
function buildFallbackNarrative(input, money2) {
  if (input.negotiationsTotal === 0) {
    return "No negotiations yet. Publish a storefront and share the store link with an AI buyer or run the demo arena to see your first deal.";
  }
  const parts = [
    `${input.negotiationsToday} negotiation${input.negotiationsToday === 1 ? "" : "s"} started today, with ${input.agreed} accepted deal${input.agreed === 1 ? "" : "s"} overall.`,
    `Negotiated discounts average ${input.averageDiscount.toFixed(1)}%, and the conversion rate is ${input.conversionRate.toFixed(1)}%.`
  ];
  if (input.salesTotal > 0) {
    parts.push(`${money2(input.salesTotal)} in settled or paid sales is recorded, with ${money2(input.pendingPayments)} still pending payment.`);
  } else {
    parts.push("No payment has been confirmed yet, so revenue is not counted.");
  }
  if (input.topProduct) parts.push(`The most negotiated product is ${input.topProduct}.`);
  if (input.marketSplit.domestic + input.marketSplit.crossBorder > 0) {
    parts.push(`${input.marketSplit.domestic} domestic and ${input.marketSplit.crossBorder} cross-border conversations.`);
  }
  return parts.join(" ");
}

// src/services/negotiation.ts
var NEG_SELECT = `
  SELECT n.*, b.user_id AS buyer_user_id, b.country AS buyer_country, b.company_name AS buyer_company,
         bu.name AS buyer_name, bu.email AS buyer_email,
         s.user_id AS seller_user_id, s.business_name AS seller_name, s.country AS seller_country,
         p.name AS product_name, p.sku AS product_sku, p.category AS product_category, p.stock AS product_stock,
         p.active AS product_active, p.unit AS product_unit, p.images AS product_images, p.description AS product_description,
         d.id AS deal_id, d.agreed_unit_price, d.agreed_quantity, d.total_amount, d.status AS deal_status,
         d.accepted_at, d.buyer_confirmed_at, d.is_sample AS deal_is_sample,
         d.market_type AS deal_market_type, d.currency AS deal_currency,
         o.id AS order_id, o.status AS order_status, o.payment_provider, o.payment_state, o.external_order_id,
         o.settlement_note, o.is_sample AS order_is_sample, o.market_type AS order_market_type,
         o.total_amount AS order_total, o.currency AS order_currency, o.created_at AS order_created_at,
         o.updated_at AS order_updated_at
  FROM negotiations n
  JOIN buyers b ON b.id = n.buyer_id
  JOIN users bu ON bu.id = b.user_id
  JOIN sellers s ON s.id = n.seller_id
  JOIN products p ON p.id = n.product_id
  LEFT JOIN deals d ON d.negotiation_id = n.id
  LEFT JOIN orders o ON o.deal_id = d.id
`;
function mapOffer(row) {
  return {
    id: String(row.id),
    negotiationId: String(row.negotiation_id),
    submittedBy: row.submitted_by,
    agentType: String(row.agent_type ?? "POLICY"),
    unitPrice: roundMoney(toNumber(row.unit_price)),
    totalPrice: roundMoney(toNumber(row.total_price)),
    quantity: toNumber(row.quantity),
    validationStatus: row.validation_status,
    kind: row.kind ?? "OFFER",
    message: String(row.message ?? ""),
    explanation: String(row.explanation ?? ""),
    round: toNumber(row.round, 1),
    createdAt: toIso(row.created_at)
  };
}
function mapDeal(row) {
  return {
    id: String(row.deal_id ?? row.id),
    negotiationId: String(row.negotiation_id),
    agreedUnitPrice: roundMoney(toNumber(row.agreed_unit_price)),
    agreedQuantity: toNumber(row.agreed_quantity),
    totalAmount: roundMoney(toNumber(row.total_amount)),
    currency: String(row.deal_currency ?? row.currency),
    status: row.deal_status,
    marketType: row.deal_market_type ?? row.market_type,
    acceptedAt: row.accepted_at ? toIso(row.accepted_at) : null,
    buyerConfirmedAt: row.buyer_confirmed_at ? toIso(row.buyer_confirmed_at) : null,
    createdAt: row.created_at ? toIso(row.created_at) : void 0
  };
}
function mapOrder(row) {
  return {
    id: String(row.order_id),
    dealId: String(row.deal_id),
    sellerId: String(row.seller_id),
    buyerId: String(row.buyer_id),
    customerName: row.buyer_name ? String(row.buyer_name) : void 0,
    productName: row.product_name ? String(row.product_name) : void 0,
    paymentProvider: row.payment_provider,
    externalOrderId: row.external_order_id ? String(row.external_order_id) : null,
    marketType: row.order_market_type,
    status: row.order_status,
    paymentState: row.payment_state,
    totalAmount: roundMoney(toNumber(row.order_total)),
    currency: String(row.order_currency),
    isSample: row.order_is_sample === true,
    settlementNote: row.settlement_note ? String(row.settlement_note) : null,
    createdAt: toIso(row.order_created_at),
    updatedAt: toIso(row.order_updated_at)
  };
}
function mapNegotiationSummary(row, currentOffer) {
  const agreed = row.deal_status === "ACCEPTED" || row.deal_status === "CONSUMED";
  return {
    id: String(row.id),
    status: row.status,
    buyerId: String(row.buyer_id),
    buyerName: String(row.buyer_name),
    buyerCountry: String(row.buyer_country),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name),
    sellerCountry: String(row.seller_country),
    productId: String(row.product_id),
    productName: String(row.product_name),
    productSku: String(row.product_sku),
    category: String(row.product_category),
    quantity: toNumber(row.requested_quantity),
    currency: String(row.currency),
    listedPrice: roundMoney(toNumber(row.listed_price)),
    budgetTotal: row.budget_total === null ? null : roundMoney(toNumber(row.budget_total)),
    marketType: row.market_type,
    roundsUsed: toNumber(row.rounds_used),
    maxRounds: toNumber(row.max_rounds),
    agentMode: String(row.agent_mode ?? "POLICY"),
    isSample: row.is_sample === true,
    currentOffer,
    agreedUnitPrice: agreed ? roundMoney(toNumber(row.agreed_unit_price)) : null,
    totalAmount: agreed ? roundMoney(toNumber(row.total_amount)) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}
function canAccess(row, auth) {
  if (auth.user.role === "ADMIN") return true;
  if (auth.buyer && String(row.buyer_user_id) === auth.user.id) return true;
  if (auth.seller && String(row.seller_user_id) === auth.user.id) return true;
  return false;
}
async function loadOffers(negotiationId, tx) {
  const db = tx ?? await getDb();
  const rows = await db.query(`SELECT * FROM offers WHERE negotiation_id = $1 ORDER BY created_at ASC, round ASC`, [
    negotiationId
  ]);
  return rows.map(mapOffer);
}
async function getNegotiationDetail(id, auth) {
  const db = await getDb();
  const rows = await db.query(`${NEG_SELECT} WHERE n.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw notFound("Negotiation not found");
  if (!canAccess(row, auth)) throw forbidden("This negotiation belongs to another business or buyer.");
  if (row.status === "OPEN" && new Date(toIso(row.expires_at)).getTime() < Date.now()) {
    await db.query(`UPDATE negotiations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND status = 'OPEN'`, [id]);
    row.status = "EXPIRED";
  }
  const offers = await loadOffers(id);
  const lastOffer = [...offers].reverse().find((o) => o.kind !== "REJECTION") ?? offers[offers.length - 1] ?? null;
  const rulesRows = await db.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [row.product_id]);
  const rules = rulesRows[0] ? mapRules(rulesRows[0]) : null;
  const deal = row.deal_id ? mapDeal({ ...row, negotiation_id: row.id }) : null;
  return {
    ...mapNegotiationSummary(row, lastOffer),
    offers,
    deal,
    order: row.order_id ? mapOrder(row) : null,
    policy: {
      minimumQuantity: rules?.minimumQuantity ?? 1,
      maxRounds: toNumber(row.max_rounds, 5),
      bulkTiers: (rules?.bulkDiscounts ?? []).map((t) => ({
        minimumQuantity: t.minimumQuantity,
        discountPercent: t.discountPercent
      })),
      approvalRequired: Boolean(rules?.approvalRequired),
      roundLimitReached: toNumber(row.rounds_used) >= toNumber(row.max_rounds)
    },
    expiresAt: toIso(row.expires_at),
    availableStock: toNumber(row.product_stock)
  };
}
async function createNegotiation(auth, input) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT p.*, s.business_name, s.store_slug, s.country AS seller_country, s.currency AS seller_currency,
            s.active AS seller_active
     FROM products p JOIN sellers s ON s.id = p.seller_id
     WHERE p.id = $1`,
    [input.productId]
  );
  const row = rows[0];
  if (!row || row.active !== true || row.seller_active !== true) throw notFound("This product is not available.");
  const ruleRows = await db.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [input.productId]);
  if (!ruleRows[0]) throw conflict("This product does not have negotiation rules yet.");
  const product = mapProduct(row);
  const rules = mapRules(ruleRows[0]);
  const policy = policyFromRules(rules, product);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw badRequest("Enter a quantity of at least one.");
  if (input.quantity < rules.minimumQuantity) {
    throw badRequest(`This seller\u2019s minimum order is ${rules.minimumQuantity} units.`);
  }
  if (input.quantity > product.stock) {
    throw conflict(`Only ${product.stock} units are in stock. Reduce the quantity or ask the seller.`);
  }
  if (input.unitPrice !== void 0) {
    if (input.unitPrice <= 0 || input.unitPrice > product.listedPrice) {
      throw badRequest("The opening offer must be above zero and no higher than the listed price.");
    }
  }
  if (input.budgetTotal != null && input.budgetTotal <= 0) throw badRequest("Enter a budget above zero.");
  const marketType = resolveMarket(String(row.seller_country), auth.buyer.country);
  const negotiationId = newId();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1e3);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,$9,0,$10,$11,NULL,FALSE,$12,NOW(),NOW())`,
      [
        negotiationId,
        auth.buyer.id,
        row.seller_id,
        input.productId,
        input.quantity,
        product.currency,
        product.listedPrice,
        input.budgetTotal ?? null,
        marketType,
        rules.maxRounds,
        agentMode(),
        expiresAt
      ]
    );
    if (input.unitPrice !== void 0) {
      const check = validateOffer({
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        stock: product.stock,
        policy
      });
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,$7,'OFFER',$8,$9,1)`,
        [
          newId(),
          negotiationId,
          agentMode(),
          input.unitPrice,
          money(input.unitPrice * input.quantity),
          input.quantity,
          check.code,
          input.message || `Opening offer of ${formatMoney(input.unitPrice, product.currency)} per unit.`,
          check.message
        ]
      );
      await tx.query(
        `UPDATE negotiations SET rounds_used = 1, last_actor = 'BUYER_AGENT', updated_at = NOW() WHERE id = $1`,
        [negotiationId]
      );
    }
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: "negotiation.created",
    resourceType: "negotiation",
    resourceId: negotiationId,
    metadata: { productId: input.productId, quantity: input.quantity, marketType }
  });
  return getNegotiationDetail(negotiationId, auth);
}
async function reserveStock(tx, productId, quantity) {
  const updated = await tx.query(
    `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1 RETURNING stock`,
    [quantity, productId]
  );
  if (updated.length === 0) {
    throw conflict("Stock changed while this deal was being finalised. The deal was not accepted.");
  }
}
async function createDeal(tx, row, unitPrice, needsApproval) {
  const quantity = toNumber(row.requested_quantity);
  const currency = String(row.currency);
  const dealId = newId();
  const total = money(unitPrice * quantity);
  if (needsApproval) {
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING_APPROVAL',$7,FALSE,NULL)`,
      [dealId, row.id, unitPrice, quantity, total, currency, row.market_type]
    );
    await tx.query(`UPDATE negotiations SET status = 'AWAITING_APPROVAL', updated_at = NOW() WHERE id = $1`, [row.id]);
  } else {
    await reserveStock(tx, String(row.product_id), quantity);
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6,'ACCEPTED',$7,FALSE,NOW())`,
      [dealId, row.id, unitPrice, quantity, total, currency, row.market_type]
    );
    await tx.query(`UPDATE negotiations SET status = 'AGREED', updated_at = NOW() WHERE id = $1`, [row.id]);
  }
}
async function runNegotiationStep(id, auth) {
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const negRows = await tx.query(`${NEG_SELECT} WHERE n.id = $1 FOR UPDATE OF n`, [id]);
    const row = negRows[0];
    if (!row) throw notFound("Negotiation not found");
    if (!canAccess(row, auth)) throw forbidden("This negotiation belongs to another business or buyer.");
    if (row.status !== "OPEN") return null;
    if (new Date(toIso(row.expires_at)).getTime() < Date.now()) {
      await tx.query(`UPDATE negotiations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`, [id]);
      return null;
    }
    const productRows = await tx.query(`SELECT * FROM products WHERE id = $1 FOR UPDATE`, [row.product_id]);
    const product = mapProduct(productRows[0]);
    const rulesRows = await tx.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [row.product_id]);
    if (!rulesRows[0]) throw conflict("Pricing rules are missing for this product.");
    const rules = mapRules(rulesRows[0]);
    const policy = policyFromRules(rules, product);
    const offers = await loadOffers(id, tx);
    const lastOffer = offers[offers.length - 1] ?? null;
    const lastBuyer = [...offers].reverse().find((o) => o.submittedBy === "BUYER_AGENT" && o.kind === "OFFER") ?? null;
    const lastSeller = [...offers].reverse().find((o) => o.submittedBy === "SELLER_AGENT" && o.kind === "OFFER") ?? null;
    const buyerTurn = !lastOffer || lastOffer.submittedBy === "SELLER_AGENT" || lastOffer.kind === "ACCEPTANCE";
    const quantity = toNumber(row.requested_quantity);
    const currency = String(row.currency);
    const listedPrice = roundMoney(toNumber(row.listed_price));
    const budgetTotal = row.budget_total === null ? null : toNumber(row.budget_total);
    const round = Math.max(1, toNumber(row.rounds_used));
    if (buyerTurn) {
      const buyerRound = toNumber(row.rounds_used) + 1;
      const decision2 = buyerDecision({
        listedPrice,
        sellerUnitPrice: lastSeller?.unitPrice ?? null,
        quantity,
        budgetTotal,
        previousOwnOffer: lastBuyer?.unitPrice ?? null,
        round: buyerRound,
        maxRounds: rules.maxRounds
      });
      if (decision2.type === "ACCEPT" && lastSeller) {
        const offerId3 = newId();
        await tx.query(
          `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
           VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,'VALID','ACCEPTANCE',$7,$8,$9)`,
          [
            offerId3,
            id,
            agentMode(),
            lastSeller.unitPrice,
            money(lastSeller.unitPrice * quantity),
            quantity,
            `Accepted at ${formatMoney(lastSeller.unitPrice, currency)} per unit.`,
            decision2.explanation,
            lastSeller.round
          ]
        );
        const needsApproval = rules.approvalRequired || requiresApproval(policy, lastSeller.unitPrice);
        await createDeal(tx, row, lastSeller.unitPrice, needsApproval);
        await tx.query(`UPDATE negotiations SET last_actor = 'BUYER_AGENT', updated_at = NOW() WHERE id = $1`, [id]);
        return {
          offerId: offerId3,
          agent: "BUYER_AGENT",
          kind: "ACCEPTANCE",
          decision: "ACCEPT",
          unitPrice: lastSeller.unitPrice,
          quantity,
          currency,
          productName: String(row.product_name),
          businessName: String(row.seller_name),
          listedPrice,
          round: lastSeller.round,
          explanation: decision2.explanation,
          budgetTotal
        };
      }
      if (decision2.type === "REJECT" || decision2.unitPrice === null) {
        const reference = lastSeller?.unitPrice ?? lastBuyer?.unitPrice ?? listedPrice;
        const offerId3 = newId();
        await tx.query(
          `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
           VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,'VALID','REJECTION',$7,$8,$9)`,
          [
            offerId3,
            id,
            agentMode(),
            reference,
            money(reference * quantity),
            quantity,
            "The buyer ended the negotiation without a deal.",
            decision2.explanation,
            round
          ]
        );
        await tx.query(
          `UPDATE negotiations SET status = 'REJECTED', last_actor = 'BUYER_AGENT', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        return {
          offerId: offerId3,
          agent: "BUYER_AGENT",
          kind: "REJECTION",
          decision: "REJECT",
          unitPrice: reference,
          quantity,
          currency,
          productName: String(row.product_name),
          businessName: String(row.seller_name),
          listedPrice,
          round,
          explanation: decision2.explanation,
          budgetTotal
        };
      }
      const unitPrice = roundMoney(decision2.unitPrice);
      const check = validateOffer({ unitPrice, quantity, stock: product.stock, policy });
      const offerId2 = newId();
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,$7,'OFFER',$8,$9,$10)`,
        [
          offerId2,
          id,
          agentMode(),
          unitPrice,
          money(unitPrice * quantity),
          quantity,
          check.code,
          `Offering ${formatMoney(unitPrice, currency)} per unit for ${quantity} units.`,
          decision2.explanation,
          buyerRound
        ]
      );
      await tx.query(
        `UPDATE negotiations SET rounds_used = $1, last_actor = 'BUYER_AGENT', agent_mode = $2, updated_at = NOW() WHERE id = $3`,
        [buyerRound, agentMode(), id]
      );
      return {
        offerId: offerId2,
        agent: "BUYER_AGENT",
        kind: "OFFER",
        decision: "OFFER",
        unitPrice,
        quantity,
        currency,
        productName: String(row.product_name),
        businessName: String(row.seller_name),
        listedPrice,
        round: buyerRound,
        explanation: decision2.explanation,
        budgetTotal
      };
    }
    if (!lastBuyer) throw conflict("The buyer has not placed an offer yet.");
    const decision = sellerDecision({
      offerUnitPrice: lastBuyer.unitPrice,
      quantity,
      stock: product.stock,
      policy,
      round: lastBuyer.round
    });
    if (decision.type === "ACCEPT") {
      const offerId2 = newId();
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'SELLER_AGENT',$3,$4,$5,$6,'VALID','ACCEPTANCE',$7,$8,$9)`,
        [
          offerId2,
          id,
          agentMode(),
          decision.unitPrice,
          money(decision.unitPrice * quantity),
          quantity,
          `Accepted at ${formatMoney(decision.unitPrice, currency)} per unit.`,
          decision.explanation,
          lastBuyer.round
        ]
      );
      const needsApproval = rules.approvalRequired || requiresApproval(policy, decision.unitPrice);
      await createDeal(tx, row, decision.unitPrice, needsApproval);
      await tx.query(`UPDATE negotiations SET last_actor = 'SELLER_AGENT', updated_at = NOW() WHERE id = $1`, [id]);
      return {
        offerId: offerId2,
        agent: "SELLER_AGENT",
        kind: "ACCEPTANCE",
        decision: "ACCEPT",
        unitPrice: decision.unitPrice,
        quantity,
        currency,
        productName: String(row.product_name),
        businessName: String(row.seller_name),
        listedPrice,
        round: lastBuyer.round,
        explanation: decision.explanation,
        budgetTotal
      };
    }
    if (decision.type === "REJECT") {
      const offerId2 = newId();
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'SELLER_AGENT',$3,$4,$5,$6,$7,'REJECTION',$8,$9,$10)`,
        [
          offerId2,
          id,
          agentMode(),
          lastBuyer.unitPrice,
          money(lastBuyer.unitPrice * quantity),
          quantity,
          lastBuyer.validationStatus,
          "The seller ended the negotiation without a deal.",
          decision.explanation,
          lastBuyer.round
        ]
      );
      await tx.query(
        `UPDATE negotiations SET status = 'REJECTED', last_actor = 'SELLER_AGENT', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      return {
        offerId: offerId2,
        agent: "SELLER_AGENT",
        kind: "REJECTION",
        decision: "REJECT",
        unitPrice: lastBuyer.unitPrice,
        quantity,
        currency,
        productName: String(row.product_name),
        businessName: String(row.seller_name),
        listedPrice,
        round: lastBuyer.round,
        explanation: decision.explanation,
        budgetTotal
      };
    }
    const counter = roundMoney(decision.unitPrice);
    const counterCheck = validateOffer({ unitPrice: counter, quantity, stock: product.stock, policy });
    if (!counterCheck.valid) {
      logger.error("counter_outside_authority", { negotiationId: id, counter });
      throw new Error("Generated counteroffer failed authoritative validation");
    }
    const offerId = newId();
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
       VALUES ($1,$2,'SELLER_AGENT',$3,$4,$5,$6,'VALID','OFFER',$7,$8,$9)`,
      [
        offerId,
        id,
        agentMode(),
        counter,
        money(counter * quantity),
        quantity,
        `Countering at ${formatMoney(counter, currency)} per unit.`,
        decision.explanation,
        lastBuyer.round
      ]
    );
    await tx.query(`UPDATE negotiations SET last_actor = 'SELLER_AGENT', agent_mode = $1, updated_at = NOW() WHERE id = $2`, [
      agentMode(),
      id
    ]);
    return {
      offerId,
      agent: "SELLER_AGENT",
      kind: "OFFER",
      decision: "COUNTER",
      unitPrice: counter,
      quantity,
      currency,
      productName: String(row.product_name),
      businessName: String(row.seller_name),
      listedPrice,
      round: lastBuyer.round,
      explanation: decision.explanation,
      budgetTotal
    };
  });
  if (result && result.offerId) {
    try {
      const generated = result.agent === "SELLER_AGENT" ? await sellerAgentMessage({
        businessName: result.businessName,
        productName: result.productName,
        quantity: result.quantity,
        currency: result.currency,
        listedPrice: result.listedPrice,
        unitPrice: result.unitPrice,
        round: result.round,
        decision: result.decision === "ACCEPT" ? "ACCEPT" : result.decision === "REJECT" ? "REJECT" : "COUNTER",
        explanation: result.explanation
      }) : await buyerAgentMessage({
        productName: result.productName,
        quantity: result.quantity,
        unitPrice: result.unitPrice,
        currency: result.currency,
        round: result.round,
        decision: result.decision === "ACCEPT" ? "ACCEPT" : result.decision === "REJECT" ? "REJECT" : "OFFER",
        budgetTotal: result.budgetTotal,
        explanation: result.explanation
      });
      if (generated.mode === "GEMINI") {
        await db.query(`UPDATE offers SET message = $1, agent_type = 'GEMINI' WHERE id = $2`, [
          generated.message,
          result.offerId
        ]);
      }
    } catch (error) {
      logger.warn("agent_message_fallback", { message: error.message });
    }
  }
  return getNegotiationDetail(id, auth);
}
async function listNegotiations(auth, filters) {
  const db = await getDb();
  const where = [];
  const params = [];
  if (auth.buyer) {
    params.push(auth.buyer.id);
    where.push(`n.buyer_id = $${params.length}`);
  } else if (auth.seller) {
    params.push(auth.seller.id);
    where.push(`n.seller_id = $${params.length}`);
  } else {
    where.push("1=0");
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`n.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(COALESCE(bu.name,'')) LIKE $${params.length})`);
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const rows = await db.query(
    `${NEG_SELECT} WHERE ${where.join(" AND ")} ORDER BY n.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const countRows = await db.query(
    `SELECT COUNT(*)::text AS count FROM negotiations n
     JOIN products p ON p.id = n.product_id
     JOIN buyers b ON b.id = n.buyer_id JOIN users bu ON bu.id = b.user_id
     WHERE ${where.join(" AND ")}`,
    params
  );
  const ids = rows.map((r) => String(r.id));
  const latest = /* @__PURE__ */ new Map();
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const offerRows = await db.query(
      `SELECT DISTINCT ON (negotiation_id) * FROM offers WHERE negotiation_id IN (${placeholders})
       ORDER BY negotiation_id, created_at DESC, round DESC`,
      ids
    );
    for (const offerRow of offerRows) latest.set(String(offerRow.negotiation_id), mapOffer(offerRow));
  }
  return {
    negotiations: rows.map((row) => {
      const summary = mapNegotiationSummary(row, latest.get(String(row.id)) ?? null);
      return {
        ...summary,
        orderStatus: row.order_status ? String(row.order_status) : null,
        orderId: row.order_id ? String(row.order_id) : null,
        paymentProvider: row.payment_provider ? String(row.payment_provider) : null
      };
    }),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize
  };
}
async function confirmDeal(id, auth) {
  const db = await getDb();
  const detail = await getNegotiationDetail(id, auth);
  if (!detail.deal) throw conflict("There is no agreed deal to confirm yet.");
  if (detail.deal.status !== "ACCEPTED") throw conflict("This deal is not ready for confirmation.");
  if (detail.status !== "AGREED") throw conflict("This negotiation is not in an agreed state.");
  await db.query(
    `UPDATE deals SET buyer_confirmed_at = COALESCE(buyer_confirmed_at, NOW()) WHERE id = $1`,
    [detail.deal.id]
  );
  await audit({
    actor: { id: auth.user.id, role: "BUYER" },
    action: "deal.confirmed",
    resourceType: "deal",
    resourceId: detail.deal.id,
    metadata: { total: detail.deal.totalAmount, currency: detail.deal.currency }
  });
  return getNegotiationDetail(id, auth);
}
async function approveDeal(id, auth) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const rows = await tx.query(`${NEG_SELECT} WHERE n.id = $1 FOR UPDATE OF n`, [id]);
    const row = rows[0];
    if (!row) throw notFound("Negotiation not found");
    if (String(row.seller_user_id) !== auth.user.id) throw forbidden("Only the seller can approve this deal.");
    if (row.deal_status !== "PENDING_APPROVAL") throw conflict("This deal is not awaiting seller approval.");
    const productRows = await tx.query(`SELECT * FROM products WHERE id = $1 FOR UPDATE`, [row.product_id]);
    const product = mapProduct(productRows[0]);
    if (product.stock < toNumber(row.agreed_quantity)) {
      throw conflict("Not enough stock remains to approve this deal. Restock or reject the deal.");
    }
    await reserveStock(tx, product.id, toNumber(row.agreed_quantity));
    await tx.query(`UPDATE deals SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = $1`, [row.deal_id]);
    await tx.query(`UPDATE negotiations SET status = 'AGREED', updated_at = NOW() WHERE id = $1`, [id]);
  });
  await audit({
    actor: { id: auth.user.id, role: "SELLER" },
    action: "deal.approved",
    resourceType: "negotiation",
    resourceId: id
  });
  return getNegotiationDetail(id, auth);
}
async function rejectNegotiation(id, auth, reason) {
  const detail = await getNegotiationDetail(id, auth);
  if (!["OPEN", "AWAITING_APPROVAL"].includes(detail.status)) {
    throw conflict("This negotiation can no longer be rejected.");
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (detail.deal && detail.deal.status === "PENDING_APPROVAL") {
      await tx.query(`UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING_APPROVAL'`, [detail.deal.id]);
    }
    await tx.query(
      `UPDATE negotiations SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 AND status IN ('OPEN','AWAITING_APPROVAL')`,
      [id]
    );
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: "negotiation.rejected",
    resourceType: "negotiation",
    resourceId: id,
    metadata: { reason: reason ?? null }
  });
  return getNegotiationDetail(id, auth);
}
async function cancelNegotiation(id, auth, reason) {
  const detail = await getNegotiationDetail(id, auth);
  if (detail.order && ["PAID", "SETTLED", "FULFILLED"].includes(detail.order.status)) {
    throw conflict("A paid order cannot be cancelled here.");
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (detail.deal) {
      const rows = await tx.query(
        `UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'ACCEPTED' RETURNING agreed_quantity, negotiation_id`,
        [detail.deal.id]
      );
      if (rows[0]) {
        await tx.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [
          toNumber(rows[0].agreed_quantity),
          detail.productId
        ]);
      } else {
        await tx.query(`UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING_APPROVAL'`, [
          detail.deal.id
        ]);
      }
    }
    if (detail.order) {
      await tx.query(
        `UPDATE orders SET status = 'CANCELLED', payment_state = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('PAID','SETTLED','FULFILLED')`,
        [detail.order.id]
      );
      await tx.query(`UPDATE payments SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1 AND status <> 'COMPLETED'`, [
        detail.order.id
      ]);
    }
    await tx.query(
      `UPDATE negotiations SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND status IN ('OPEN','AWAITING_APPROVAL','AGREED')`,
      [id]
    );
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: "negotiation.cancelled",
    resourceType: "negotiation",
    resourceId: id,
    metadata: { reason: reason ?? null }
  });
  return getNegotiationDetail(id, auth);
}
async function getNegotiationForPayment(id, auth) {
  const detail = await getNegotiationDetail(id, auth);
  if (!detail.deal) throw conflict("No deal exists for this negotiation.");
  if (detail.deal.status !== "ACCEPTED") throw conflict("The deal must be accepted before payment.");
  return detail;
}
var NEGOTIATION_STATUSES = Object.keys(NEGOTIATION_LABEL);

// src/services/negotiation-offers.ts
async function submitBuyerOffer(negotiationId, auth, input) {
  const db = await getDb();
  const created = await db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT n.*, p.currency AS product_currency FROM negotiations n
       JOIN products p ON p.id = n.product_id
       WHERE n.id = $1 AND n.buyer_id = $2 FOR UPDATE OF n`,
      [negotiationId, auth.buyer.id]
    );
    const neg = rows[0];
    if (!neg) throw badRequest("Negotiation not found for this buyer.");
    if (neg.status !== "OPEN") throw conflict("This negotiation is no longer open.");
    if (new Date(String(neg.expires_at)).getTime() < Date.now()) {
      await tx.query(`UPDATE negotiations SET status = 'EXPIRED' WHERE id = $1`, [negotiationId]);
      throw conflict("This negotiation has expired.");
    }
    if (Number(neg.requested_quantity) !== input.quantity) {
      throw badRequest(`This negotiation is for ${neg.requested_quantity} units.`);
    }
    const last = await tx.query(
      `SELECT submitted_by, kind FROM offers WHERE negotiation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [negotiationId]
    );
    if (last[0] && last[0].submitted_by === "BUYER_AGENT" && last[0].kind === "OFFER") {
      throw conflict("The seller agent has not responded to the previous offer yet.");
    }
    const productRows = await tx.query(`SELECT * FROM products WHERE id = $1 FOR UPDATE`, [neg.product_id]);
    const rulesRows = await tx.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [neg.product_id]);
    if (!rulesRows[0]) throw conflict("Pricing rules are missing for this product.");
    const product = mapProduct(productRows[0]);
    const rules = mapRules(rulesRows[0]);
    const policy = policyFromRules(rules, product);
    const check = validateOffer({
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      stock: product.stock,
      policy
    });
    const round = Number(neg.rounds_used) + 1;
    if (round > rules.maxRounds) throw conflict("This negotiation has reached its round limit.");
    const offerId = newId();
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
       VALUES ($1,$2,'BUYER',$3,$4,$5,$6,$7,'OFFER',$8,$9,$10)`,
      [
        offerId,
        negotiationId,
        "HUMAN",
        input.unitPrice,
        money(input.unitPrice * input.quantity),
        input.quantity,
        check.code,
        input.message || `Buyer offered ${formatMoney(input.unitPrice, product.currency)} per unit.`,
        check.valid ? "Submitted by the buyer within the seller\u2019s authorised range." : check.message,
        round
      ]
    );
    await tx.query(
      `UPDATE negotiations SET rounds_used = $1, last_actor = 'BUYER', updated_at = NOW() WHERE id = $2`,
      [round, negotiationId]
    );
    return {
      offerId,
      unitPrice: roundMoney(input.unitPrice),
      quantity: input.quantity,
      currency: product.currency,
      round,
      productName: product.name,
      valid: check.valid
    };
  });
  if (!created.valid) {
    await audit({
      actor: { id: auth.user.id, role: "BUYER" },
      action: "offer.submitted_outside_range",
      resourceType: "negotiation",
      resourceId: negotiationId,
      metadata: { unitPrice: created.unitPrice, quantity: created.quantity }
    });
  }
  return getNegotiationDetail(negotiationId, auth);
}

export {
  env,
  integrationSnapshot,
  logger,
  getDb,
  closeDb,
  toNumber,
  toBool,
  toIso,
  newId,
  hashPassword,
  verifyPassword,
  sha256,
  randomToken,
  apiKey,
  slugify,
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  COUNTRIES,
  roundMoney,
  formatMoney,
  minimumAllowedPrice,
  targetPrice,
  emailSchema,
  passwordSchema,
  SignupInput,
  LoginInput,
  SellerProfileInput,
  BuyerProfileInput,
  ProductInput,
  RulesInput,
  OfferInput,
  NegotiationCreateInput,
  BuyerIntentInput,
  CATEGORIES,
  pathParam,
  parseWith,
  money,
  audit,
  geminiPing,
  parseIntent,
  analyticsNarrative,
  validateOffer,
  mapProduct,
  mapRules,
  policyFromRules,
  listSellerProducts,
  getSellerProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getRulesForProduct,
  listRules,
  assertRulesConsistent,
  upsertRules,
  listPublicStores,
  getPublicStore,
  listPublicStoreProducts,
  getPublicProduct,
  searchMarket,
  getNegotiationDetail,
  createNegotiation,
  runNegotiationStep,
  listNegotiations,
  confirmDeal,
  approveDeal,
  rejectNegotiation,
  cancelNegotiation,
  getNegotiationForPayment,
  submitBuyerOffer
};
//# sourceMappingURL=chunk-IQWLNGBE.js.map