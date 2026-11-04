import type {
  AnalyticsSummary,
  Deal,
  MarketType,
  NegotiationStatus,
  Offer,
  OrderStatus,
  OrderSummary,
  PaymentSummary,
  Product,
  PublicProduct,
  PublicStore,
  Role,
  SellerRules,
  User,
} from '@bhavai/shared';

export type {
  AnalyticsSummary,
  Deal,
  MarketType,
  NegotiationStatus,
  Offer,
  OrderStatus,
  OrderSummary,
  PaymentSummary,
  Product,
  PublicProduct,
  PublicStore,
  SellerRules,
  Role,
  User,
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
  onboardingComplete: boolean;
};

export type BuyerProfile = {
  id: string;
  userId: string;
  companyName: string;
  country: string;
  currency: string;
  preferences: string;
};

export type Me = {
  user: User;
  seller: SellerProfile | null;
  buyer: BuyerProfile | null;
  source: 'session' | 'api_key';
  apiKeys: number;
  integrations: { gemini: boolean; paypal: boolean; mcp: boolean };
};

export type NegotiationSummaryView = {
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
  orderStatus?: string | null;
  orderId?: string | null;
  paymentProvider?: string | null;
};

export type NegotiationDetailView = NegotiationSummaryView & {
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

export type OrderDetail = OrderSummary & { payment: PaymentSummary | null };

export type OrderListRow = OrderSummary & {
  customerName?: string;
  productName?: string;
};

export type PaymentResponse = {
  payment: PaymentSummary;
  orderId: string;
  market: MarketType;
  mode: 'MANUAL' | 'PAYPAL';
  settlementNote: string | null;
  amountDisplay?: string;
};

export type AnalyticsWorkspace = {
  analytics: AnalyticsSummary;
  negotiations: Array<{
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
  }>;
  products: Array<{
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
  }>;
  transactions: OrderSummary[];
  generatedAt: string;
  agentMode: 'GEMINI' | 'POLICY';
  llmConfigured: boolean;
  currency: string;
};

export type OnboardingView = {
  seller: SellerProfile;
  steps: Array<{ id: string; label: string; complete: boolean; detail: string }>;
  counts: { products: number; activeProducts: number; rules: number };
  published: boolean;
  storeUrl: string;
};

export type IntegrationStatusView = {
  database: { mode: string; label: string; ok: boolean };
  gemini: { configured: boolean; model: string | null; lastCheck?: string | null };
  paypal: { configured: boolean; environment: string; webhookConfigured: boolean; clientIdSuffix?: string | null };
  mcp: { enabled: boolean; path: string; authenticated: boolean; toolCount: number };
  channel3: { configured: boolean; note: string };
  email: { configured: boolean; note: string };
};

export type ApiKeyView = {
  id: string;
  label: string;
  prefix: string;
  role: Role;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type McpToolView = {
  name: string;
  title: string;
  description: string;
  audience: 'BUYER' | 'SELLER' | 'COMMERCE';
  invocation: string;
};

export type BuyerSummary = {
  counts: { open: number; agreed: number; orders: number };
  negotiations: NegotiationSummaryView[];
  orders: Array<{
    id: string;
    status: string;
    paymentState: string;
    totalAmount: number;
    currency: string;
    paymentProvider: string;
    marketType: string;
    createdAt: string;
    isSample: boolean;
    productName: string;
    sellerName: string;
  }>;
  recommended: PublicProduct[];
  agentMode: 'GEMINI' | 'POLICY';
};

export type SellerDashboard = {
  analytics: AnalyticsSummary;
  negotiations: NegotiationSummaryView[];
  recentOrders: Array<{
    id: string;
    status: string;
    paymentProvider: string;
    totalAmount: number;
    currency: string;
    customerName: string;
    productName: string;
    createdAt: string;
    marketType: string;
    isSample: boolean;
  }>;
  integrations: { gemini: boolean; paypal: boolean; mcp: boolean };
};

export type ProductListResult = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
};

export type NegotiationListResult = {
  negotiations: NegotiationSummaryView[];
  total: number;
  page: number;
  pageSize: number;
};

export type OrderListResult = {
  orders: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type RuleListRow = {
  rules: SellerRules;
  product: {
    id: string;
    name: string;
    sku: string;
    listedPrice: number;
    currency: string;
    stock: number;
    active: boolean;
  };
  minimumAllowed: number;
};

export type RulePreview = {
  minimumAllowed: number;
  target: number;
  bulkTiers: Array<{ minimumQuantity: number; discountPercent: number }>;
  sample: { valid: boolean; code: string; message: string; minimumAllowed?: number } | null;
  note: string;
};

export type CsvPreview = {
  headers: string[];
  totalRows: number;
  sampleRows: Array<Record<string, string>>;
  suggestedMapping: Record<string, string>;
  unmappedHeaders: string[];
  errors: Array<{ row: number; field: string; message: string }>;
  validCount: number;
  duplicateSkus: string[];
};

export type CsvImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  products: Product[];
};

export type IntentResult = {
  intent: {
    productQuery: string;
    quantity: number;
    budgetTotal: number | null;
    currency: string | null;
    category: string | null;
    urgency: string | null;
    mode: 'GEMINI' | 'POLICY';
  };
  unitBudget: number | null;
  agentMode: 'GEMINI' | 'POLICY';
  llmModel: string | null;
};

export type ApiKeyCreated = {
  key: ApiKeyView;
  secret: string;
  warning: string;
};

export type IntegrationWorkspace = {
  integrations: IntegrationStatusView;
  environment: string;
  apiBaseUrl: string;
  mcpEndpoint: string;
};

export type BuyerDiscoverResult = {
  intent: {
    productQuery: string;
    quantity: number;
    budgetTotal: number | null;
    currency: string | null;
    category: string | null;
    urgency: string | null;
    mode: 'GEMINI' | 'POLICY';
  };
  budget: { total: number; currency: string; perUnit: number | null; display: string } | null;
  products: Array<
    PublicProduct & {
      fit: {
        quantity: number;
        listedTotal: number;
        unitBudget: number | null;
        withinListedBudget: boolean;
        negotiableIntoBudget: boolean;
        unitGapPercent: number | null;
        label: string;
      };
    }
  >;
  total: number;
  agentMode: 'GEMINI' | 'POLICY';
  note: string;
};
