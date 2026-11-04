import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Database,
  Globe2,
  KeyRound,
  LockKeyhole,
  Scale,
  Server,
  ShieldCheck,
  Store,
  Terminal,
  Webhook,
} from 'lucide-react';
import { Badge, Card, InlineNotice } from '../components/ui';
import { CodeBlock, InlineCode } from '../components/Feedback';
import { useAsync, useDocumentTitle } from '../lib/useAsync';
import { api } from '../lib/api';

type Health = {
  status: string;
  database: { mode: string; label: string; ok: boolean };
  integrations: {
    gemini: { configured: boolean };
    paypal: { configured: boolean; environment?: string; webhookConfigured?: boolean };
    mcp: { authenticated: boolean };
  };
  mcp: { endpoint: string; tools: number };
};

const toolGroups: Array<{
  audience: 'Buyer' | 'Seller' | 'Commerce';
  tone: 'teal' | 'sage' | 'mint';
  tools: Array<{ name: string; detail: string }>;
}> = [
  {
    audience: 'Buyer',
    tone: 'teal',
    tools: [
      { name: 'search_market', detail: 'Search published products by query, category, currency, country, quantity and total budget.' },
      { name: 'get_product', detail: 'Read one public product with seller, stock, bulk tiers and public negotiation terms.' },
      { name: 'start_negotiation', detail: 'Open a negotiation for a product and quantity. The engine validates every price.' },
      { name: 'get_negotiation', detail: 'Read the full offer history, deal, order and public policy facts.' },
      { name: 'advance_negotiation', detail: 'Advance exactly one agent turn. Decisions come from policy, not prose.' },
      { name: 'submit_offer', detail: 'Submit an explicit buyer unit price for the seller agent to answer.' },
    ],
  },
  {
    audience: 'Seller',
    tone: 'sage',
    tools: [
      { name: 'list_products', detail: 'List your own catalog with stock and active state.' },
      { name: 'get_product_rules', detail: 'Read your confidential rules, including the floor. Seller keys only.' },
      { name: 'update_product_rules', detail: 'Replace rules after validation. Seller keys only; every change is audited.' },
      { name: 'list_negotiations', detail: 'List negotiations for your store with status, rounds and current position.' },
      { name: 'approve_deal', detail: 'Approve a deal paused by an approval gate and reserve stock atomically.' },
    ],
  },
  {
    audience: 'Commerce',
    tone: 'mint',
    tools: [
      { name: 'list_orders', detail: 'List orders visible to the authenticated buyer or seller.' },
      { name: 'get_order', detail: 'Read one order with its payment state and settlement note.' },
      { name: 'create_payment', detail: 'Create the server-authoritative payment for a confirmed deal.' },
      { name: 'get_payment_status', detail: 'Read local payment state, optionally reconciling with PayPal.' },
    ],
  },
];

const apiRows: Array<{ method: string; path: string; note: string; auth: string }> = [
  { method: 'POST', path: '/api/auth/signup', note: 'Create a buyer or seller account and set an httpOnly session.', auth: 'Public' },
  { method: 'POST', path: '/api/auth/login', note: 'Email + password session.', auth: 'Public' },
  { method: 'GET', path: '/api/auth/me', note: 'Current user, profiles and integration flags.', auth: 'Session / key' },
  { method: 'GET', path: '/api/public/stores', note: 'Published storefronts with public negotiation terms.', auth: 'Public' },
  { method: 'GET', path: '/api/public/stores/:slug/products', note: 'Public catalog with stock and bulk tiers.', auth: 'Public' },
  { method: 'GET', path: '/api/public/market/products', note: 'Market search with quantity and total budget.', auth: 'Public' },
  { method: 'POST', path: '/api/buyer/discover', note: 'Parse a brief, then search the market with budget fit.', auth: 'Buyer' },
  { method: 'POST', path: '/api/negotiations', note: 'Open a real negotiation.', auth: 'Buyer' },
  { method: 'POST', path: '/api/negotiations/:id/step', note: 'Advance one agent turn, policy-validated.', auth: 'Participant' },
  { method: 'POST', path: '/api/negotiations/:id/confirm', note: 'Buyer confirms an agreed deal.', auth: 'Buyer' },
  { method: 'POST', path: '/api/payments/deals/:id', note: 'Create manual settlement or PayPal Sandbox payment.', auth: 'Buyer' },
  { method: 'POST', path: '/api/payments/:id/capture', note: 'Capture PayPal server-side and reconcile the amount.', auth: 'Participant' },
  { method: 'POST', path: '/api/orders/:id/settle', note: 'Seller confirms domestic off-platform funds.', auth: 'Seller' },
  { method: 'GET', path: '/api/dashboard/analytics', note: 'Seller analytics, AG Grid rows and policy narrative.', auth: 'Seller' },
  { method: 'POST', path: '/api/webhooks/paypal', note: 'Signed PayPal events with idempotent handling.', auth: 'PayPal signature' },
];

export function DocsPage() {
  useDocumentTitle('Developer documentation');
  const health = useAsync<Health>(() => api.get('/health'));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-3xl">
        <p className="eyebrow">Developer documentation</p>
        <h1 className="serif mt-3 text-[3rem] leading-[1.02] text-forest sm:text-[3.6rem]">
          One authority. Three surfaces.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-forest/65">
          The web app, the HTTP API and the MCP server all call the same services. The pricing engine owns every number; the
          language layer only phrases decisions. This page documents the real contracts and the honest limits of the build.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone="teal">{health.data?.mcp.tools ?? 15} MCP tools</Badge>
          <Badge tone="sage">
            {health.data?.database.mode === 'embedded' ? 'Embedded PGlite' : health.data ? 'Managed Postgres' : 'Database'}
          </Badge>
          <Badge tone={health.data?.integrations.gemini.configured ? 'teal' : 'outline'}>
            Gemini {health.data?.integrations.gemini.configured ? 'on' : 'off'}
          </Badge>
          <Badge tone={health.data?.integrations.paypal.configured ? 'teal' : 'outline'}>
            PayPal {health.data?.integrations.paypal.configured ? 'configured' : 'not configured'}
          </Badge>
        </div>
      </header>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Documentation sections">
        {[
          { href: '#quickstart', label: 'Quickstart' },
          { href: '#architecture', label: 'Architecture' },
          { href: '#api', label: 'HTTP API' },
          { href: '#mcp', label: 'MCP' },
          { href: '#security', label: 'Security' },
          { href: '#limitations', label: 'Limitations' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-forest/15 bg-white px-3.5 py-1.5 text-xs font-medium text-forest/70 transition-colors hover:border-teal/35 hover:text-forest"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section id="quickstart" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-forest">Quickstart</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest/60">
          Run the API and web app locally, sign in with a demo account, then create an API key in the seller developer console.
          The same JSON shapes are used by the web app.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Run the stack',
              detail: 'npm install, then npm run dev. The embedded database migrates and seeds on first boot.',
              code: 'npm install\nnpm run dev',
            },
            {
              step: '02',
              title: 'Sign in',
              detail: 'Seller: seller@bhavai.demo. Buyer: alex@bhavai.demo. Password: BhavAI!2026.',
              code: 'seller@bhavai.demo\nBhavAI!2026',
            },
            {
              step: '03',
              title: 'Create a key',
              detail: 'Open Seller studio → Developer → Create API key. Keys inherit your role.',
              code: 'Authorization: Bearer bvk_…',
            },
          ].map((item) => (
            <Card key={item.step} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-semibold tracking-[0.16em] text-forest/35">{item.step}</span>
                <Terminal className="h-4 w-4 text-teal-deep" aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-forest">{item.title}</h3>
              <p className="mt-1.5 text-[0.72rem] leading-relaxed text-forest/55">{item.detail}</p>
              <div className="mt-3 rounded-lg bg-pale px-3 py-2 font-mono text-[0.66rem] leading-relaxed text-forest/70">
                {item.code.split('\n').map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-4">
          <InlineNotice tone="info" title="Response envelope">
            Successful responses are <InlineCode>{'{ data: … }'}</InlineCode>. Errors are{' '}
            <InlineCode>{'{ error: { code, message, details?, requestId } }'}</InlineCode>. A request ID is returned on every
            error for support.
          </InlineNotice>
        </div>
      </section>

      <section id="architecture" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-forest">Architecture</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest/60">
          There is no separate “AI mode” with weaker rules. Every surface enters through the same service layer, and every write
          revalidates the current database state inside a transaction.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          <ArchBox
            icon={<Store className="h-4 w-4" />}
            title="Surfaces"
            lines={['React buyer + seller app', 'HTTP JSON API', 'MCP Streamable HTTP']}
            tone="sage"
          />
          <Arrow />
          <ArchBox
            icon={<Server className="h-4 w-4" />}
            title="Service layer"
            lines={['Auth + roles', 'Catalog + storefronts', 'Negotiation coordinator', 'Orders + payments']}
            tone="teal"
          />
          <Arrow />
          <ArchBox
            icon={<Scale className="h-4 w-4" />}
            title="Authority"
            lines={['Pure pricing engine', 'Server-side validation', 'Atomic stock reservation', 'Webhook reconciliation']}
            tone="forest"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <Bot className="h-4 w-4 text-teal-deep" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-forest">Deterministic decisions</h3>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-forest/55">
              The pricing engine decides accept, counter or reject. Gemini may phrase the message afterward with a numeric
              allowlist; it cannot emit or change a price.
            </p>
          </Card>
          <Card className="p-5">
            <Database className="h-4 w-4 text-teal-deep" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-forest">One database contract</h3>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-forest/55">
              Embedded PGlite by default, managed Postgres/Supabase when <InlineCode>DATABASE_URL</InlineCode> is set. The same
              SQL migrations apply to both.
            </p>
          </Card>
          <Card className="p-5">
            <Globe2 className="h-4 w-4 text-teal-deep" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-forest">Market routing on the server</h3>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-forest/55">
              India → India becomes manual settlement. Any cross-border pair uses PayPal Sandbox when configured. The client
              cannot choose a weaker rail.
            </p>
          </Card>
        </div>
      </section>

      <section id="api" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-forest">HTTP API</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest/60">
          Session auth uses an httpOnly cookie. Agents can use <InlineCode>Authorization: Bearer bvk_…</InlineCode> or{' '}
          <InlineCode>x-bhavai-key</InlineCode>. Rate limits apply to auth and write routes.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-forest/10 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-forest/10 bg-pale/60 text-[0.62rem] uppercase tracking-[0.12em] text-forest/50">
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Path</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Auth</th>
                </tr>
              </thead>
              <tbody>
                {apiRows.map((row) => (
                  <tr key={`${row.method}-${row.path}`} className="border-b border-forest/[0.06] last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-pale px-1.5 py-0.5 font-mono text-[0.64rem] font-semibold text-forest">
                        {row.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[0.68rem] text-forest/75">{row.path}</td>
                    <td className="px-4 py-2.5 text-xs leading-relaxed text-forest/60">{row.note}</td>
                    <td className="px-4 py-2.5 text-[0.66rem] text-forest/50">{row.auth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <CodeBlock
            title="Open a negotiation"
            code={`curl -X POST "$API/api/negotiations" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bvk_…" \\
  -d '{
    "productId": "prod_…",
    "quantity": 6,
    "unitPrice": 30,
    "budgetTotal": 210,
    "message": "We can commit this week."
  }'`}
          />
          <CodeBlock
            title="Advance one turn"
            code={`curl -X POST "$API/api/negotiations/$ID/step" \\
  -H "Authorization: Bearer bvk_…"

# The response contains the full offer history,
# deal, order and public policy facts.`}
          />
        </div>
      </section>

      <section id="mcp" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-forest">MCP server</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest/60">
          The endpoint speaks Streamable HTTP at <InlineCode>POST /mcp</InlineCode>. A fresh stateless server and transport are
          created per request, so there is no session to resume. Use the official MCP SDK or any compatible client.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Terminal className="h-4 w-4 text-teal-deep" aria-hidden /> Connection facts
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              {[
                ['Endpoint', 'POST /mcp'],
                ['Protocol', '2025-06-18'],
                ['Transport', 'Streamable HTTP (stateless)'],
                ['Auth', health.data?.integrations.mcp.authenticated ? 'API key + server gate' : 'Buyer/seller API key'],
                ['Accept header', 'application/json, text/event-stream'],
                ['Tools', String(health.data?.mcp.tools ?? 15)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-forest/[0.07] pb-2 last:border-0">
                  <dt className="text-forest/50">{label}</dt>
                  <dd className="text-right font-mono text-[0.66rem] text-forest">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <InlineNotice tone="warning" title="Buyer keys stay narrow">
                A buyer key cannot call seller-only tools. Confidential floor and minimum-allowed prices are never returned by
                buyer-facing tools, storefront JSON or the public API.
              </InlineNotice>
            </div>
          </Card>

          <div className="space-y-3">
            <CodeBlock
              title="initialize"
              code={`curl -X POST "$API/mcp" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer bvk_…" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": { "name": "bhavai-docs", "version": "1.0.0" }
    }
  }'`}
            />
            <CodeBlock
              title="tools/list"
              code={`curl -X POST "$API/mcp" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer bvk_…" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'`}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {toolGroups.map((group) => (
            <Card key={group.audience} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-forest">{group.audience} tools</h3>
                <Badge tone={group.tone}>{group.tools.length}</Badge>
              </div>
              <div className="mt-3 space-y-2.5">
                {group.tools.map((tool) => (
                  <div key={tool.name}>
                    <code className="font-mono text-[0.68rem] font-semibold text-forest">{tool.name}</code>
                    <p className="mt-0.5 text-[0.66rem] leading-relaxed text-forest/55">{tool.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="security" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-forest">Security and authority</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-forest">
              <LockKeyhole className="h-4 w-4 text-teal-deep" aria-hidden /> Confidential pricing
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-forest/60">
              {[
                'Public product JSON exposes minimum quantity, round limit and bulk tiers only.',
                'The floor and minimum allowed price are seller-only fields.',
                'Buyer-facing analytics, MCP tools and negotiation responses never include them.',
                'The seller simulator calls the same pure functions as the server.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden /> {line}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Webhook className="h-4 w-4 text-teal-deep" aria-hidden /> Payments
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-forest/60">
              {[
                'PayPal create and capture happen server-side with the agreed amount.',
                'Capture is reconciled against the local payment before an order becomes paid.',
                'Webhook signatures are verified; events are idempotent.',
                'Domestic Indian orders are manual settlement, never a fake PayPal success.',
                'Missing credentials produce a clear 503 and no payment record.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden /> {line}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <KeyRound className="h-4 w-4 text-teal-deep" aria-hidden />
            <h3 className="mt-2 text-xs font-semibold text-forest">Credentials</h3>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-forest/55">
              scrypt password hashes, httpOnly SameSite=Lax sessions, hashed API keys shown once.
            </p>
          </Card>
          <Card className="p-4">
            <Scale className="h-4 w-4 text-teal-deep" aria-hidden />
            <h3 className="mt-2 text-xs font-semibold text-forest">Revalidation</h3>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-forest/55">
              Acceptance, stock reservation and payment re-run the same rules inside transactions with row locks.
            </p>
          </Card>
          <Card className="p-4">
            <Database className="h-4 w-4 text-teal-deep" aria-hidden />
            <h3 className="mt-2 text-xs font-semibold text-forest">Audit trail</h3>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-forest/55">
              Sign-in, publish, rule changes, approvals, settlement and key management are written to an audit table.
            </p>
          </Card>
        </div>
      </section>

      <section id="limitations" className="mt-14 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-forest">Honest limitations</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest/60">
          This is a hackathon reference implementation. The following are deliberate, real limits — not hidden fallbacks.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card className="border-[#d99a55]/40 bg-[#fbf3e8] p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#6b3a12]">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Not production commerce
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#6b3a12]/80">
              {[
                'PayPal runs in Sandbox only. Verify every flow before commercial use.',
                'No shipping, tax, returns or dispute workflow is implemented.',
                'No currency conversion: searches, rules and payments stay in one currency.',
                'No transactional email provider. Password-reset links are not delivered.',
                'Embedded PGlite is single-instance. Use managed Postgres for horizontal scale.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8a5a22]" aria-hidden /> {line}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Globe2 className="h-4 w-4 text-teal-deep" aria-hidden /> Market and integration limits
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-forest/60">
              {[
                'India → India settles off-platform; BhavAI records the seller confirmation but does not verify the transfer.',
                'Cross-border requires PayPal credentials; without them the API returns 503 PAYPAL_NOT_CONFIGURED.',
                'Gemini is optional. Without it, the deterministic policy text is used and labelled as such.',
                'Channel3 enrichment is optional and off by default.',
                'No marketplace connectors (Amazon, Shopify, Etsy). CSV import is manual and previewed.',
                'MCP is stateless per request; long-running agent sessions must be managed by the client.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-deep" aria-hidden /> {line}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-forest/10 bg-pale/50 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-forest">Ready to point an agent at a store?</h2>
            <p className="mt-1 text-sm text-forest/60">
              Browse the marketplace, or open a seller studio to publish a storefront and create a key.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/stores" className="btn btn-primary btn-sm">
              Browse marketplace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/signup?role=seller" className="btn btn-secondary btn-sm">
              Open a seller studio
            </Link>
          </div>
        </div>
      </section>

      <p className="mt-8 text-center text-[0.66rem] leading-relaxed text-forest/40">
        BhavAI is MIT licensed. No production money movement. Verify every integration before commercial use.
      </p>
    </div>
  );
}

function ArchBox({
  icon,
  title,
  lines,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  tone: 'sage' | 'teal' | 'forest';
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === 'forest' ? 'border-forest bg-forest text-ivory' : tone === 'teal' ? 'border-[#01949a]/25 bg-[#eef7f7]' : 'border-forest/10 bg-white'
      }`}
    >
      <div className={`flex items-center gap-2 text-sm font-semibold ${tone === 'forest' ? 'text-ivory' : 'text-forest'}`}>
        {icon} {title}
      </div>
      <ul className={`mt-2 space-y-1 text-[0.68rem] leading-relaxed ${tone === 'forest' ? 'text-ivory/65' : 'text-forest/55'}`}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden>
      <ArrowRight className="h-4 w-4 rotate-90 text-forest/25 lg:rotate-0" />
    </div>
  );
}
