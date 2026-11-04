import {
  roundMoney,
  type AnalyticsSummary,
  type NegotiationRow,
  type ProductPerformanceRow,
  type OrderSummary,
  type NegotiationStatus,
  type MarketType,
} from '@bhavai/shared';
import { getDb, toNumber, toIso, toBool } from '../db/index.js';
import type { SellerRow } from '../middleware/auth.js';
import { analyticsNarrative } from './agent.js';
import { logger } from '../utils/logger.js';

type NegAggRow = {
  id: string;
  status: NegotiationStatus;
  createdAt: string;
  currency: string;
  marketType: MarketType;
  isSample: boolean;
  listedPrice: number;
  quantity: number;
  buyerName: string;
  productId: string;
  productName: string;
  dealUnit: number | null;
  dealTotal: number | null;
  dealStatus: string | null;
  rounds: number;
  firstOffer: number | null;
};

type OrderAggRow = {
  id: string;
  status: string;
  paymentState: string;
  totalAmount: number;
  currency: string;
  marketType: MarketType;
  createdAt: string;
  paymentProvider: string;
  productId: string;
  productName: string;
  buyerName: string;
  isSample: boolean;
  quantity: number;
  dealId: string;
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return roundMoney(((current - previous) / previous) * 100);
}

function isPaid(status: string): boolean {
  return ['PAID', 'SETTLED', 'FULFILLED'].includes(status);
}

function dayKey(iso: string): string {
  return toIso(iso).slice(0, 10);
}

async function loadRows(sellerId: string) {
  const db = await getDb();
  const negRows = await db.query<Record<string, unknown>>(
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
    [sellerId],
  );

  const orderRows = await db.query<Record<string, unknown>>(
    `SELECT o.id, o.status, o.payment_state, o.total_amount, o.currency, o.market_type, o.created_at,
            o.payment_provider, o.is_sample, d.agreed_quantity AS quantity, d.id AS deal_id,
            p.id AS product_id, p.name AS product_name, bu.name AS buyer_name
     FROM orders o
     JOIN deals d ON d.id = o.deal_id
     JOIN negotiations n ON n.id = d.negotiation_id
     JOIN products p ON p.id = n.product_id
     JOIN buyers b ON b.id = o.buyer_id JOIN users bu ON bu.id = b.user_id
     WHERE o.seller_id = $1 ORDER BY o.created_at DESC`,
    [sellerId],
  );

  const productRows = await db.query<Record<string, unknown>>(
    `SELECT * FROM products WHERE seller_id = $1 ORDER BY name ASC`,
    [sellerId],
  );

  return {
    negotiations: negRows.map((r) => ({
      id: String(r.id),
      status: r.status as NegotiationStatus,
      createdAt: toIso(r.created_at),
      currency: String(r.currency),
      marketType: r.market_type as MarketType,
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
      firstOffer: r.first_offer === null ? null : toNumber(r.first_offer),
    })) as NegAggRow[],
    orders: orderRows.map((r) => ({
      id: String(r.id),
      status: String(r.status),
      paymentState: String(r.payment_state),
      totalAmount: toNumber(r.total_amount),
      currency: String(r.currency),
      marketType: r.market_type as MarketType,
      createdAt: toIso(r.created_at),
      paymentProvider: String(r.payment_provider),
      productId: String(r.product_id),
      productName: String(r.product_name),
      buyerName: String(r.buyer_name),
      isSample: toBool(r.is_sample),
      quantity: toNumber(r.quantity),
      dealId: String(r.deal_id),
    })) as OrderAggRow[],
    products: productRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sku: String(r.sku),
      listedPrice: toNumber(r.listed_price),
      currency: String(r.currency),
      stock: toNumber(r.stock),
      active: toBool(r.active),
      category: String(r.category),
    })),
  };
}

export async function getSellerAnalytics(seller: SellerRow): Promise<AnalyticsSummary> {
  const { negotiations, orders, products } = await loadRows(seller.id);
  const now = Date.now();
  const dayMs = 86_400_000;
  const startToday = new Date();
  startToday.setUTCHours(0, 0, 0, 0);

  const totalNegotiations = negotiations.length;
  const negotiationsToday = negotiations.filter((n) => new Date(n.createdAt).getTime() >= startToday.getTime()).length;
  const acceptedDeals = negotiations.filter((n) => n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED').length;
  const paidOrders = orders.filter((o) => isPaid(o.status));
  const totalSales = roundMoney(paidOrders.reduce((sum, o) => sum + o.totalAmount, 0));
  const pendingPayments = roundMoney(
    orders
      .filter((o) => ['PENDING_PAYMENT', 'APPROVAL_PENDING', 'SETTLEMENT_PENDING'].includes(o.status))
      .reduce((sum, o) => sum + o.totalAmount, 0),
  );

  const discountValues = negotiations
    .filter((n) => n.dealUnit !== null && n.listedPrice > 0 && (n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED'))
    .map((n) => ((n.listedPrice - (n.dealUnit as number)) / n.listedPrice) * 100);
  const averageDiscount = discountValues.length
    ? roundMoney(discountValues.reduce((a, b) => a + b, 0) / discountValues.length)
    : 0;
  const conversionRate = totalNegotiations === 0 ? 0 : roundMoney((acceptedDeals / totalNegotiations) * 100);

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

  const revenueSeries: AnalyticsSummary['revenueSeries'] = [];
  const negotiationSeries: AnalyticsSummary['negotiationSeries'] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(startToday.getTime() - i * dayMs).toISOString().slice(0, 10);
    const dayOrders = paidOrders.filter((o) => dayKey(o.createdAt) === day);
    const dayNegs = negotiations.filter((n) => dayKey(n.createdAt) === day);
    revenueSeries.push({
      date: day,
      revenue: roundMoney(dayOrders.reduce((sum, o) => sum + o.totalAmount, 0)),
      orders: dayOrders.length,
    });
    negotiationSeries.push({
      date: day,
      started: dayNegs.length,
      agreed: dayNegs.filter((n) => n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED').length,
    });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const topMap = new Map<string, { name: string; revenue: number; quantity: number; negotiations: number }>();
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
    const neg = negotiations.find((n) => n.productId === o.productId && (n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED'));
    if (neg) entry.quantity += neg.quantity;
  }
  const topProducts = [...topMap.values()]
    .filter((p) => p.negotiations > 0 || p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.negotiations - a.negotiations)
    .slice(0, 5);

  const domestic = negotiations.filter((n) => n.marketType === 'DOMESTIC');
  const crossBorder = negotiations.filter((n) => n.marketType === 'CROSS_BORDER');
  const markets: AnalyticsSummary['markets'] = [
    {
      market: 'DOMESTIC',
      count: domestic.length,
      value: roundMoney(domestic.filter((n) => n.dealTotal).reduce((s, n) => s + (n.dealTotal ?? 0), 0)),
    },
    {
      market: 'CROSS_BORDER',
      count: crossBorder.length,
      value: roundMoney(crossBorder.filter((n) => n.dealTotal).reduce((s, n) => s + (n.dealTotal ?? 0), 0)),
    },
  ];

  const bands = [
    { label: 'No discount', min: 0, max: 0.001 },
    { label: '0–5%', min: 0.001, max: 5 },
    { label: '5–10%', min: 5, max: 10 },
    { label: '10–15%', min: 10, max: 15 },
    { label: '15%+', min: 15, max: 1000 },
  ];
  const discounts = {
    bands: bands.map((b) => ({
      label: b.label,
      count: discountValues.filter((d) => d >= b.min && d < b.max).length,
    })),
    average: averageDiscount,
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
    marketSplit: { domestic: domestic.length, crossBorder: crossBorder.length },
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
      orders: orders.length,
    },
    deltas: {
      negotiationsToday: pctChange(last7.length, prev7.length),
      acceptedDeals: pctChange(
        last7.filter((n) => n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED').length,
        prev7.filter((n) => n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED').length,
      ),
      totalSales: pctChange(
        salesLast7.reduce((s, o) => s + o.totalAmount, 0),
        salesPrev7.reduce((s, o) => s + o.totalAmount, 0),
      ),
    },
    revenueSeries,
    negotiationSeries,
    topProducts,
    markets,
    discounts,
    aiSummary: {
      text: narrative.text,
      mode: narrative.mode,
      generatedAt: new Date().toISOString(),
    },
    includesSample: negotiations.some((n) => n.isSample) || orders.some((o) => o.isSample),
  } as AnalyticsSummary & { currency?: string };
}

export async function getNegotiationRows(sellerId: string): Promise<NegotiationRow[]> {
  const { negotiations } = await loadRows(sellerId);
  return negotiations.map((n) => ({
    id: n.id,
    buyerName: n.buyerName,
    productName: n.productName,
    listedPrice: n.listedPrice,
    initialOffer: n.firstOffer ?? n.listedPrice,
    finalPrice: n.dealUnit,
    quantity: n.quantity,
    discountPercent:
      n.dealUnit !== null && n.listedPrice > 0
        ? roundMoney(((n.listedPrice - n.dealUnit) / n.listedPrice) * 100)
        : 0,
    rounds: n.rounds,
    status: n.status,
    currency: n.currency,
    marketType: n.marketType,
    isSample: n.isSample,
    createdAt: n.createdAt,
  }));
}

export async function getProductPerformance(sellerId: string): Promise<ProductPerformanceRow[]> {
  const { negotiations, orders, products } = await loadRows(sellerId);
  return products.map((p) => {
    const productNegs = negotiations.filter((n) => n.productId === p.id);
    const agreed = productNegs.filter((n) => n.dealStatus === 'ACCEPTED' || n.dealStatus === 'CONSUMED');
    const discounts = agreed
      .filter((n) => n.dealUnit !== null && n.listedPrice > 0)
      .map((n) => ((n.listedPrice - (n.dealUnit as number)) / n.listedPrice) * 100);
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
      conversionRate: productNegs.length === 0 ? 0 : roundMoney((agreed.length / productNegs.length) * 100),
      averageDiscount: discounts.length ? roundMoney(discounts.reduce((a, b) => a + b, 0) / discounts.length) : 0,
      stock: p.stock,
      active: p.active,
    };
  });
}

export async function getTransactionRows(sellerId: string): Promise<OrderSummary[]> {
  const { orders } = await loadRows(sellerId);
  return orders.map((o) => ({
    id: o.id,
    dealId: o.dealId,
    sellerId,
    buyerId: '',
    customerName: o.buyerName,
    productName: o.productName,
    paymentProvider: o.paymentProvider as OrderSummary['paymentProvider'],
    externalOrderId: null,
    marketType: o.marketType,
    status: o.status as OrderSummary['status'],
    paymentState: o.paymentState as OrderSummary['paymentState'],
    totalAmount: o.totalAmount,
    currency: o.currency,
    isSample: o.isSample,
    settlementNote: null,
    createdAt: o.createdAt,
    updatedAt: o.createdAt,
  }));
}

export async function getSellerDashboard(seller: SellerRow) {
  const analytics = await getSellerAnalytics(seller);
  return analytics;
}

export async function safeAnalyticsSummary(seller: SellerRow): Promise<AnalyticsSummary> {
  try {
    return await getSellerAnalytics(seller);
  } catch (error) {
    logger.error('analytics_failed', { message: (error as Error).message });
    throw error;
  }
}

