import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Roles, lifecycle states, and market routing                         */
/* ------------------------------------------------------------------ */

export const Role = z.enum(['SELLER', 'BUYER', 'ADMIN']);
export type Role = z.infer<typeof Role>;

export const MarketType = z.enum(['DOMESTIC', 'CROSS_BORDER']);
export type MarketType = z.infer<typeof MarketType>;

export const NegotiationStatus = z.enum([
  'OPEN',
  'AWAITING_APPROVAL',
  'AGREED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
]);
export type NegotiationStatus = z.infer<typeof NegotiationStatus>;

export const OfferActor = z.enum(['BUYER_AGENT', 'SELLER_AGENT', 'BUYER', 'SELLER']);
export type OfferActor = z.infer<typeof OfferActor>;

export const OfferValidation = z.enum([
  'VALID',
  'BELOW_MINIMUM',
  'ABOVE_LISTED',
  'QUANTITY_UNAVAILABLE',
  'BELOW_MIN_QUANTITY',
  'INVALID',
]);
export type OfferValidation = z.infer<typeof OfferValidation>;

export const DealStatus = z.enum(['PENDING_APPROVAL', 'ACCEPTED', 'CANCELLED', 'CONSUMED']);
export type DealStatus = z.infer<typeof DealStatus>;

export const OrderStatus = z.enum([
  'PENDING_PAYMENT',
  'APPROVAL_PENDING',
  'PAID',
  'SETTLEMENT_PENDING',
  'SETTLED',
  'FULFILLED',
  'CANCELLED',
  'FAILED',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum([
  'CREATED',
  'APPROVAL_PENDING',
  'APPROVED',
  'CAPTURE_PENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentProvider = z.enum(['PAYPAL', 'MANUAL']);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

/* ------------------------------------------------------------------ */
/* Countries / currencies                                              */
/* ------------------------------------------------------------------ */

export const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CurrencyCode = z.enum(CURRENCIES);

export type Country = { code: string; name: string; currency: Currency; dial: string };

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', currency: 'INR', dial: '+91' },
  { code: 'US', name: 'United States', currency: 'USD', dial: '+1' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', dial: '+44' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', dial: '+971' },
  { code: 'DE', name: 'Germany', currency: 'EUR', dial: '+49' },
  { code: 'FR', name: 'France', currency: 'EUR', dial: '+33' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', dial: '+31' },
  { code: 'SG', name: 'Singapore', currency: 'USD', dial: '+65' },
  { code: 'AU', name: 'Australia', currency: 'USD', dial: '+61' },
  { code: 'CA', name: 'Canada', currency: 'USD', dial: '+1' },
  { code: 'JP', name: 'Japan', currency: 'USD', dial: '+81' },
  { code: 'ZA', name: 'South Africa', currency: 'USD', dial: '+27' },
];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/**
 * Payment routing is decided server-side from the seller's and buyer's
 * countries. India domestic = manual settlement, never a fake PayPal success.
 */
export function resolveMarket(sellerCountry: string, buyerCountry: string): MarketType {
  return sellerCountry === 'IN' && buyerCountry === 'IN' ? 'DOMESTIC' : 'CROSS_BORDER';
}

export const MARKET_LABEL: Record<MarketType, string> = {
  DOMESTIC: 'India domestic',
  CROSS_BORDER: 'Cross-border',
};

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export const CURRENCY_META: Record<Currency, { symbol: string; locale: string; decimals: number }> = {
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  INR: { symbol: '₹', locale: 'en-IN', decimals: 2 },
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
  GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
  AED: { symbol: 'AED', locale: 'en-AE', decimals: 2 },
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, currency: string, options?: Intl.NumberFormatOptions): string {
  const meta = CURRENCY_META[currency as Currency] ?? CURRENCY_META.USD;
  const maxDigits = options?.maximumFractionDigits ?? Math.max(meta.decimals, options?.minimumFractionDigits ?? meta.decimals);
  const minDigits = options?.minimumFractionDigits ?? Math.min(meta.decimals, maxDigits);
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency,
    ...options,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(amount);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)}%`;
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function timeAgo(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/* Pricing policy types + deterministic helpers (shared for display)   */
/* ------------------------------------------------------------------ */

export type BulkRule = { minimumQuantity: number; discountPercent: number };

export type PricingPolicy = {
  listedPrice: number;
  floorPrice: number;
  maxDiscountPercent: number;
  minimumQuantity: number;
  bulkDiscounts: BulkRule[];
  maxRounds: number;
  autoAcceptThreshold: number | null;
  requireApprovalBelow: number | null;
};

/**
 * The lowest unit price a seller has authorised. This is the backend's
 * authority; the same pure function is used for display only on the seller
 * side and is never returned to buyer-facing APIs.
 */
export function minimumAllowedPrice(policy: Pick<PricingPolicy, 'listedPrice' | 'floorPrice' | 'maxDiscountPercent'>): number {
  const discountFloor = policy.listedPrice * (1 - policy.maxDiscountPercent / 100);
  return roundMoney(Math.max(policy.floorPrice, discountFloor));
}

export function applicableBulkDiscount(quantity: number, rules: BulkRule[]): BulkRule | null {
  return [...rules]
    .filter((r) => quantity >= r.minimumQuantity)
    .sort((a, b) => b.minimumQuantity - a.minimumQuantity)[0] ?? null;
}

/**
 * The seller's opening/target price for a quantity: the listed price minus the
 * best applicable bulk discount, never below the authorised minimum.
 */
export function targetPrice(policy: PricingPolicy, quantity: number): number {
  const min = minimumAllowedPrice(policy);
  const bulk = applicableBulkDiscount(quantity, policy.bulkDiscounts);
  if (!bulk) return policy.listedPrice;
  const discounted = policy.listedPrice * (1 - Math.min(bulk.discountPercent, policy.maxDiscountPercent) / 100);
  return roundMoney(Math.max(min, discounted));
}

/* ------------------------------------------------------------------ */
/* API schemas                                                        */
/* ------------------------------------------------------------------ */

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long');

export const SignupInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, 'Enter your name').max(80),
  role: z.enum(['SELLER', 'BUYER']),
  country: z.string().length(2),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const LoginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const SellerProfileInput = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name').max(100),
  country: z.string().length(2),
  currency: CurrencyCode,
  description: z.string().trim().max(1200).optional().default(''),
  storeSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Use at least 3 characters')
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens'),
  active: z.boolean().optional(),
});
export type SellerProfileInput = z.infer<typeof SellerProfileInput>;

export const BuyerProfileInput = z.object({
  companyName: z.string().trim().max(100).optional().default(''),
  country: z.string().length(2),
  currency: CurrencyCode,
  preferences: z.string().trim().max(600).optional().default(''),
});
export type BuyerProfileInput = z.infer<typeof BuyerProfileInput>;

export const ProductInput = z.object({
  name: z.string().trim().min(2, 'Enter a product name').max(140),
  description: z.string().trim().max(4000).optional().default(''),
  sku: z
    .string()
    .trim()
    .min(2, 'Enter a SKU')
    .max(48)
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, underscore or hyphen'),
  category: z.string().trim().min(2, 'Choose a category').max(60),
  images: z.array(z.string().trim().max(500)).max(6).optional().default([]),
  listedPrice: z.coerce.number().finite('Enter a price').positive('Price must be greater than zero').max(10_000_000),
  currency: CurrencyCode,
  stock: z.coerce.number().int('Use a whole number').min(0).max(1_000_000),
  unit: z.string().trim().min(1).max(20).default('piece'),
  countryOfOrigin: z.string().length(2),
  active: z.boolean().optional().default(true),
});
export type ProductInput = z.infer<typeof ProductInput>;

export const BulkRuleInput = z.object({
  minimumQuantity: z.coerce.number().int().min(2).max(1_000_000),
  discountPercent: z.coerce.number().min(0).max(90),
});

export const RulesInput = z.object({
  floorPrice: z.coerce.number().positive('Floor price must be greater than zero'),
  maxDiscountPercent: z.coerce.number().min(0).max(90),
  minimumQuantity: z.coerce.number().int().min(1).max(1_000_000),
  bulkDiscounts: z.array(BulkRuleInput).max(10).default([]),
  maxRounds: z.coerce.number().int().min(1).max(12).default(5),
  autoAcceptThreshold: z.coerce.number().positive().nullable().optional(),
  requireApprovalBelow: z.coerce.number().positive().nullable().optional(),
  approvalRequired: z.boolean().default(false),
});
export type RulesInput = z.infer<typeof RulesInput>;

export const OfferInput = z.object({
  unitPrice: z.coerce.number().finite().positive('Enter an offer above zero'),
  quantity: z.coerce.number().int().positive(),
  message: z.string().trim().max(600).optional().default(''),
});
export type OfferInput = z.infer<typeof OfferInput>;

export const NegotiationCreateInput = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  unitPrice: z.coerce.number().finite().positive().optional(),
  budgetTotal: z.coerce.number().finite().positive().nullable().optional(),
  message: z.string().trim().max(600).optional().default(''),
  buyerCountry: z.string().length(2).optional(),
});
export type NegotiationCreateInput = z.infer<typeof NegotiationCreateInput>;

export const BuyerIntentInput = z.object({
  query: z.string().trim().min(3, 'Describe what you need').max(800),
  budgetTotal: z.coerce.number().positive().nullable().optional(),
  currency: CurrencyCode.optional(),
});
export type BuyerIntentInput = z.infer<typeof BuyerIntentInput>;

export const CsvMapInput = z.object({
  mapping: z.record(z.string(), z.string()),
  defaultCurrency: CurrencyCode.optional(),
  defaultCountry: z.string().length(2).optional(),
});
export type CsvMapInput = z.infer<typeof CsvMapInput>;

/* ------------------------------------------------------------------ */
/* Domain DTOs                                                        */
/* ------------------------------------------------------------------ */

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  country: string;
  currency: string;
  createdAt?: string;
};

export type SellerProfile = {
  id: string;
  userId: string;
  businessName: string;
  country: string;
  currency: string;
  storeSlug: string;
  description: string;
  active: boolean;
  createdAt?: string;
};

export type BuyerProfile = {
  id: string;
  userId: string;
  companyName: string;
  country: string;
  currency: string;
  preferences: string;
};

export type Product = {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  images: string[];
  listedPrice: number;
  currency: string;
  stock: number;
  unit: string;
  countryOfOrigin: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicProduct = Product & {
  seller: { businessName: string; storeSlug: string; country: string; currency: string };
  negotiation: {
    negotiable: boolean;
    minimumQuantity: number;
    maxRounds: number;
    bulkTiers: Array<{ minimumQuantity: number; discountPercent: number }>;
  };
};

export type SellerRules = {
  id?: string;
  sellerId: string;
  productId: string | null;
  floorPrice: number;
  maxDiscountPercent: number;
  minimumQuantity: number;
  bulkDiscounts: BulkRule[];
  maxRounds: number;
  autoAcceptThreshold: number | null;
  requireApprovalBelow: number | null;
  approvalRequired: boolean;
  updatedAt?: string;
};

export type PublicStore = {
  id: string;
  businessName: string;
  storeSlug: string;
  description: string;
  country: string;
  currency: string;
  productCount: number;
  categories: string[];
  negotiation: {
    supported: boolean;
    maxRounds: number;
  };
  regions: string[];
  purchaseConditions: string[];
  api: {
    storefront: string;
    mcp: string;
    protocolVersion: string;
  };
};

export type Offer = {
  id: string;
  negotiationId: string;
  submittedBy: OfferActor;
  agentType: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  validationStatus: OfferValidation;
  kind: 'OFFER' | 'ACCEPTANCE' | 'REJECTION';
  message: string;
  explanation: string;
  round: number;
  createdAt: string;
};

export type NegotiationSummary = {
  id: string;
  status: NegotiationStatus;
  buyerId: string;
  buyerName: string;
  buyerCountry: string;
  sellerId: string;
  sellerName: string;
  sellerCountry: string;
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  currency: string;
  listedPrice: number;
  budgetTotal: number | null;
  marketType: MarketType;
  roundsUsed: number;
  maxRounds: number;
  agentMode: string;
  isSample: boolean;
  currentOffer: Offer | null;
  agreedUnitPrice: number | null;
  totalAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type NegotiationDetail = NegotiationSummary & {
  offers: Offer[];
  deal: Deal | null;
  order: OrderSummary | null;
  policy: {
    minimumQuantity: number;
    maxRounds: number;
    bulkTiers: Array<{ minimumQuantity: number; discountPercent: number }>;
    approvalRequired: boolean;
    roundLimitReached: boolean;
  };
  expiresAt: string | null;
  availableStock: number;
};

export type Deal = {
  id: string;
  negotiationId: string;
  agreedUnitPrice: number;
  agreedQuantity: number;
  totalAmount: number;
  currency: string;
  status: DealStatus;
  marketType: MarketType;
  acceptedAt: string | null;
  buyerConfirmedAt: string | null;
  createdAt?: string;
};

export type OrderSummary = {
  id: string;
  dealId: string;
  sellerId: string;
  buyerId: string;
  customerName?: string;
  productName?: string;
  paymentProvider: PaymentProvider;
  externalOrderId: string | null;
  marketType: MarketType;
  status: OrderStatus;
  paymentState: PaymentStatus;
  totalAmount: number;
  currency: string;
  isSample: boolean;
  settlementNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentSummary = {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  providerOrderId: string | null;
  providerCaptureId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  approvalUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalyticsSummary = {
  totals: {
    products: number;
    activeProducts: number;
    negotiationsToday: number;
    negotiationsAllTime: number;
    acceptedDeals: number;
    totalSales: number;
    pendingPayments: number;
    averageDiscountPercent: number;
    conversionRate: number;
    orders: number;
  };
  deltas: {
    negotiationsToday: number;
    acceptedDeals: number;
    totalSales: number;
  };
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  negotiationSeries: Array<{ date: string; started: number; agreed: number }>;
  topProducts: Array<{ name: string; revenue: number; quantity: number; negotiations: number }>;
  markets: Array<{ market: MarketType; count: number; value: number }>;
  discounts: { bands: Array<{ label: string; count: number }>; average: number };
  aiSummary: { text: string; mode: 'GEMINI' | 'POLICY'; generatedAt: string };
  includesSample: boolean;
};

export type NegotiationRow = {
  id: string;
  buyerName: string;
  productName: string;
  listedPrice: number;
  initialOffer: number;
  finalPrice: number | null;
  quantity: number;
  discountPercent: number;
  rounds: number;
  status: NegotiationStatus;
  currency: string;
  marketType: MarketType;
  isSample: boolean;
  createdAt: string;
};

export type ProductPerformanceRow = {
  id: string;
  name: string;
  sku: string;
  listedPrice: number;
  currency: string;
  quantitySold: number;
  negotiations: number;
  conversionRate: number;
  averageDiscount: number;
  stock: number;
  active: boolean;
};

export type IntegrationStatus = {
  database: { mode: 'postgres' | 'embedded'; label: string; ok: boolean };
  gemini: { configured: boolean; model: string | null; lastCheck?: string | null };
  paypal: { configured: boolean; environment: string; webhookConfigured: boolean; clientIdSuffix?: string | null };
  mcp: { enabled: boolean; path: string; authenticated: boolean; toolCount: number };
  channel3: { configured: boolean; note: string };
  email: { configured: boolean; note: string };
};

export type McpToolInfo = {
  name: string;
  title: string;
  description: string;
  audience: 'BUYER' | 'SELLER' | 'COMMERCE';
  invocation: string;
};

/* ------------------------------------------------------------------ */
/* UI label maps                                                      */
/* ------------------------------------------------------------------ */

export const NEGOTIATION_LABEL: Record<NegotiationStatus, string> = {
  OPEN: 'In negotiation',
  AWAITING_APPROVAL: 'Awaiting seller approval',
  AGREED: 'Deal agreed',
  REJECTED: 'No deal',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const ORDER_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Payment pending',
  APPROVAL_PENDING: 'Approval pending',
  PAID: 'Paid',
  SETTLEMENT_PENDING: 'Settlement pending',
  SETTLED: 'Settled off-platform',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  CREATED: 'Created',
  APPROVAL_PENDING: 'Awaiting approval',
  APPROVED: 'Approved',
  CAPTURE_PENDING: 'Capture pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const ROUND_LIMIT = { min: 1, max: 12 } as const;

export const CATEGORIES = [
  'Home & Decor',
  'Jewellery',
  'Textiles',
  'Handicrafts',
  'Kitchen & Dining',
  'Stationery',
  'Apparel',
  'Art',
  'Other',
] as const;
