import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Handshake,
  KeyRound,
  PackageCheck,
  Plus,
  Sparkles,
  Store,
} from 'lucide-react';
import { formatMoney } from '@bhavai/shared';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Stat } from '../../components/ui';
import { AgentModeBadge, AgentModeNote, ErrorNotice } from '../../components/Feedback';
import { MarketBadge, NegotiationStatusBadge, OrderStatusBadge, SampleBadge } from '../../components/StatusBadge';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api } from '../../lib/api';
import { dateTime, percent } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { SellerDashboard as SellerDashboardData } from '../../lib/types';

export function SellerDashboard() {
  useDocumentTitle('Seller overview');
  const { me } = useAuth();
  const dashboard = useAsync<SellerDashboardData>(() => api.get('/api/seller/dashboard'));

  if (dashboard.loading) return <Spinner label="Loading your seller workspace" />;
  if (dashboard.error) return <ErrorNotice error={dashboard.error} onRetry={dashboard.reload} />;
  if (!dashboard.data) return null;

  const { analytics, negotiations, recentOrders, integrations } = dashboard.data;
  const totals = analytics.totals;
  const published = me?.seller?.active === true;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Seller studio"
        title={me?.seller?.businessName ?? 'Your business'}
        description="Live numbers from your own negotiations, deals and orders. Sample data is labelled wherever it appears."
        actions={
          <>
            <Link to="/seller/products" className="btn btn-secondary btn-sm">
              <Plus className="h-3.5 w-3.5" /> Add product
            </Link>
            <Link to={published && me?.seller ? `/stores/${me.seller.storeSlug}` : '/seller/onboarding'} className="btn btn-primary btn-sm">
              {published ? 'View storefront' : 'Finish setup'} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      {!published && (
        <Card className="border-[#d99a55]/40 bg-[#fbf3e8] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-[#6b3a12]">
                <Sparkles className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#6b3a12]">Your storefront is not published yet.</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#6b3a12]/80">
                  Add a description, at least one active product, and save your pricing rules. Publishing is a deliberate step.
                </p>
              </div>
            </div>
            <Link to="/seller/onboarding" className="btn btn-secondary btn-sm shrink-0">
              Open setup checklist
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Accepted deals"
          value={totals.acceptedDeals}
          detail={`${totals.negotiationsAllTime} negotiations all time`}
          tone="teal"
        />
        <Stat
          label="Recorded sales"
          value={formatMoney(totals.totalSales, me?.seller?.currency ?? 'USD')}
          detail="Paid or settled orders only"
        />
        <Stat label="Conversion" value={percent(totals.conversionRate)} detail="Accepted deals ÷ negotiations" />
        <Stat label="Pending payments" value={totals.pendingPayments} detail="Orders not yet paid or settled" tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr] lg:items-start">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-forest">Recent negotiations</h2>
              <p className="mt-0.5 text-xs text-forest/55">The latest agent conversations on your catalog.</p>
            </div>
            <Link to="/seller/negotiations" className="text-xs font-semibold text-teal-deep">
              See all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {negotiations.map((negotiation) => (
              <Link
                key={negotiation.id}
                to={`/seller/negotiations/${negotiation.id}`}
                className="block rounded-xl border border-forest/10 p-3.5 transition-colors hover:border-teal/30 hover:bg-pale/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-forest">{negotiation.productName}</p>
                    <p className="mt-0.5 text-xs text-forest/55">
                      {negotiation.buyerName} · {negotiation.quantity} units · {dateTime(negotiation.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {negotiation.isSample && <SampleBadge />}
                    <NegotiationStatusBadge status={negotiation.status} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-forest/50">
                    <MarketBadge market={negotiation.marketType} />
                    <span>Round {negotiation.roundsUsed}/{negotiation.maxRounds}</span>
                  </div>
                  <p className="font-semibold text-forest">
                    {negotiation.currentOffer
                      ? `${formatMoney(negotiation.currentOffer.unitPrice, negotiation.currency)} / unit`
                      : formatMoney(negotiation.listedPrice, negotiation.currency)}
                  </p>
                </div>
              </Link>
            ))}
            {negotiations.length === 0 && (
              <EmptyState
                icon={<Handshake className="h-5 w-5" />}
                title="No negotiations yet"
                description="Once your storefront is published, buyer agents and the MCP tools can open negotiations here."
                action={
                  <Link to="/seller/products" className="btn btn-secondary btn-sm">
                    Review catalog
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-forest">Workspace status</h2>
              <AgentModeBadge mode={analytics.aiSummary.mode} />
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              <StatusLine
                label="AI language layer"
                ok={integrations.gemini}
                detail={integrations.gemini ? 'Gemini configured' : 'Policy fallback active'}
              />
              <StatusLine
                label="PayPal Sandbox"
                ok={integrations.paypal}
                detail={integrations.paypal ? 'Credentials present' : 'Not configured · cross-border returns 503'}
              />
              <StatusLine label="MCP server" ok={integrations.mcp} detail="15 tools at /mcp" />
            </div>
            <div className="mt-4 border-t border-forest/10 pt-3">
              <AgentModeNote mode={analytics.aiSummary.mode} />
            </div>
            <Link to="/seller/developer" className="mt-4 flex items-center justify-between rounded-lg bg-pale/60 px-3 py-2 text-xs font-semibold text-forest hover:bg-pale">
              <span className="inline-flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" /> Developer console
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-forest">Quick actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { to: '/seller/products', label: 'Catalog', icon: Boxes },
                { to: '/seller/rules', label: 'Rules', icon: CircleDollarSign },
                { to: '/seller/orders', label: 'Orders', icon: PackageCheck },
                { to: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
              ].map((action) => (
                <Link key={action.to} to={action.to} className="rounded-xl border border-forest/10 p-3 transition-colors hover:border-teal/30 hover:bg-pale/40">
                  <action.icon className="h-4 w-4 text-teal-deep" aria-hidden />
                  <p className="mt-2 text-xs font-semibold text-forest">{action.label}</p>
                </Link>
              ))}
            </div>
            <Link to="/seller/onboarding" className="mt-3 flex items-center gap-2 text-xs font-medium text-forest/60 hover:text-forest">
              <Store className="h-3.5 w-3.5" /> Storefront setup checklist
            </Link>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-forest">Recent orders</h2>
            <p className="mt-0.5 text-xs text-forest/55">Only orders created from accepted deals appear here.</p>
          </div>
          <Link to="/seller/orders" className="text-xs font-semibold text-teal-deep">
            Manage orders
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-forest/10 text-[0.62rem] uppercase tracking-[0.12em] text-forest/45">
                <th className="pb-2 font-semibold">Order</th>
                <th className="pb-2 font-semibold">Customer</th>
                <th className="pb-2 font-semibold">Product</th>
                <th className="pb-2 font-semibold">Market</th>
                <th className="pb-2 font-semibold">Amount</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-forest/[0.06] last:border-0">
                  <td className="py-2.5 text-xs text-forest/55">{dateTime(order.createdAt)}</td>
                  <td className="py-2.5 text-xs font-medium text-forest">{order.customerName}</td>
                  <td className="py-2.5 text-xs text-forest/65">{order.productName}</td>
                  <td className="py-2.5 text-xs text-forest/55">{order.paymentProvider === 'MANUAL' ? 'Domestic · manual' : 'PayPal Sandbox'}</td>
                  <td className="py-2.5 text-xs font-semibold text-forest">{formatMoney(order.totalAmount, order.currency)}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <OrderStatusBadge status={order.status} />
                      {order.isSample && <Badge tone="amber">Sample</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentOrders.length === 0 && (
            <p className="py-6 text-center text-xs text-forest/50">
              No orders yet. Accepted deals become orders when the buyer confirms and creates payment.
            </p>
          )}
        </div>
        {recentOrders.length > 0 && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => dashboard.reload()}>
              Refresh live data
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-medium text-forest">{label}</p>
        <p className="mt-0.5 text-[0.68rem] text-forest/50">{detail}</p>
      </div>
      <Badge tone={ok ? 'teal' : 'outline'}>{ok ? 'Configured' : 'Off'}</Badge>
    </div>
  );
}
