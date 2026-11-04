import { Link } from 'react-router-dom';
import {
  Bot,
  Copy,
  ExternalLink,
  Globe2,
  LockKeyhole,
  RefreshCw,
  Store,
  Terminal,
} from 'lucide-react';
import { formatMoney } from '@bhavai/shared';
import { Badge, Button, Card, EmptyState, InlineNotice, PageHeader, Spinner, Stat } from '../../components/ui';
import { ErrorNotice, AgentModeBadge } from '../../components/Feedback';
import { ProductArt } from '../../components/ProductArt';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { PublicProduct, PublicStore } from '../../lib/types';

type StorefrontView = {
  store: PublicStore;
  products: PublicProduct[];
  total: number;
  apiEndpoints: {
    store: string;
    products: string;
    mcp: string;
  };
  agentMode: string;
};

export function SellerStorefront() {
  useDocumentTitle('AI Storefront');
  const { me } = useAuth();
  const { toast } = useToast();
  const slug = me?.seller?.storeSlug;

  const view = useAsync<StorefrontView | null>(async () => {
    if (!slug) return null;
    try {
      const [storeRes, productsRes] = await Promise.all([
        api.get<{ store: PublicStore }>(`/api/public/stores/${encodeURIComponent(slug)}`),
        api.get<{ products: PublicProduct[]; total: number }>(
          `/api/public/stores/${encodeURIComponent(slug)}/products?pageSize=50`,
        ),
      ]);
      const health = await api.get<{ mcp: { endpoint: string }; integrations: { gemini: { configured: boolean } } }>(
        '/health',
      );
      return {
        store: storeRes.store,
        products: productsRes.products,
        total: productsRes.total,
        apiEndpoints: {
          store: `/api/public/stores/${slug}`,
          products: `/api/public/stores/${slug}/products`,
          mcp: health.mcp.endpoint,
        },
        agentMode: health.integrations.gemini.configured ? 'GEMINI' : 'POLICY',
      };
    } catch {
      return null;
    }
  }, [slug]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast(`Copied ${label}`, 'success'),
      () => toast('Copy failed', 'error'),
    );
  };

  if (!slug) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="AI Storefront"
          title="Your agent-readable storefront"
          description="Complete onboarding to publish your storefront for AI buyers."
        />
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="No storefront yet"
          description="Set up your business in the storefront setup page to create your agent-readable store."
          action={
            <Link to="/seller/onboarding" className="btn btn-primary btn-sm">
              Go to storefront setup
            </Link>
          }
        />
      </div>
    );
  }

  if (view.loading) return <Spinner label="Loading your storefront preview" />;
  if (view.error) return <ErrorNotice error={view.error} onRetry={view.reload} />;
  if (!view.data) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="AI Storefront" title="Storefront not published" />
        <InlineNotice tone="warning" title="Publish your store">
          Your storefront has not been published yet. Complete the onboarding steps to make it visible to AI buyers.
        </InlineNotice>
        <Link to="/seller/onboarding" className="btn btn-primary btn-sm">
          Go to storefront setup
        </Link>
      </div>
    );
  }

  const { store, products, total, apiEndpoints, agentMode } = view.data;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Storefront"
        title={store.businessName}
        description="This is how AI buyers and agents see your storefront. Every endpoint below returns the same data the negotiation engine uses."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={view.reload} loading={view.loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link to={`/stores/${slug}`} className="btn btn-primary btn-sm" target="_blank" rel="noopener">
              <ExternalLink className="h-3.5 w-3.5" /> View public store
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Published products" value={total} detail={`${products.filter((p) => p.stock > 0).length} in stock`} tone="teal" />
        <Stat label="Store slug" value={slug} detail={`/stores/${slug}`} />
        <Stat label="Country" value={store.country} detail={store.currency} />
        <Stat label="Agent mode" value={agentMode === 'GEMINI' ? 'Gemini' : 'Policy'} detail={agentMode === 'GEMINI' ? 'Language layer active' : 'Deterministic text'} tone="amber" />
      </div>

      {/* Agent endpoints */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-ivory">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-forest">Agent-accessible endpoints</h2>
            <p className="text-[0.68rem] text-forest/55">External AI buyers use these to discover your catalog</p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {[
            { label: 'Store metadata', path: apiEndpoints.store, method: 'GET' },
            { label: 'Product catalog', path: apiEndpoints.products, method: 'GET' },
            { label: 'MCP endpoint', path: apiEndpoints.mcp, method: 'POST' },
          ].map((ep) => (
            <div
              key={ep.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-forest/10 bg-pale/30 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-forest">{ep.label}</p>
                <p className="mt-0.5 truncate font-mono text-[0.68rem] text-forest/55">
                  <span className="font-semibold text-teal-deep">{ep.method}</span> {ep.path}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${origin}${ep.path}`, ep.label)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-forest/10 bg-white text-forest/50 transition-colors hover:bg-pale hover:text-forest"
                aria-label={`Copy ${ep.label} URL`}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 text-[0.68rem] text-forest/50">
          <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Public endpoints never expose floor prices or confidential seller rules.</span>
        </div>
      </Card>

      {/* Store info */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-forest/10 bg-pale/35 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-forest">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-forest">{store.businessName}</h3>
              <p className="mt-0.5 text-xs text-forest/55">
                {store.country} · {store.currency} · {total} products
              </p>
            </div>
          </div>
          {store.description && (
            <p className="mt-3 text-sm leading-relaxed text-forest/65">{store.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 border-b border-forest/10 bg-[#eef7f7] px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-teal-deep">
            <Bot className="h-3.5 w-3.5" />
            <span className="font-semibold">Agent-readable</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-forest/55">
            <Globe2 className="h-3.5 w-3.5" />
            <span>Published</span>
          </div>
          <AgentModeBadge mode={agentMode} />
        </div>
      </Card>

      {/* Product grid */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-forest">Published products</h2>
          <Link to="/seller/products" className="text-xs font-semibold text-teal-deep hover:underline">
            Manage catalog
          </Link>
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={<Store className="h-5 w-5" />}
            title="No published products"
            description="Add products to your catalog and mark them active to make them visible to AI buyers."
            action={
              <Link to="/seller/products" className="btn btn-secondary btn-sm">
                Go to products
              </Link>
            }
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/stores/${slug}/${product.id}`}
                target="_blank"
                rel="noopener"
                className="group"
              >
                <Card className="card-hover overflow-hidden p-0">
                  <ProductArt
                    name={product.name}
                    category={product.category}
                    images={product.images}
                    className="h-36 rounded-none"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-forest group-hover:text-teal-deep">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-forest/55">{product.category}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-forest">
                        {formatMoney(product.listedPrice, product.currency)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {product.stock > 0 ? (
                        <Badge tone="sage">{product.stock} in stock</Badge>
                      ) : (
                        <Badge tone="amber">Out of stock</Badge>
                      )}
                      {product.negotiation?.negotiable && (
                        <span className="text-[0.65rem] text-forest/45">
                          Negotiable · min {product.negotiation.minimumQuantity}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* JSON preview */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-forest">Agent JSON preview</h3>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                JSON.stringify(
                  {
                    store: {
                      slug: store.storeSlug,
                      businessName: store.businessName,
                      country: store.country,
                      currency: store.currency,
                      productCount: total,
                    },
                    products: products.slice(0, 2).map((p) => ({
                      id: p.id,
                      name: p.name,
                      listedPrice: p.listedPrice,
                      currency: p.currency,
                      stock: p.stock,
                    })),
                  },
                  null,
                  2,
                ),
                'JSON preview',
              )
            }
            className="btn btn-ghost btn-sm"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-forest/10 bg-[#0f2c2d] p-4 font-mono text-xs leading-relaxed text-ivory/80">
          {JSON.stringify(
            {
              store: {
                slug: store.storeSlug,
                businessName: store.businessName,
                country: store.country,
                currency: store.currency,
                productCount: total,
              },
              endpoints: {
                api: `${origin}${apiEndpoints.store}`,
                products: `${origin}${apiEndpoints.products}`,
                mcp: `${origin}${apiEndpoints.mcp}`,
              },
              note: 'Confidential floor prices and seller rules are never returned by public endpoints.',
            },
            null,
            2,
          )}
        </pre>
      </Card>
    </div>
  );
}

