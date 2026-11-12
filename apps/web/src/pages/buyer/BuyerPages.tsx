import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Compass,
  Gavel,
  Handshake,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { formatMoney, roundMoney, countryName } from '@bhavai/shared';
import { Badge, Button, Card, EmptyState, Field, InlineNotice, Modal, PageHeader, Spinner, Stat, Tabs } from '../../components/ui';
import { ProductArt } from '../../components/ProductArt';
import { AgentModeBadge, AgentModeNote, ErrorNotice } from '../../components/Feedback';
import { MarketBadge, NegotiationStatusBadge, OrderStatusBadge, SampleBadge } from '../../components/StatusBadge';
import { NegotiationRoom } from '../../components/NegotiationRoom';
import { OrdersPage } from '../OrdersPage';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api, errorMessage, queryString } from '../../lib/api';
import { dateTime, percent } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type {
  BuyerDiscoverResult,
  BuyerSummary,
  NegotiationDetailView,
  NegotiationListResult,
  OrderDetail,
  PublicProduct,
} from '../../lib/types';

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function BuyerOverview() {
  useDocumentTitle('Buyer overview');
  const { me } = useAuth();
  const summary = useAsync<BuyerSummary>(() => api.get('/api/buyer/summary'));

  if (summary.loading) return <Spinner label="Loading your buyer workspace" />;
  if (summary.error) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  if (!summary.data) return null;

  const { counts, negotiations, orders, recommended, agentMode } = summary.data;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Buyer workspace"
        title={me?.buyer?.companyName || me?.user.name || 'Your buying desk'}
        description="Describe what you need, let your agent negotiate inside seller rules, then pay through the honest rail for the market."
        actions={
          <>
            <Link to="/buyer/deals" className="btn btn-secondary btn-sm">
              <Handshake className="h-3.5 w-3.5" /> Negotiations
            </Link>
            <Link to="/buyer/discover" className="btn btn-primary btn-sm">
              <Compass className="h-3.5 w-3.5" /> Discover products
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open negotiations" value={counts.open} detail="Agents are still talking" tone="teal" />
        <Stat label="Agreed deals" value={counts.agreed} detail="Ready to confirm and pay" />
        <Stat label="Orders" value={counts.orders} detail="Across both payment rails" tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr] lg:items-start">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-forest">Latest negotiations</h2>
              <p className="mt-0.5 text-xs text-forest/55">Live from your buyer account — sample rows are labelled.</p>
            </div>
            <Link to="/buyer/deals" className="text-xs font-semibold text-teal-deep">
              See all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {negotiations.map((negotiation) => (
              <Link
                key={negotiation.id}
                to={`/buyer/deals/${negotiation.id}`}
                className="block rounded-xl border border-forest/10 p-3.5 transition-colors hover:border-teal/30 hover:bg-pale/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-forest">{negotiation.productName}</p>
                    <p className="mt-0.5 text-xs text-forest/55">
                      {negotiation.sellerName} · {negotiation.quantity} units · {dateTime(negotiation.updatedAt)}
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
                    <span>
                      Round {negotiation.roundsUsed}/{negotiation.maxRounds}
                    </span>
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
                description="Start with a natural-language search. Your agent will find published products and open a rules-bounded negotiation."
                action={
                  <Link to="/buyer/discover" className="btn btn-secondary btn-sm">
                    Discover products
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-forest">Agent status</h2>
              <AgentModeBadge mode={agentMode} />
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef7f7] text-teal-deep">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-forest">Policy owns the numbers</p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-forest/55">
                    Your agent can accept or counter, but every price is revalidated by the server against the seller&apos;s
                    confidential rules.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pale text-forest">
                  <Wallet className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-forest">
                    {counts.agreed > 0 ? 'A deal is ready for you' : 'Payment follows agreement'}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-forest/55">
                    Confirm the deal before creating payment. India domestic uses manual settlement; cross-border uses PayPal
                    Sandbox.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-forest/10 pt-3">
              <AgentModeNote mode={agentMode} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-forest">Recent orders</h2>
            <div className="mt-3 space-y-2">
              {orders.slice(0, 3).map((order) => (
                <Link
                  key={order.id}
                  to="/buyer/orders"
                  className="block rounded-lg border border-forest/10 px-3 py-2.5 transition-colors hover:bg-pale/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-forest">{order.productName}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 flex items-center justify-between gap-2 text-[0.66rem] text-forest/50">
                    <span>
                      {order.sellerName} · {order.paymentProvider === 'MANUAL' ? 'Manual settlement' : 'PayPal Sandbox'}
                    </span>
                    <span className="font-semibold text-forest">{formatMoney(order.totalAmount, order.currency)}</span>
                  </p>
                </Link>
              ))}
              {orders.length === 0 && (
                <p className="rounded-lg border border-dashed border-forest/15 px-3 py-6 text-center text-xs text-forest/50">
                  No orders yet. An order is created after a deal is confirmed and a payment rail is chosen.
                </p>
              )}
            </div>
            {orders.length > 0 && (
              <Link to="/buyer/orders" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-deep">
                Open orders <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </Card>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Recommended</p>
            <h2 className="mt-1 text-lg font-semibold text-forest">Published in your currency</h2>
            <p className="mt-0.5 text-xs text-forest/55">
              {recommended.length > 0
                ? 'Real catalog rows from published storefronts. No currency conversion is applied in this build.'
                : 'No published products match your account currency yet.'}
            </p>
          </div>
          <Link to="/stores" className="btn btn-secondary btn-sm">
            Browse all storefronts
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommended.map((product) => (
            <RecommendedProduct key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}

function RecommendedProduct({ product }: { product: PublicProduct }) {
  return (
    <Link to={`/stores/${product.seller.storeSlug}/${product.id}`} className="group">
      <Card className="card-hover h-full overflow-hidden p-0">
        <ProductArt name={product.name} category={product.category} images={product.images} className="h-36 rounded-none" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-forest group-hover:text-teal-deep">{product.name}</h3>
              <p className="mt-0.5 truncate text-[0.7rem] text-forest/50">{product.seller.businessName}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-forest">{formatMoney(product.listedPrice, product.currency)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.65rem] text-forest/45">
            <span>{product.stock} in stock</span>
            <span className="divider-dot" />
            <span>Min {product.negotiation.minimumQuantity}</span>
            {product.negotiation.negotiable && <Badge tone="sage">Negotiable</Badge>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Discover                                                            */
/* ------------------------------------------------------------------ */

type DiscoverForm = { query: string; budget: string; currency: string };

export function BuyerDiscover() {
  useDocumentTitle('Discover');
  const { me } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<DiscoverForm>({
    query: '',
    budget: '',
    currency: me?.buyer?.currency ?? 'USD',
  });
  const [result, setResult] = useState<BuyerDiscoverResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<BuyerDiscoverResult['products'][number] | null>(null);
  const [offer, setOffer] = useState({ quantity: '', unitPrice: '', budgetTotal: '', message: '' });
  const [starting, setStarting] = useState(false);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const next = await api.post<BuyerDiscoverResult>('/api/buyer/discover', {
        query: form.query,
        budgetTotal: form.budget ? Number(form.budget) : null,
        currency: form.currency,
      });
      setResult(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSearching(false);
    }
  };

  const openOffer = (product: BuyerDiscoverResult['products'][number]) => {
    const quantity = Math.max(result?.intent.quantity ?? 1, product.negotiation.minimumQuantity);
    const budget = result?.budget?.total ?? null;
    const unitFromBudget = budget ? budget / quantity : product.listedPrice * 0.9;
    const unitPrice = roundMoney(Math.min(product.listedPrice * 0.9, unitFromBudget));
    setOffer({
      quantity: String(quantity),
      unitPrice: String(unitPrice > 0 ? unitPrice : roundMoney(product.listedPrice * 0.85)),
      budgetTotal: budget ? String(roundMoney(budget)) : '',
      message: '',
    });
    setActive(product);
    setError(null);
  };

  const startNegotiation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    setStarting(true);
    setError(null);
    try {
      const response = await api.post<{ negotiation: NegotiationDetailView }>('/api/negotiations', {
        productId: active.id,
        quantity: Number(offer.quantity),
        unitPrice: Number(offer.unitPrice),
        budgetTotal: offer.budgetTotal ? Number(offer.budgetTotal) : null,
        message: offer.message,
      });
      toast('Negotiation opened. The seller agent can respond inside their rules.', 'success');
      navigate(`/buyer/deals/${response.negotiation.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agentic sourcing"
        title="Describe what you need"
        description="BhavAI extracts a structured intent, searches published storefronts in one currency, and shows which products can reach your budget through a real negotiation."
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-forest/10 bg-pale/35 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Sparkles className="h-4 w-4 text-teal-deep" aria-hidden /> Buying brief
            </p>
            <Badge tone="sage">No currency conversion</Badge>
          </div>
        </div>
        <form onSubmit={(event) => void search(event)} className="space-y-4 p-5">
          <Field
            label="What are you looking to buy?"
            htmlFor="discover-query"
            hint="Include quantity and timing. Example: 12 amber glass lanterns for a Diwali collection, needed this month."
          >
            <textarea
              id="discover-query"
              className="field min-h-[92px] resize-y"
              value={form.query}
              onChange={(event) => setForm((current) => ({ ...current, query: event.target.value }))}
              placeholder="I need 10 handwoven silk stoles for a boutique order in December."
              required
              minLength={3}
              maxLength={800}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Field label="Total budget (optional)" htmlFor="discover-budget" hint="A total, not per unit. The server computes the unit budget.">
              <input
                id="discover-budget"
                type="number"
                min="1"
                step="0.01"
                className="field"
                value={form.budget}
                onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
                placeholder="e.g. 400"
              />
            </Field>
            <Field label="Currency" htmlFor="discover-currency">
              <select
                id="discover-currency"
                className="field"
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
              >
                {['USD', 'INR', 'EUR', 'GBP', 'AED'].map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" loading={searching} className="sm:mb-0">
              Search market <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          {error && !active && <ErrorNotice error={error} onRetry={() => setError(null)} />}
        </form>
      </Card>

      {result && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/45">Parsed intent</p>
                <p className="mt-1 text-sm font-semibold text-forest">
                  “{result.intent.productQuery}” · {result.intent.quantity} units
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {result.intent.category && <Badge tone="sage">{result.intent.category}</Badge>}
                  <Badge tone="outline">{result.budget?.display ?? 'Budget not set'}</Badge>
                  {result.budget?.perUnit !== null && result.budget?.perUnit !== undefined && (
                    <Badge tone="mint">Up to {formatMoney(result.budget.perUnit, result.budget.currency)} / unit</Badge>
                  )}
                  <AgentModeBadge mode={result.agentMode} />
                </div>
              </div>
              <div className="max-w-sm">
                <p className="text-xs leading-relaxed text-forest/60">{result.note}</p>
                <AgentModeNote mode={result.agentMode} />
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            {result.products.map((product) => (
              <Card key={product.id} className="overflow-hidden p-0">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <ProductArt
                    name={product.name}
                    category={product.category}
                    images={product.images}
                    className="h-28 w-full shrink-0 rounded-xl sm:h-24 sm:w-32"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/stores/${product.seller.storeSlug}/${product.id}`}
                          className="truncate text-sm font-semibold text-forest hover:text-teal-deep"
                        >
                          {product.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-forest/50">
                          {product.seller.businessName} · {countryName(product.seller.country)} · {product.stock} in stock
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-forest">
                          {formatMoney(product.listedPrice, product.currency)}
                          <span className="text-[0.65rem] font-normal text-forest/45"> / unit</span>
                        </p>
                        <p className="text-[0.68rem] text-forest/50">
                          {formatMoney(product.fit.listedTotal, product.currency)} for {product.fit.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          product.fit.withinListedBudget
                            ? 'teal'
                            : product.fit.negotiableIntoBudget
                              ? 'sage'
                              : 'amber'
                        }
                      >
                        {product.fit.label}
                      </Badge>
                      {product.fit.unitGapPercent !== null && product.fit.unitGapPercent > 0 && (
                        <span className="inline-flex items-center gap-1 text-[0.66rem] text-forest/50">
                          <TrendingDown className="h-3 w-3" aria-hidden /> {percent(product.fit.unitGapPercent)} below list per unit
                        </span>
                      )}
                      <span className="text-[0.66rem] text-forest/45">
                        Min {product.negotiation.minimumQuantity} · max {product.negotiation.maxRounds} rounds
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                    <Button size="sm" onClick={() => openOffer(product)}>
                      <Gavel className="h-3.5 w-3.5" /> Negotiate
                    </Button>
                    <Link to={`/stores/${product.seller.storeSlug}/${product.id}`} className="btn btn-secondary btn-sm">
                      View listing
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {result.products.length === 0 && (
            <EmptyState
              icon={<Compass className="h-5 w-5" />}
              title="No published product matched that brief"
              description={result.note}
            />
          )}
        </div>
      )}

      {!result && !searching && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Bot,
              title: 'Intent, not keywords',
              detail: 'Gemini parses your brief when configured. Otherwise a deterministic parser extracts quantity, budget and category.',
            },
            {
              icon: ShieldCheck,
              title: 'Budget-aware fit',
              detail: 'The result shows whether a product is already inside budget or may reach it through a rules-bounded negotiation.',
            },
            {
              icon: Handshake,
              title: 'Real negotiation',
              detail: 'Starting a negotiation writes real offers. Nothing is simulated or pre-baked.',
            },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/70 text-forest">
                <item.icon className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-forest">{item.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-forest/60">{item.detail}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? `Negotiate ${active.name}` : 'Open a negotiation'}
        description="Your opening offer is validated by the same pricing engine that enforces the seller's rules."
      >
        {active && (
          <form onSubmit={(event) => void startNegotiation(event)} className="space-y-4">
            {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}
            <div className="rounded-xl bg-pale/60 p-3 text-xs text-forest/65">
              <p className="font-semibold text-forest">{active.seller.businessName}</p>
              <p className="mt-0.5">
                Listed {formatMoney(active.listedPrice, active.currency)} / unit · {active.stock} in stock · minimum{' '}
                {active.negotiation.minimumQuantity} units
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Quantity" htmlFor="arena-quantity" hint={`Minimum ${active.negotiation.minimumQuantity}`}>
                <input
                  id="arena-quantity"
                  type="number"
                  min={active.negotiation.minimumQuantity}
                  max={active.stock}
                  className="field"
                  value={offer.quantity}
                  onChange={(event) => setOffer((current) => ({ ...current, quantity: event.target.value }))}
                  required
                />
              </Field>
              <Field label={`Opening offer (${active.currency})`} htmlFor="arena-unit" hint="Per unit">
                <input
                  id="arena-unit"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={active.listedPrice}
                  className="field"
                  value={offer.unitPrice}
                  onChange={(event) => setOffer((current) => ({ ...current, unitPrice: event.target.value }))}
                  required
                />
              </Field>
            </div>
            <Field label="Total budget (optional)" htmlFor="arena-budget" hint="The buyer agent will not cross this total.">
              <input
                id="arena-budget"
                type="number"
                min="0.01"
                step="0.01"
                className="field"
                value={offer.budgetTotal}
                onChange={(event) => setOffer((current) => ({ ...current, budgetTotal: event.target.value }))}
              />
            </Field>
            <Field label="Message to the seller (optional)" htmlFor="arena-message">
              <input
                id="arena-message"
                className="field"
                maxLength={600}
                value={offer.message}
                onChange={(event) => setOffer((current) => ({ ...current, message: event.target.value }))}
                placeholder="We can commit to a repeat order."
              />
            </Field>
            <InlineNotice tone="info">
              Cross-border deals use PayPal Sandbox when configured. India-to-India deals become manual settlement orders and
              never pretend to be PayPal payments.
            </InlineNotice>
            <div className="flex flex-wrap justify-end gap-2 border-t border-forest/10 pt-4">
              <Button type="button" variant="ghost" onClick={() => setActive(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={starting}>
                Start negotiation <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deals                                                               */
/* ------------------------------------------------------------------ */

type DealTab = 'ALL' | 'OPEN' | 'AWAITING_APPROVAL' | 'AGREED' | 'REJECTED';

export function BuyerDeals() {
  useDocumentTitle('Negotiations');
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<DealTab>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<'idle' | 'working' | 'done' | 'cancelled' | 'error'>('idle');
  const handledReturn = useRef<string | null>(null);

  const list = useAsync<NegotiationListResult>(
    () =>
      api.get(
        `/api/negotiations${queryString({
          status: status === 'ALL' ? undefined : status,
          search,
          pageSize: 50,
        })}`,
      ),
    [status, search],
  );

  const returnOrderId = params.get('paypal') === 'return' ? params.get('order') : null;
  const cancelOrderId = params.get('paypal') === 'cancel' ? params.get('order') : null;

  useEffect(() => {
    if (!cancelOrderId || handledReturn.current === `cancel:${cancelOrderId}`) return;
    handledReturn.current = `cancel:${cancelOrderId}`;
    setReturnState('cancelled');
    toast('PayPal checkout was cancelled. No funds were captured.', 'info');
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelOrderId]);

  useEffect(() => {
    if (!returnOrderId || handledReturn.current === returnOrderId) return;
    handledReturn.current = returnOrderId;

    const reconcile = async () => {
      setReturnState('working');
      setError(null);
      try {
        const response = await api.get<{ order: OrderDetail }>(`/api/orders/${encodeURIComponent(returnOrderId)}`);
        const payment = response.order.payment;
        if (payment && payment.provider === 'PAYPAL' && payment.status !== 'COMPLETED') {
          await api.post(`/api/payments/${encodeURIComponent(payment.id)}/capture`);
          toast('PayPal payment captured and reconciled against the agreed deal.', 'success');
        } else if (payment?.status === 'COMPLETED') {
          toast('This PayPal payment was already captured.', 'info');
        } else {
          toast('The order is loaded, but no PayPal payment is available to capture.', 'info');
        }
        setReturnState('done');
        list.reload();
        setParams({}, { replace: true });
      } catch (caught) {
        setReturnState('error');
        setError(errorMessage(caught));
      }
    };

    void reconcile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnOrderId]);

  const rows = list.data?.negotiations ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deal flow"
        title="Negotiations"
        description="Every buyer-agent conversation, its policy state, and the resulting order once a deal is confirmed."
      />

      {returnState !== 'idle' && (
        <InlineNotice
          tone={returnState === 'error' || returnState === 'cancelled' ? 'warning' : returnState === 'done' ? 'success' : 'info'}
          title="PayPal return"
        >
          {returnState === 'working'
            ? 'Verifying the order and capturing the PayPal payment server-side…'
            : returnState === 'done'
              ? 'The return was reconciled with the local payment record. The order status below reflects the captured state.'
              : returnState === 'cancelled'
                ? 'PayPal checkout was cancelled before approval. No payment was taken.'
                : 'The PayPal return could not be reconciled. No success state was recorded. Review the error below.'}
        </InlineNotice>
      )}

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search negotiations</span>
          <input
            className="field pl-9"
            placeholder="Search product or seller"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Compass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/35" aria-hidden />
        </label>
        <Tabs
          label="Filter negotiations"
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'ALL', label: 'All', count: list.data?.total },
            { value: 'OPEN', label: 'Open' },
            { value: 'AWAITING_APPROVAL', label: 'Approval' },
            { value: 'AGREED', label: 'Agreed' },
            { value: 'REJECTED', label: 'Closed' },
          ]}
        />
      </div>

      {list.loading && <Spinner label="Loading negotiations" />}
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}

      {!list.loading && rows.length === 0 && (
        <EmptyState
          icon={<Handshake className="h-5 w-5" />}
          title="No negotiations in this view"
          description="Discover a product and open a negotiation. Your agent will move inside the seller's published terms."
          action={
            <Link to="/buyer/discover" className="btn btn-secondary btn-sm">
              Discover products
            </Link>
          }
        />
      )}

      <div className="space-y-2.5">
        {rows.map((negotiation) => (
          <Link
            key={negotiation.id}
            to={`/buyer/deals/${negotiation.id}`}
            className="block rounded-2xl border border-forest/10 bg-white p-4 transition-colors hover:border-teal/30 hover:bg-pale/20"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-forest">{negotiation.productName}</h2>
                  {negotiation.isSample && <SampleBadge />}
                  <NegotiationStatusBadge status={negotiation.status} />
                  <MarketBadge market={negotiation.marketType} />
                </div>
                <p className="mt-1 text-xs text-forest/55">
                  {negotiation.sellerName} · {negotiation.quantity} units · {negotiation.roundsUsed} of{' '}
                  {negotiation.maxRounds} rounds
                </p>
                <p className="mt-0.5 text-[0.66rem] text-forest/40">Updated {dateTime(negotiation.updatedAt)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-end gap-5 text-right sm:justify-end">
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.12em] text-forest/40">Current offer</p>
                  <p className="text-sm font-semibold text-forest">
                    {negotiation.currentOffer
                      ? formatMoney(negotiation.currentOffer.unitPrice, negotiation.currency)
                      : formatMoney(negotiation.listedPrice, negotiation.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.12em] text-forest/40">Listed</p>
                  <p className="text-sm font-medium text-forest/60">
                    {formatMoney(negotiation.listedPrice, negotiation.currency)}
                  </p>
                </div>
                {negotiation.agreedUnitPrice !== null && (
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.12em] text-forest/40">Agreed</p>
                    <p className="text-sm font-semibold text-teal-deep">
                      {formatMoney(negotiation.agreedUnitPrice, negotiation.currency)}
                    </p>
                  </div>
                )}
                <Badge tone="outline">
                  {negotiation.orderStatus
                    ? `Order ${negotiation.orderStatus.toLowerCase().replace(/_/g, ' ')}`
                    : 'No order yet'}
                </Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BuyerDealDetail() {
  const { id = '' } = useParams();
  useDocumentTitle('Negotiation detail');
  const detail = useAsync<{ negotiation: NegotiationDetailView }>(
    () => api.get(`/api/negotiations/${encodeURIComponent(id)}`),
    [id],
  );

  if (detail.loading) return <Spinner label="Loading negotiation" />;
  if (detail.error) {
    return (
      <div className="space-y-4">
        <Link to="/buyer/deals" className="inline-flex items-center gap-1.5 text-xs font-medium text-forest/55 hover:text-forest">
          Back to negotiations
        </Link>
        <ErrorNotice error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }
  if (!detail.data) return null;

  return (
    <div className="space-y-4">
      <Link to="/buyer/deals" className="inline-flex items-center gap-1.5 text-xs font-medium text-forest/55 hover:text-forest">
        Back to negotiations
      </Link>
      <NegotiationRoom negotiation={detail.data.negotiation} role="BUYER" onRefresh={detail.reload} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agent Arena                                                         */
/* ------------------------------------------------------------------ */

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function BuyerArena() {
  useDocumentTitle('Agent Arena');
  const { toast } = useToast();
  const market = useAsync<{ products: PublicProduct[]; total: number }>(() =>
    api.get('/api/public/market/products?pageSize=24&inStock=true'),
  );
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [opening, setOpening] = useState('');
  const [budget, setBudget] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<NegotiationDetailView | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const products = market.data?.products ?? [];
  const selected = useMemo(() => products.find((product) => product.id === selectedId) ?? null, [products, selectedId]);

  const selectProduct = (product: PublicProduct) => {
    const nextQuantity = Math.max(product.negotiation.minimumQuantity, 4);
    setSelectedId(product.id);
    setQuantity(String(nextQuantity));
    setOpening(String(roundMoney(product.listedPrice * 0.88)));
    setBudget(String(roundMoney(product.listedPrice * nextQuantity)));
    setCurrent(null);
    setError(null);
  };

  const run = async () => {
    if (!selected) {
      setError('Choose a product to put in the arena.');
      return;
    }
    const requestedQuantity = Number(quantity);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < selected.negotiation.minimumQuantity) {
      setError(`Quantity must be at least ${selected.negotiation.minimumQuantity}.`);
      return;
    }
    setRunning(true);
    setError(null);
    setCurrent(null);
    try {
      const created = await api.post<{ negotiation: NegotiationDetailView }>('/api/negotiations', {
        productId: selected.id,
        quantity: Math.min(requestedQuantity, selected.stock),
        unitPrice: Number(opening),
        budgetTotal: budget ? Number(budget) : null,
        message: 'Arena run: a real buyer-agent negotiation, with each turn recorded server-side.',
      });
      let latest = created.negotiation;
      setCurrent(latest);

      const maxSteps = selected.negotiation.maxRounds * 2 + 2;
      let steps = 0;
      while (latest.status === 'OPEN' && steps < maxSteps) {
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        await delay(reduced ? 80 : 720);
        if (!alive.current) return;
        const response = await api.post<{ negotiation: NegotiationDetailView }>(
          `/api/negotiations/${encodeURIComponent(latest.id)}/step`,
        );
        latest = response.negotiation;
        if (!alive.current) return;
        setCurrent(latest);
        steps += 1;
      }

      if (latest.status === 'AGREED') {
        toast(`Agents agreed at ${formatMoney(latest.agreedUnitPrice ?? 0, latest.currency)} per unit.`, 'success');
      } else if (latest.status === 'AWAITING_APPROVAL') {
        toast('The agents agreed, but the seller must approve before stock is reserved.', 'info');
      } else if (latest.status === 'REJECTED') {
        toast('The buyer agent ended the negotiation without a deal. No order was created.', 'info');
      } else {
        toast('The round limit was reached. The negotiation is still open.', 'info');
      }
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast(message, 'error');
    } finally {
      if (alive.current) setRunning(false);
    }
  };

  const offers = current?.offers ?? [];
  const buyerMoves = offers.filter((offer) => offer.submittedBy.startsWith('BUYER'));
  const sellerMoves = offers.filter((offer) => offer.submittedBy.startsWith('SELLER'));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent Arena"
        title="Watch two real agents negotiate"
        description="Pick a published product, set the brief, and let the buyer and seller agents alternate. Every turn is a real server call written to the database — nothing here is a scripted animation."
        actions={
          current ? (
            <Link to={`/buyer/deals/${current.id}`} className="btn btn-secondary btn-sm">
              Open negotiation room
            </Link>
          ) : undefined
        }
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-forest">1. Choose a product</h2>
              <Badge tone="sage">{products.length} published</Badge>
            </div>
            {market.loading && <Spinner label="Loading market" />}
            {market.error && <ErrorNotice error={market.error} onRetry={market.reload} />}
            <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => selectProduct(product)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    selectedId === product.id
                      ? 'border-teal/50 bg-[#eef7f7]'
                      : 'border-forest/10 hover:border-teal/25 hover:bg-pale/30'
                  }`}
                >
                  <ProductArt
                    name={product.name}
                    category={product.category}
                    images={product.images}
                    className="h-12 w-14 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-forest">{product.name}</span>
                    <span className="block truncate text-[0.66rem] text-forest/50">
                      {product.seller.businessName} · min {product.negotiation.minimumQuantity}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-forest">
                    {formatMoney(product.listedPrice, product.currency)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-forest">2. Set the buying brief</h2>
            {selected ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-pale/60 p-3 text-xs text-forest/65">
                  <p className="font-semibold text-forest">{selected.name}</p>
                  <p className="mt-0.5">
                    {formatMoney(selected.listedPrice, selected.currency)} / unit · {selected.stock} in stock ·{' '}
                    {selected.negotiation.maxRounds} rounds max
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Quantity" htmlFor="arena-qty" hint={`Minimum ${selected.negotiation.minimumQuantity}`}>
                    <input
                      id="arena-qty"
                      type="number"
                      min={selected.negotiation.minimumQuantity}
                      max={selected.stock}
                      className="field"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </Field>
                  <Field label={`Opening offer (${selected.currency})`} htmlFor="arena-open">
                    <input
                      id="arena-open"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={selected.listedPrice}
                      className="field"
                      value={opening}
                      onChange={(event) => setOpening(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Total budget (optional)" htmlFor="arena-budget-arena" hint="The buyer agent will not cross this.">
                  <input
                    id="arena-budget-arena"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="field"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                  />
                </Field>
                <Button className="w-full" loading={running} onClick={() => void run()} disabled={selected.stock === 0}>
                  <Swords className="h-4 w-4" /> {running ? 'Agents are negotiating…' : 'Run the arena'}
                </Button>
                {selected.stock === 0 && <InlineNotice tone="warning">This product is out of stock.</InlineNotice>}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-forest/55">
                Select a product from the list. The arena uses its real public terms and creates a real negotiation.
              </p>
            )}
          </Card>

          <InlineNotice tone="info" title="What the arena proves">
            The buyer and seller agents are the same code paths used by the storefront, HTTP API and MCP tools. The pricing engine
            decides each move; the language layer only phrases it. The confidential floor is never sent to this browser.
          </InlineNotice>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-forest/10 bg-pale/40 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/45">Live negotiation</p>
                <p className="mt-1 text-sm font-semibold text-forest">
                  {current ? current.productName : selected ? selected.name : 'No run yet'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {current && <NegotiationStatusBadge status={current.status} />}
                {current && <MarketBadge market={current.marketType} />}
                {current && <AgentModeBadge mode={current.agentMode} />}
              </div>
            </div>
            {current && (
              <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-forest/10 bg-forest/10">
                <div className="bg-white px-3 py-2">
                  <p className="text-[0.58rem] uppercase tracking-[0.1em] text-forest/45">Buyer moves</p>
                  <p className="text-sm font-semibold text-forest">{buyerMoves.length}</p>
                </div>
                <div className="bg-white px-3 py-2">
                  <p className="text-[0.58rem] uppercase tracking-[0.1em] text-forest/45">Seller moves</p>
                  <p className="text-sm font-semibold text-forest">{sellerMoves.length}</p>
                </div>
                <div className="bg-white px-3 py-2">
                  <p className="text-[0.58rem] uppercase tracking-[0.1em] text-forest/45">Round</p>
                  <p className="text-sm font-semibold text-forest">
                    {current.roundsUsed}/{current.maxRounds}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[520px] min-h-[380px] space-y-3 overflow-y-auto p-5">
            {!current && !running && (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pale text-teal-deep">
                  <Swords className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-forest">The arena is idle</h3>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-forest/55">
                  Choose a product and run a negotiation. Each turn is written to the database, including the policy receipt.
                </p>
              </div>
            )}
            {running && !current && (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center text-center">
                <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-teal-deep" />
                <p className="mt-3 text-xs font-medium text-forest/60">Opening the negotiation…</p>
              </div>
            )}
            {offers.map((offer) => {
              const buyer = offer.submittedBy.startsWith('BUYER');
              return (
                <div key={offer.id} className={`flex ${buyer ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl border px-3.5 py-3 ${
                      buyer ? 'border-teal/25 bg-[#eef7f7]' : 'border-forest/12 bg-pale/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[0.62rem] font-bold uppercase tracking-[0.08em] ${buyer ? 'text-teal-ink' : 'text-forest/60'}`}>
                        {buyer ? 'Buyer agent' : 'Seller agent'}
                      </span>
                      <span className="text-[0.58rem] text-forest/35">Round {offer.round}</span>
                      <Badge tone={offer.kind === 'REJECTION' ? 'amber' : offer.kind === 'ACCEPTANCE' ? 'forest' : 'sage'}>
                        {offer.kind === 'ACCEPTANCE' ? 'Acceptance' : offer.kind === 'REJECTION' ? 'Rejection' : formatMoney(offer.unitPrice, current?.currency ?? 'USD')}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[0.72rem] leading-relaxed text-forest/75">{offer.message}</p>
                    {offer.explanation && offer.explanation !== offer.message && (
                      <p className="mt-1.5 rounded-lg bg-white/70 px-2 py-1.5 text-[0.64rem] leading-relaxed text-forest/55">
                        <ShieldCheck className="mr-1 inline h-3 w-3 align-[-2px] text-teal-deep" aria-hidden />
                        {offer.explanation}
                      </p>
                    )}
                    <p className="mt-1 text-[0.6rem] text-forest/40">
                      {formatMoney(offer.unitPrice, current?.currency ?? 'USD')} / unit ·{' '}
                      {formatMoney(offer.totalPrice, current?.currency ?? 'USD')} total
                    </p>
                  </div>
                </div>
              );
            })}
            {running && offers.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 text-[0.68rem] text-forest/50">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-teal-deep" /> Waiting for the next real agent turn…
              </div>
            )}
          </div>

          {current && (
            <div className="border-t border-forest/10 bg-pale/30 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-forest/45">Outcome</p>
                  <p className="mt-0.5 text-sm font-semibold text-forest">
                    {current.status === 'AGREED' || current.status === 'AWAITING_APPROVAL'
                      ? `${formatMoney(current.agreedUnitPrice ?? 0, current.currency)} × ${current.quantity} = ${formatMoney(current.totalAmount ?? 0, current.currency)}`
                      : current.status === 'OPEN'
                        ? 'Round limit reached without agreement'
                        : 'No deal reached'}
                  </p>
                </div>
                <Link to={`/buyer/deals/${current.id}`} className="btn btn-secondary btn-sm">
                  Continue in the room <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export function BuyerOrders() {
  useDocumentTitle('Orders');
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-forest/10 bg-pale/40 px-4 py-3 text-xs leading-relaxed text-forest/60">
        <span className="font-semibold text-forest">Two honest rails.</span> Cross-border orders use PayPal Sandbox with
        server-side capture. India domestic orders use manual, off-platform settlement and are never presented as PayPal
        payments.
      </div>
      <OrdersPage role="BUYER" />
    </div>
  );
}
