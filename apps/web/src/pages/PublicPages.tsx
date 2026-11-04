import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CircleDollarSign,
  Gauge,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Store,
  Terminal,
  Waypoints,
} from 'lucide-react';
import { formatMoney } from '@bhavai/shared';
import { Badge, Card, InlineNotice, Stat } from '../components/ui';
import { ProductArt } from '../components/ProductArt';
import { api } from '../lib/api';
import { useAsync, useDocumentTitle } from '../lib/useAsync';
import type { PublicProduct, PublicStore } from '../lib/types';

type Health = {
  status: string;
  database: { mode: string; label: string; ok: boolean };
  integrations: { gemini: { configured: boolean }; paypal: { configured: boolean }; mcp: { authenticated: boolean } };
  mcp: { endpoint: string; tools: number };
};

export function LandingPage() {
  useDocumentTitle('Agent-ready commerce');
  const health = useAsync<Health>(() => api.get('/health'));
  const featured = useAsync<{ products: PublicProduct[]; total: number }>(() =>
    api.get('/api/public/market/products?pageSize=3&inStock=true'),
  );

  return (
    <div>
      <section className="hero-wash relative overflow-hidden border-b border-forest/[0.07]">
        <div className="pointer-events-none absolute inset-0 grid-fade" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-24">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest/10 bg-ivory/80 px-3 py-1.5 text-[0.68rem] font-semibold text-forest/70">
              <Sparkles className="h-3.5 w-3.5 text-teal-deep" aria-hidden />
              Built for the PayPal AI Hackathon 2026
            </div>
            <h1 className="serif mt-6 text-[3.2rem] leading-[0.98] tracking-[-0.02em] text-forest sm:text-[4.1rem]">
              Your storefront. Their AI.
              <span className="relative ml-2 inline-block text-teal-deep">
                One seamless deal
                <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 220 8" fill="none" aria-hidden>
                  <path d="M2 5.5C48 2.5 120 2 218 4.5" stroke="#D99A55" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                </svg>
              </span>
              .
            </h1>
            <p className="mt-7 max-w-lg text-[1.02rem] leading-relaxed text-forest/70">
              Turn your products into agent-ready storefronts. Let AI buyers discover, negotiate and purchase while you
              stay in control.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup?role=seller" className="btn btn-primary btn-lg">
                Create your AI Storefront <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/demo/arena" className="btn btn-secondary btn-lg">
                See how BhavAI works
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-forest/55">
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="h-3.5 w-3.5" /> Floor prices stay server-side
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Deterministic decisions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Waypoints className="h-3.5 w-3.5" /> {health.data?.mcp.tools ?? 15} MCP tools
              </span>
            </div>
          </div>

          <div className="animate-rise lg:justify-self-end" style={{ animationDelay: '120ms' }}>
            <Card className="w-full max-w-[500px] overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b border-forest/10 bg-pale/50 px-4 py-3">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/50">Live policy trace</p>
                  <p className="mt-0.5 text-sm font-semibold text-forest">Amber Glass Lantern · 6 units</p>
                </div>
                <Badge tone="teal">Cross-border</Badge>
              </div>
              <div className="space-y-4 p-4">
                <TraceRow
                  side="Buyer agent"
                  price={27.3}
                  currency="USD"
                  note="Opening offer, inside the buyer’s stated budget."
                  status="Below authorised range"
                  tone="amber"
                />
                <TraceRow
                  side="Seller agent"
                  price={32.55}
                  currency="USD"
                  note="Counter positions toward target without crossing the confidential floor."
                  status="Valid · policy"
                  tone="teal"
                />
                <TraceRow
                  side="Buyer agent"
                  price={31.67}
                  currency="USD"
                  note="Raises toward the counter while staying under the total budget."
                  status="Valid · policy"
                  tone="teal"
                />
              </div>
              <div className="border-t border-forest/10 bg-[#eef7f7] px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden />
                  <p className="text-[0.72rem] leading-relaxed text-forest/70">
                    Every number is validated by the pricing engine before it is written. Gemini may rephrase the message after
                    the fact — it cannot change a price.
                  </p>
                </div>
              </div>
            </Card>
            <p className="mt-3 text-center text-[0.65rem] text-forest/45">Illustrative trace from the seeded sample negotiation.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-forest/[0.07] bg-ivory">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            { icon: Bot, title: 'Agent-readable', detail: 'MCP + JSON storefronts' },
            { icon: Gauge, title: 'Policy-bounded', detail: 'Same engine on every surface' },
            { icon: Globe2, title: 'Cross-border', detail: 'PayPal Sandbox, server-side' },
            { icon: CircleDollarSign, title: 'Domestic-honest', detail: 'Manual settlement in India' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/70 text-forest">
                <item.icon className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-forest">{item.title}</p>
                <p className="text-xs text-forest/55">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">One authority, three surfaces</p>
          <h2 className="serif mt-3 text-[2.6rem] leading-[1.05] text-forest">A storefront humans like and agents can use.</h2>
          <p className="mt-4 text-sm leading-relaxed text-forest/65">
            The same pricing service powers the web app, the HTTP API and the MCP server. There is no separate “AI mode” with
            different rules to audit or bypass.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<Store className="h-5 w-5" />}
            title="Agent-readable storefronts"
            detail="Public store, product, stock, bulk tiers and public negotiation terms — structured for both people and models."
            points={['Clean JSON contracts', 'No confidential floors', 'Published/unpublished state']}
          />
          <FeatureCard
            icon={<Bot className="h-5 w-5" />}
            title="Negotiation with receipts"
            detail="Buyer and seller agents alternate. Each offer carries its validation state and a plain-language explanation."
            points={['Atomic stock reservation', 'Round limits and approval gates', 'Gemini never decides validity']}
          />
          <FeatureCard
            icon={<CircleDollarSign className="h-5 w-5" />}
            title="The right rail for the market"
            detail="Cross-border orders use PayPal Orders v2 with server-side capture. India-to-India settles off-platform, clearly labelled."
            points={['Webhook signature verification', 'Idempotent event handling', 'No simulated success states']}
          />
        </div>
      </section>

      <section className="border-y border-forest/[0.07] bg-pale/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">Market routing</p>
            <h2 className="serif mt-3 text-[2.5rem] leading-[1.05] text-forest">Two markets. Two honest rails.</h2>
            <p className="mt-4 text-sm leading-relaxed text-forest/65">
              Payment routing is decided on the server from seller and buyer country. A domestic Indian order never pretends
              to be a PayPal transaction, and a cross-border order cannot silently fall back to manual settlement.
            </p>
            <div className="mt-6">
              <InlineNotice tone="warning" title="Sandbox build">
                PayPal credentials are read from the environment. With none configured, the API returns a 503 and creates no
                payment record rather than showing a fake approval screen.
              </InlineNotice>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <Badge tone="sage">India → India</Badge>
              <h3 className="mt-3 text-lg font-semibold text-forest">Manual settlement</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-forest/60">
                The buyer confirms the deal; the seller confirms receipt off-platform. BhavAI records the note and never
                verifies or claims the funds.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-forest/70">
                {['No PayPal charge attempted', 'Seller confirms settlement', 'Order marked SETTLED, then fulfilled'].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 text-teal-deep" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <Badge tone="teal">Cross-border</Badge>
              <h3 className="mt-3 text-lg font-semibold text-forest">PayPal Sandbox</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-forest/60">
                Server creates the order with the agreed amount, the buyer approves, and capture is verified against the
                local payment before it is marked paid.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-forest/70">
                {['Server-side create + capture', 'Amount reconciliation', 'Signed webhooks, idempotent'].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 text-teal-deep" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Published today</p>
            <h2 className="serif mt-3 text-[2.5rem] leading-[1.05] text-forest">Real storefronts from the seed.</h2>
            <p className="mt-3 max-w-xl text-sm text-forest/60">
              These are live rows from the embedded database, labelled as sample data. No invented sellers, products or
              prices.
            </p>
          </div>
          <Link to="/stores" className="btn btn-secondary">
            All storefronts <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(featured.data?.products ?? []).map((product) => (
            <Link key={product.id} to={`/stores/${product.seller.storeSlug}/${product.id}`} className="group">
              <Card className="card-hover overflow-hidden p-0">
                <ProductArt name={product.name} category={product.category} images={product.images} className="h-44 rounded-none" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-forest group-hover:text-teal-deep">{product.name}</h3>
                      <p className="mt-0.5 text-xs text-forest/55">{product.seller.businessName}</p>
                    </div>
                    <p className="text-sm font-semibold text-forest">{formatMoney(product.listedPrice, product.currency)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone="sage">{product.category}</Badge>
                    {product.stock > 0 ? <span className="text-[0.65rem] text-forest/45">{product.stock} in stock</span> : <Badge tone="amber">Out of stock</Badge>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {featured.loading &&
            [0, 1, 2].map((index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-forest/[0.05]" aria-hidden />)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Card className="grid gap-8 overflow-hidden p-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-7 sm:p-10">
            <p className="eyebrow">For sellers</p>
            <h2 className="serif mt-3 text-[2.4rem] leading-[1.06] text-forest">Set the boundary. Let the agents work.</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-forest/65">
              Your floor, discount ceiling, bulk tiers, round limit and approval gates are confidential seller policy. The
              agents negotiate inside them; the server revalidates at acceptance and again before payment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/signup?role=seller" className="btn btn-primary">
                Create your storefront
              </Link>
              <Link to="/for-sellers" className="btn btn-secondary">
                How it works
              </Link>
            </div>
          </div>
          <div className="border-t border-forest/10 bg-pale/60 p-7 sm:p-10 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <Stat label="Negotiation authority" value="Deterministic" detail="Bounded by explicit rules" tone="teal" />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Data store" value={health.data?.database.mode === 'embedded' ? 'Embedded' : 'Managed'} detail={health.data?.database.label ?? 'PostgreSQL'} />
                <Stat
                  label="AI mode"
                  value={health.data?.integrations.gemini.configured ? 'Gemini' : 'Policy'}
                  detail={health.data?.integrations.gemini.configured ? 'Language layer on' : 'Deterministic text fallback'}
                  tone="amber"
                />
              </div>
            </div>
            <p className="mt-4 text-[0.65rem] leading-relaxed text-forest/45">
              Status is read live from <code>/health</code>. Optional integrations are reported as configured or off.
            </p>
          </div>
        </Card>
      </section>

      <section className="border-t border-forest/[0.07] bg-forest text-ivory">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-sage">Developer surface</p>
            <h2 className="serif mt-3 text-[2.4rem] leading-tight">Point an agent at your store.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ivory/65">
              The MCP endpoint speaks Streamable HTTP. Create an API key in the developer console, then call the same tools
              the web app uses.
            </p>
          </div>
          <div className="rounded-xl border border-ivory/15 bg-[#0f2c2d] p-4 font-mono text-xs leading-relaxed text-ivory/80">
            <p className="text-sage"># endpoint</p>
            <p>POST /mcp</p>
            <p className="mt-2 text-sage"># auth</p>
            <p>Authorization: Bearer bvk_…</p>
            <Link to="/docs#mcp" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sage hover:text-ivory">
              Read MCP integration guide <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function TraceRow({
  side,
  price,
  currency,
  note,
  status,
  tone,
}: {
  side: string;
  price: number;
  currency: string;
  note: string;
  status: string;
  tone: 'teal' | 'amber';
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-[0.6rem] font-bold text-ivory">
        {side.startsWith('Buyer') ? 'BA' : 'SA'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-forest">{side}</p>
          <p className="text-sm font-semibold text-forest">{formatMoney(price, currency)}<span className="text-[0.65rem] font-normal text-forest/50"> / unit</span></p>
        </div>
        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-forest/55">{note}</p>
        <div className="mt-1.5">
          <Badge tone={tone}>{status}</Badge>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  detail,
  points,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  points: string[];
}) {
  return (
    <Card className="p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/70 text-forest">{icon}</div>
      <h3 className="mt-4 text-base font-semibold text-forest">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-forest/60">{detail}</p>
      <ul className="mt-4 space-y-1.5">
        {points.map((point) => (
          <li key={point} className="flex items-center gap-2 text-[0.7rem] text-forest/65">
            <span className="h-1 w-1 rounded-full bg-teal" aria-hidden /> {point}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ForSellersPage() {
  useDocumentTitle('For sellers');
  return (
    <div>
      <section className="hero-wash border-b border-forest/[0.07]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">For sellers</p>
            <h1 className="serif mt-3 text-[3rem] leading-[1.02] text-forest sm:text-[3.6rem]">
              Your rules. Their agents. One source of truth.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-forest/65">
              Publish an agent-readable storefront, decide the boundaries of every negotiation, and keep payment routing
              honest for the market you actually sell into.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup?role=seller" className="btn btn-primary btn-lg">
                Start selling <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/docs" className="btn btn-secondary btn-lg">
                Read the architecture
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Add the catalog',
              detail: 'Create products one at a time or import a CSV with a preview and explicit column mapping. Prices stay in one store currency.',
              icon: Store,
            },
            {
              step: '02',
              title: 'Define the boundary',
              detail: 'Set a confidential floor, maximum discount, bulk tiers, round limit, auto-accept price and approval gates.',
              icon: Gauge,
            },
            {
              step: '03',
              title: 'Publish and observe',
              detail: 'Every negotiation, offer, acceptance and order is recorded. Analytics are computed from your own rows, not demo metrics.',
              icon: Terminal,
            },
          ].map((item) => (
            <Card key={item.step} className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-semibold tracking-[0.16em] text-forest/35">{item.step}</span>
                <item.icon className="h-5 w-5 text-teal-deep" aria-hidden />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-forest">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-forest/60">{item.detail}</p>
            </Card>
          ))}
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Confidential by design</p>
            <h2 className="serif mt-3 text-[2.4rem] leading-tight text-forest">The floor never leaves the server.</h2>
            <p className="mt-4 text-sm leading-relaxed text-forest/65">
              Buyer-facing product, negotiation and MCP responses expose only public negotiation terms: minimum quantity,
              round limit and bulk tiers. The floor and minimum allowed price are seller-only. The seller-facing simulator
              uses the same pure function the backend uses, so what you see is what will be enforced.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-forest/70">
              {[
                'Acceptance revalidates the offer inside a row-locked transaction',
                'Stock is deducted atomically at acceptance — not at offer time',
                'Payment revalidates the deal amount before contacting PayPal',
                'Approval thresholds pause a deal without reserving stock',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-forest/10 bg-pale/50 px-5 py-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/50">Rule snapshot · seller only</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-forest/10">
              {[
                ['Listed price', '$35.00'],
                ['Confidential floor', '$28.00'],
                ['Max discount', '18%'],
                ['Minimum allowed', '$28.70'],
                ['Round limit', '5'],
                ['Auto-accept at', '$32.00'],
                ['Approval below', '$29.50'],
                ['Bulk tier', '12+ · 7%'],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-4 py-3.5">
                  <p className="text-[0.65rem] text-forest/45">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-forest">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#fbf3e8] px-4 py-3 text-[0.68rem] leading-relaxed text-[#6b3a12]">
              Seeded example for the Amber Glass Lantern. Never include these values in buyer-facing output.
            </div>
          </Card>
        </div>
      </section>

      <section className="border-t border-forest/[0.07] bg-pale/40 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="eyebrow">Ready when you are</p>
          <h2 className="serif mt-3 text-[2.6rem] leading-tight text-forest">Bring a real catalog. We will keep the rules.</h2>
          <p className="mt-3 text-sm text-forest/60">
            Demo account: seller@bhavai.demo with password BhavAI!2026. The seeded storefronts are labelled as sample data.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup?role=seller" className="btn btn-primary">
              Create a seller account
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Sign in to the demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function StoreListPage() {
  useDocumentTitle('Marketplace');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'IN' | 'international'>('all');
  const stores = useAsync<{ stores: PublicStore[]; llmConfigured: boolean }>(() => api.get('/api/public/stores'));

  const rows = (stores.data?.stores ?? []).filter((store) => {
    if (filter === 'IN' && store.country !== 'IN') return false;
    if (filter === 'international' && store.country === 'IN') return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return store.businessName.toLowerCase().includes(term) || store.description.toLowerCase().includes(term);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="max-w-2xl">
        <p className="eyebrow">Marketplace</p>
        <h1 className="serif mt-2 text-[2.8rem] leading-[1.05] text-forest">Storefronts that speak agent.</h1>
        <p className="mt-3 text-sm leading-relaxed text-forest/65">
          Browse published sellers, their public negotiation terms and real stock. Prices are listed, not final — every
          negotiation is bounded by confidential seller rules.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search storefronts</span>
          <input
            className="field pl-9"
            placeholder="Search businesses or descriptions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Waypoints className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/35" aria-hidden />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'all', label: 'All markets' },
            { value: 'IN', label: 'India' },
            { value: 'international', label: 'International' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value as typeof filter)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === option.value
                  ? 'border-forest bg-forest text-ivory'
                  : 'border-forest/15 bg-white text-forest/65 hover:border-forest/30'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {stores.error && <InlineNotice tone="warning">{stores.error}</InlineNotice>}

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {rows.map((store) => (
          <Link key={store.id} to={`/stores/${store.storeSlug}`} className="group">
            <Card className="card-hover h-full p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-sm font-semibold text-ivory">
                    {store.businessName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-forest group-hover:text-teal-deep">{store.businessName}</h2>
                    <p className="text-xs text-forest/50">{store.country === 'IN' ? 'India' : store.country} · {store.currency}</p>
                  </div>
                </div>
                <Badge tone="teal">MCP-ready</Badge>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-forest/60">{store.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Badge tone="sage">{store.productCount} products</Badge>
                <Badge tone="mint">{store.negotiation.maxRounds} rounds max</Badge>
                {store.categories.slice(0, 2).map((category) => (
                  <Badge key={category} tone="outline">{category}</Badge>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-forest/10 pt-4 text-xs">
                <span className="text-forest/45">{store.regions.join(' · ')}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-teal-deep">
                  Visit storefront <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {stores.loading && (
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {[0, 1].map((index) => <div key={index} className="h-60 animate-pulse rounded-2xl bg-forest/[0.05]" aria-hidden />)}
        </div>
      )}

      {!stores.loading && rows.length === 0 && (
        <div className="mt-10">
          <Card className="p-10 text-center">
            <Store className="mx-auto h-8 w-8 text-forest/30" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-forest">No published storefronts match that filter.</h2>
            <p className="mt-1 text-sm text-forest/55">Try another search, or create the first seller storefront.</p>
            <Link to="/signup?role=seller" className="btn btn-primary mt-5">Open a seller studio</Link>
          </Card>
        </div>
      )}

      <div className="mt-14 flex flex-col gap-4 rounded-2xl border border-forest/10 bg-pale/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-forest">Building an agent?</p>
          <p className="mt-1 text-xs text-forest/55">Use the MCP endpoint and the same tools the web app uses.</p>
        </div>
        <Link to="/docs#mcp" className="btn btn-secondary btn-sm">
          MCP guide <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function StorefrontPage() {
  const params = useParams();
  const slug = params.slug ?? '';
  useDocumentTitle('Storefront');
  const [search, setSearch] = useState('');
  const store = useAsync<{ store: PublicStore }>(() => api.get(`/api/public/stores/${encodeURIComponent(slug)}`), [slug]);
  const products = useAsync<{ products: PublicProduct[]; total: number; currency: string }>(
    () => api.get(`/api/public/stores/${encodeURIComponent(slug)}/products?pageSize=60`),
    [slug],
  );

  const rows = (products.data?.products ?? []).filter((product) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return product.name.toLowerCase().includes(term) || product.category.toLowerCase().includes(term);
  });

  if (store.loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="h-44 animate-pulse rounded-2xl bg-forest/[0.05]" />
      </div>
    );
  }

  if (store.error || !store.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Store className="mx-auto h-9 w-9 text-forest/30" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-forest">This storefront is not published.</h1>
        <p className="mt-2 text-sm text-forest/60">{store.error ?? 'The store may have been unpublished by its owner.'}</p>
        <Link to="/stores" className="btn btn-secondary mt-6">Browse other storefronts</Link>
      </div>
    );
  }

  const info = store.data.store;

  return (
    <div>
      <section className="border-b border-forest/[0.07] bg-pale/45">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-lg font-semibold text-ivory">
                  {info.businessName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-forest">{info.businessName}</h1>
                    <Badge tone="teal">Agent-readable</Badge>
                  </div>
                  <p className="mt-1 text-xs text-forest/55">
                    {info.country === 'IN' ? 'India' : info.country} · Prices in {info.currency} · {info.productCount} active products
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-forest/70">{info.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {info.categories.map((category) => (
                  <Badge key={category} tone="sage">{category}</Badge>
                ))}
              </div>
            </div>
            <Card className="w-full max-w-sm p-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/45">Purchase conditions</p>
              <ul className="mt-2.5 space-y-2">
                {info.purchaseConditions.map((condition) => (
                  <li key={condition} className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-forest/65">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden /> {condition}
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-forest/10 pt-3 text-[0.65rem] text-forest/45">
                MCP endpoint <code className="rounded bg-pale px-1 py-0.5">{info.api.mcp}</code> · protocol {info.api.protocolVersion}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-forest">Catalog</h2>
            <p className="text-xs text-forest/50">
              Negotiation: minimum {info.negotiation.supported ? 'order quantities apply per product' : 'not available'} · up to {info.negotiation.maxRounds} rounds
            </p>
          </div>
          <input
            className="field w-full max-w-xs"
            placeholder="Search this storefront"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search this storefront"
          />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((product) => (
            <Link key={product.id} to={`/stores/${slug}/${product.id}`} className="group">
              <Card className="card-hover h-full overflow-hidden p-0">
                <div className="relative">
                  <ProductArt name={product.name} category={product.category} images={product.images} className="h-44 rounded-none" />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {product.stock === 0 && <Badge tone="amber">Out of stock</Badge>}
                    {product.negotiation.negotiable && <Badge tone="forest">Negotiable</Badge>}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-forest group-hover:text-teal-deep">{product.name}</h3>
                      <p className="mt-0.5 text-[0.7rem] text-forest/45">{product.category}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-forest">{formatMoney(product.listedPrice, product.currency)}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-forest/55">{product.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.65rem] text-forest/45">
                    <span>{product.stock} in stock</span>
                    <span className="divider-dot" />
                    <span>Min {product.negotiation.minimumQuantity}</span>
                    {product.negotiation.bulkTiers.length > 0 && (
                      <>
                        <span className="divider-dot" />
                        <span>Bulk from {product.negotiation.bulkTiers[0]!.minimumQuantity}</span>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {products.loading && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-forest/[0.05]" aria-hidden />)}
          </div>
        )}

        {!products.loading && rows.length === 0 && (
          <div className="mt-8">
            <Card className="p-10 text-center">
              <p className="text-sm font-semibold text-forest">No products match that search.</p>
              <p className="mt-1 text-xs text-forest/55">Try a different term or browse the full catalog.</p>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
