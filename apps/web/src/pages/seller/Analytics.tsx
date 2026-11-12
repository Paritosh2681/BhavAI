import { useId, useMemo, useState } from 'react';
import {
  BarChart3,
  CircleDollarSign,
  Handshake,
  Package,
  Percent,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { ORDER_LABEL, PAYMENT_LABEL, type OrderStatus, type PaymentStatus } from '@bhavai/shared';
import { Badge, Button, Card, InlineNotice, PageHeader, Stat, Tabs } from '../../components/ui';
import { AgentModeBadge, AgentModeNote, ErrorNotice, FieldRow } from '../../components/Feedback';
import { DataGrid } from '../../components/DataGrid';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api } from '../../lib/api';
import { dateTime, dayLabel, formatMoney, marketLabel, negotiationLabel, percent } from '../../lib/format';
import type { AnalyticsWorkspace } from '../../lib/types';

type GridTab = 'negotiations' | 'products' | 'transactions';

export function SellerAnalytics() {
  useDocumentTitle('Analytics');
  const workspace = useAsync<AnalyticsWorkspace>(() => api.get('/api/dashboard/analytics'));
  const [tab, setTab] = useState<GridTab>('negotiations');

  if (workspace.error) return <ErrorNotice error={workspace.error} onRetry={workspace.reload} />;
  if (!workspace.data) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Analytics" title="Performance" description="Loading your own rows…" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-[92px] animate-pulse rounded-2xl bg-forest/[0.05]" aria-hidden />
          ))}
        </div>
        <div className="h-[400px] animate-pulse rounded-2xl bg-forest/[0.05]" aria-hidden />
      </div>
    );
  }

  const { analytics, currency, generatedAt, agentMode, negotiations, products, transactions } = workspace.data;
  const totals = analytics.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Performance from your own rows"
        description="Every chart, table and narrative below is computed from this seller's negotiations, deals and orders. Sample rows are flagged rather than blended silently."
        actions={
          <Button size="sm" variant="secondary" onClick={workspace.reload} loading={workspace.loading}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {analytics.includesSample && (
        <InlineNotice tone="warning" title="Sample data is included">
          Some rows in this workspace were created by the demo seed and are marked “Sample”. They are real database rows, not
          invented metrics, but they do not represent commercial performance.
        </InlineNotice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Recorded sales"
          value={formatMoney(totals.totalSales, currency)}
          detail={<DeltaLine value={analytics.deltas.totalSales} label="vs previous 7 days" />}
          tone="teal"
        />
        <Stat
          label="Accepted deals"
          value={totals.acceptedDeals}
          detail={<DeltaLine value={analytics.deltas.acceptedDeals} label="vs previous 7 days" />}
        />
        <Stat
          label="Negotiations today"
          value={totals.negotiationsToday}
          detail={<DeltaLine value={analytics.deltas.negotiationsToday} label="vs previous 7 days" />}
        />
        <Stat label="Conversion" value={percent(totals.conversionRate)} detail="Accepted deals ÷ negotiations" />
        <Stat
          label="Average discount"
          value={percent(totals.averageDiscountPercent)}
          detail="Granted on accepted deals only"
        />
        <Stat
          label="Pending payments"
          value={formatMoney(totals.pendingPayments, currency)}
          detail={`${totals.orders} orders · ${totals.activeProducts} active products`}
          tone="amber"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-forest">
                <CircleDollarSign className="h-4 w-4 text-teal-deep" aria-hidden /> Recorded revenue · 14 days
              </h2>
              <p className="mt-0.5 text-xs text-forest/55">Paid, settled and fulfilled orders only. No projections.</p>
            </div>
            <Badge tone="outline">{currency}</Badge>
          </div>
          <RevenueChart series={analytics.revenueSeries} currency={currency} />
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-forest">
                <Handshake className="h-4 w-4 text-teal-deep" aria-hidden /> Negotiation flow · 14 days
              </h2>
              <p className="mt-0.5 text-xs text-forest/55">Started vs agreed, by the day the negotiation was opened.</p>
            </div>
            <div className="flex items-center gap-3 text-[0.62rem] text-forest/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#01949a]" aria-hidden /> Started
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#173c3d]" aria-hidden /> Agreed
              </span>
            </div>
          </div>
          <NegotiationChart series={analytics.negotiationSeries} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-forest">
            <Percent className="h-4 w-4 text-teal-deep" aria-hidden /> Discount distribution
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-forest/55">Accepted deals grouped by discount from listed price.</p>
          <div className="mt-4 space-y-3">
            {analytics.discounts.bands.map((band) => {
              const max = Math.max(1, ...analytics.discounts.bands.map((item) => item.count));
              return (
                <div key={band.label}>
                  <div className="flex items-center justify-between text-[0.68rem]">
                    <span className="text-forest/65">{band.label}</span>
                    <span className="font-semibold text-forest">{band.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-pale">
                    <div
                      className="h-full rounded-full bg-teal-deep"
                      style={{ width: `${(band.count / max) * 100}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 border-t border-forest/10 pt-3 text-[0.68rem] text-forest/50">
            Average granted discount: <span className="font-semibold text-forest">{percent(analytics.discounts.average)}</span>
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-forest">
            <BarChart3 className="h-4 w-4 text-teal-deep" aria-hidden /> Market split
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-forest/55">Negotiations by payment routing market.</p>
          <div className="mt-4 space-y-4">
            {analytics.markets.map((market) => {
              const total = Math.max(1, analytics.markets.reduce((sum, item) => sum + item.count, 0));
              return (
                <div key={market.market}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem]">
                    <span className="font-medium text-forest">{marketLabel(market.market)}</span>
                    <span className="text-forest/55">
                      {market.count} talks · {formatMoney(market.value, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-pale">
                    <div
                      className={market.market === 'DOMESTIC' ? 'h-full rounded-full bg-sage' : 'h-full rounded-full bg-teal-deep'}
                      style={{ width: `${(market.count / total) * 100}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 border-t border-forest/10 pt-3 text-[0.68rem] leading-relaxed text-forest/50">
            India domestic deals settle off-platform. Cross-border deals use PayPal Sandbox when credentials are configured.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-forest">
            <Package className="h-4 w-4 text-teal-deep" aria-hidden /> Top products
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-forest/55">By recorded revenue, then negotiation volume.</p>
          <div className="mt-3 space-y-2">
            {analytics.topProducts.map((product, index) => (
              <div key={product.name} className="flex items-start gap-2.5 rounded-lg border border-forest/10 px-2.5 py-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-pale text-[0.62rem] font-bold text-forest">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-forest">{product.name}</p>
                  <p className="text-[0.64rem] text-forest/50">
                    {product.negotiations} negotiations · {product.quantity} sold
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-forest">{formatMoney(product.revenue, currency)}</p>
              </div>
            ))}
            {analytics.topProducts.length === 0 && (
              <p className="rounded-lg border border-dashed border-forest/15 px-3 py-6 text-center text-xs text-forest/50">
                No product has a negotiation or paid order yet.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-forest/10 bg-pale/35 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-forest">
                <Sparkles className="h-4 w-4 text-teal-deep" aria-hidden /> Policy narrative
              </h2>
              <p className="mt-0.5 text-xs text-forest/55">
                Generated {dateTime(analytics.aiSummary.generatedAt)} from the same rows shown below.
              </p>
            </div>
            <AgentModeBadge mode={analytics.aiSummary.mode} />
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <p className="text-sm leading-relaxed text-forest/75">{analytics.aiSummary.text}</p>
            <div className="mt-3 border-t border-forest/10 pt-3">
              <AgentModeNote mode={agentMode} />
            </div>
          </div>
          <dl className="rounded-xl bg-pale/50 p-4">
            <FieldRow label="Products" value={`${totals.activeProducts} active of ${totals.products}`} />
            <FieldRow label="All-time negotiations" value={totals.negotiationsAllTime} />
            <FieldRow label="Accepted deals" value={totals.acceptedDeals} />
            <FieldRow label="Orders" value={totals.orders} />
            <FieldRow label="Generated" value={dateTime(generatedAt)} />
          </dl>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-forest">Detail tables</h2>
            <p className="text-xs text-forest/55">Sortable, filterable AG Grid views over the raw rows.</p>
          </div>
          <Tabs
            label="Analytics tables"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'negotiations', label: 'Negotiations', count: negotiations.length },
              { value: 'products', label: 'Products', count: products.length },
              { value: 'transactions', label: 'Transactions', count: transactions.length },
            ]}
          />
        </div>
        <AnalyticsGrid tab={tab} workspace={workspace.data} />
      </div>
    </div>
  );
}

function DeltaLine({ value, label }: { value: number; label: string }) {
  const positive = value >= 0;
  return (
    <span className="inline-flex items-center gap-1">
      {positive ? (
        <TrendingUp className="h-3 w-3 text-teal-deep" aria-hidden />
      ) : (
        <TrendingDown className="h-3 w-3 text-[#8a5a22]" aria-hidden />
      )}
      <span className={positive ? 'text-teal-ink' : 'text-[#8a5a22]'}>
        {positive ? '+' : ''}
        {percent(value)}
      </span>{' '}
      {label}
    </span>
  );
}

function RevenueChart({
  series,
  currency,
}: {
  series: AnalyticsWorkspace['analytics']['revenueSeries'];
  currency: string;
}) {
  const gradientId = useId().replace(/:/g, '');
  const width = 640;
  const height = 200;
  const padX = 44;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const max = Math.max(1, ...series.map((point) => point.revenue));
  const stepX = series.length > 1 ? plotW / (series.length - 1) : plotW;
  const points = series.map((point, index) => ({
    x: padX + index * stepX,
    y: padY + plotH - (point.revenue / max) * plotH,
    data: point,
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1]?.x ?? padX},${padY + plotH} L${padX},${padY + plotH} Z`;
  const total = series.reduce((sum, point) => sum + point.revenue, 0);
  const peak = series.reduce(
    (best, point) => (point.revenue > best.revenue ? point : best),
    series[0] ?? { date: '', revenue: 0, orders: 0 },
  );

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-forest">{formatMoney(total, currency)}</p>
        <p className="text-[0.68rem] text-forest/50">
          Peak {formatMoney(peak.revenue, currency)} on {peak.date ? dayLabel(peak.date) : '—'}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label={`Recorded revenue for the last 14 days. Total ${formatMoney(total, currency)}.`}
      >
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#01949a" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#01949a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = padY + plotH * ratio;
          return (
            <g key={ratio}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(23,60,61,0.1)" strokeDasharray="3 4" />
              <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="8" fill="rgba(23,59,59,0.5)">
                {formatMoney(max * (1 - ratio), currency, { notation: 'compact', maximumFractionDigits: 1 })}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gradientId}-fill)`} />
        <path d={line} fill="none" stroke="#00696e" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <g key={point.data.date}>
            <circle cx={point.x} cy={point.y} r="2.6" fill="#00696e">
              <title>
                {dayLabel(point.data.date)}: {formatMoney(point.data.revenue, currency)} from {point.data.orders} paid
                order{point.data.orders === 1 ? '' : 's'}
              </title>
            </circle>
          </g>
        ))}
        {points.map((point, index) =>
          index % 3 === 0 ? (
            <text
              key={`label-${point.data.date}`}
              x={point.x}
              y={height - 6}
              textAnchor="middle"
              fontSize="8.5"
              fill="rgba(23,59,59,0.5)"
            >
              {dayLabel(point.data.date)}
            </text>
          ) : null,
        )}
      </svg>
      {total === 0 && <p className="mt-1 text-[0.68rem] text-forest/45">No paid orders in the last 14 days.</p>}
    </div>
  );
}

function NegotiationChart({ series }: { series: AnalyticsWorkspace['analytics']['negotiationSeries'] }) {
  const width = 480;
  const height = 200;
  const padX = 28;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const max = Math.max(1, ...series.map((point) => Math.max(point.started, point.agreed)));
  const slot = plotW / Math.max(1, series.length);
  const barWidth = Math.max(3, slot * 0.29);
  const totalStarted = series.reduce((sum, point) => sum + point.started, 0);
  const totalAgreed = series.reduce((sum, point) => sum + point.agreed, 0);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-forest">
          {totalAgreed}
          <span className="text-sm font-normal text-forest/45"> / {totalStarted} agreed</span>
        </p>
        <p className="text-[0.68rem] text-forest/50">Last 14 days</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label={`Negotiations started and agreed per day for the last 14 days. ${totalStarted} started, ${totalAgreed} agreed.`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padY + plotH * ratio;
          return <line key={ratio} x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(23,60,61,0.1)" strokeDasharray="3 4" />;
        })}
        {series.map((point, index) => {
          const baseX = padX + index * slot + slot / 2;
          const startedHeight = (point.started / max) * plotH;
          const agreedHeight = (point.agreed / max) * plotH;
          return (
            <g key={point.date}>
              <rect
                x={baseX - barWidth - 1.5}
                y={padY + plotH - startedHeight}
                width={barWidth}
                height={startedHeight}
                rx="2"
                fill="#01949a"
                opacity="0.9"
              >
                <title>
                  {dayLabel(point.date)}: {point.started} started
                </title>
              </rect>
              <rect
                x={baseX + 1.5}
                y={padY + plotH - agreedHeight}
                width={barWidth}
                height={agreedHeight}
                rx="2"
                fill="#173c3d"
              >
                <title>
                  {dayLabel(point.date)}: {point.agreed} agreed
                </title>
              </rect>
              {index % 3 === 0 && (
                <text x={baseX} y={height - 6} textAnchor="middle" fontSize="8" fill="rgba(23,59,59,0.5)">
                  {dayLabel(point.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {totalStarted === 0 && <p className="mt-1 text-[0.68rem] text-forest/45">No negotiations opened in the last 14 days.</p>}
    </div>
  );
}

function AnalyticsGrid({ tab, workspace }: { tab: GridTab; workspace: AnalyticsWorkspace }) {
  const { currency, negotiations, products, transactions } = workspace;

  const negotiationColumns = useMemo<ColDef<AnalyticsWorkspace['negotiations'][number]>[]>(
    () => [
      { field: 'productName', headerName: 'Product', minWidth: 150, flex: 1.4 },
      { field: 'buyerName', headerName: 'Buyer', minWidth: 120, flex: 1 },
      {
        field: 'listedPrice',
        headerName: 'Listed',
        minWidth: 100,
        valueFormatter: (params) => formatMoney(Number(params.value ?? 0), params.data?.currency ?? currency),
      },
      {
        field: 'initialOffer',
        headerName: 'Opening',
        minWidth: 100,
        valueFormatter: (params) => formatMoney(Number(params.value ?? 0), params.data?.currency ?? currency),
      },
      {
        field: 'finalPrice',
        headerName: 'Final',
        minWidth: 100,
        valueFormatter: (params) =>
          params.value === null || params.value === undefined
            ? 'No deal'
            : formatMoney(Number(params.value), params.data?.currency ?? currency),
      },
      {
        field: 'discountPercent',
        headerName: 'Discount',
        minWidth: 96,
        valueFormatter: (params) => percent(Number(params.value ?? 0)),
      },
      { field: 'rounds', headerName: 'Rounds', minWidth: 80, maxWidth: 100 },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 130,
        valueFormatter: (params) => negotiationLabel(String(params.value ?? '')),
      },
      {
        field: 'marketType',
        headerName: 'Market',
        minWidth: 120,
        valueFormatter: (params) => marketLabel(String(params.value ?? '')),
      },
      {
        field: 'createdAt',
        headerName: 'Opened',
        minWidth: 120,
        valueFormatter: (params) => dateTime(String(params.value ?? '')),
      },
    ],
    [currency],
  );

  const productColumns = useMemo<ColDef<AnalyticsWorkspace['products'][number]>[]>(
    () => [
      { field: 'name', headerName: 'Product', minWidth: 160, flex: 1.4 },
      { field: 'sku', headerName: 'SKU', minWidth: 100 },
      {
        field: 'listedPrice',
        headerName: 'Listed',
        minWidth: 100,
        valueFormatter: (params) => formatMoney(Number(params.value ?? 0), params.data?.currency ?? currency),
      },
      { field: 'stock', headerName: 'Stock', minWidth: 80, maxWidth: 100 },
      { field: 'negotiations', headerName: 'Talks', minWidth: 84, maxWidth: 96 },
      {
        field: 'conversionRate',
        headerName: 'Conversion',
        minWidth: 106,
        valueFormatter: (params) => percent(Number(params.value ?? 0)),
      },
      {
        field: 'averageDiscount',
        headerName: 'Avg discount',
        minWidth: 112,
        valueFormatter: (params) => percent(Number(params.value ?? 0)),
      },
      { field: 'quantitySold', headerName: 'Sold', minWidth: 80, maxWidth: 96 },
      {
        field: 'active',
        headerName: 'Status',
        minWidth: 100,
        valueFormatter: (params) => (params.value ? 'Active' : 'Hidden'),
      },
    ],
    [currency],
  );

  const transactionColumns = useMemo<ColDef<AnalyticsWorkspace['transactions'][number]>[]>(
    () => [
      {
        field: 'createdAt',
        headerName: 'Created',
        minWidth: 128,
        valueFormatter: (params) => dateTime(String(params.value ?? '')),
      },
      { field: 'customerName', headerName: 'Customer', minWidth: 130, flex: 1.1 },
      { field: 'productName', headerName: 'Product', minWidth: 140, flex: 1.2 },
      {
        field: 'marketType',
        headerName: 'Market',
        minWidth: 116,
        valueFormatter: (params) => marketLabel(String(params.value ?? '')),
      },
      {
        field: 'paymentProvider',
        headerName: 'Rail',
        minWidth: 90,
        valueFormatter: (params) => (params.value === 'MANUAL' ? 'Manual' : 'PayPal'),
      },
      {
        field: 'totalAmount',
        headerName: 'Amount',
        minWidth: 108,
        valueFormatter: (params) => formatMoney(Number(params.value ?? 0), params.data?.currency ?? currency),
      },
      {
        field: 'status',
        headerName: 'Order',
        minWidth: 132,
        valueFormatter: (params) => ORDER_LABEL[params.value as OrderStatus] ?? String(params.value ?? ''),
      },
      {
        field: 'paymentState',
        headerName: 'Payment',
        minWidth: 118,
        valueFormatter: (params) => PAYMENT_LABEL[params.value as PaymentStatus] ?? String(params.value ?? ''),
      },
    ],
    [currency],
  );

  if (tab === 'negotiations') {
    return (
      <DataGrid
        rows={negotiations}
        columns={negotiationColumns}
        height={460}
        emptyText="No negotiations yet."
        exportFileName="bhavai-negotiations.csv"
        ariaLabel="Negotiations table"
      />
    );
  }
  if (tab === 'products') {
    return (
      <DataGrid
        rows={products}
        columns={productColumns}
        height={460}
        emptyText="No products yet."
        exportFileName="bhavai-products.csv"
        ariaLabel="Products table"
      />
    );
  }
  return (
    <DataGrid
      rows={transactions}
      columns={transactionColumns}
      height={460}
      emptyText="No orders yet."
      exportFileName="bhavai-transactions.csv"
      ariaLabel="Transactions table"
    />
  );
}
