import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe2,
  Handshake,
  LockKeyhole,
  Package,
  Store,
  Truck,
} from 'lucide-react';
import { formatMoney, roundMoney } from '@bhavai/shared';
import { percent } from '../lib/format';
import { Badge, Button, Card, Field, InlineNotice } from '../components/ui';
import { ProductArt } from '../components/ProductArt';
import { ErrorNotice } from '../components/Feedback';
import { useAsync, useDocumentTitle } from '../lib/useAsync';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { NegotiationDetailView, PublicProduct } from '../lib/types';
import { countryName } from '@bhavai/shared';

export function ProductDetailPage() {
  const { slug = '', productId = '' } = useParams();
  const { me } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  useDocumentTitle('Product');

  const product = useAsync<{ product: PublicProduct }>(
    () => api.get(`/api/public/products/${encodeURIComponent(productId)}`),
    [productId],
  );
  const store = useAsync<{ products: PublicProduct[] }>(
    () => api.get(`/api/public/stores/${encodeURIComponent(slug)}/products?pageSize=6`),
    [slug],
  );

  const [form, setForm] = useState({ quantity: '', unitPrice: '', budgetTotal: '', message: '' });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = product.data?.product;

  if (product.loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-80 animate-pulse rounded-2xl bg-forest/[0.05]" />
      </div>
    );
  }

  if (product.error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Package className="mx-auto h-9 w-9 text-forest/30" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-forest">This product is not published.</h1>
        <p className="mt-2 text-sm text-forest/60">{product.error ?? 'The seller may have unpublished it.'}</p>
        <Link to={`/stores/${slug}`} className="btn btn-secondary mt-6">
          Back to storefront
        </Link>
      </div>
    );
  }

  const minimumQuantity = item.negotiation.minimumQuantity;
  const quantity = Number(form.quantity || minimumQuantity);
  const buyerCountry = me?.buyer?.country ?? null;
  const domestic = buyerCountry === 'IN' && item.seller.country === 'IN';
  const related = (store.data?.products ?? []).filter((candidate) => candidate.id !== item.id).slice(0, 3);

  const startNegotiation = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const result = await api.post<{ negotiation: NegotiationDetailView }>('/api/negotiations', {
        productId: item.id,
        quantity: Number(form.quantity || minimumQuantity),
        unitPrice: Number(form.unitPrice || roundMoney(item.listedPrice * 0.9)),
        budgetTotal: form.budgetTotal ? Number(form.budgetTotal) : null,
        message: form.message,
      });
      toast('Negotiation opened. The seller agent can respond inside their rules.', 'success');
      navigate(`/buyer/deals/${result.negotiation.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-forest/50" aria-label="Breadcrumb">
        <Link to="/stores" className="hover:text-forest">Marketplace</Link>
        <span aria-hidden>/</span>
        <Link to={`/stores/${item.seller.storeSlug}`} className="hover:text-forest">{item.seller.businessName}</Link>
        <span aria-hidden>/</span>
        <span className="text-forest/70">{item.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <ProductArt
            name={item.name}
            category={item.category}
            images={item.images}
            decorative={false}
            className="aspect-[4/3] w-full rounded-2xl border border-forest/10"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniFact icon={<Package className="h-4 w-4" />} label="Stock" value={`${item.stock} ${item.unit}${item.stock === 1 ? '' : 's'}`} />
            <MiniFact icon={<Globe2 className="h-4 w-4" />} label="Origin" value={countryName(item.countryOfOrigin)} />
            <MiniFact icon={<Truck className="h-4 w-4" />} label="Store currency" value={item.currency} />
          </div>
          <Card className="mt-4 p-5">
            <h2 className="text-sm font-semibold text-forest">About this piece</h2>
            <p className="mt-2 text-sm leading-relaxed text-forest/65">{item.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-forest/10 pt-4 text-xs">
              <div>
                <dt className="text-forest/45">SKU</dt>
                <dd className="mt-0.5 font-medium text-forest">{item.sku}</dd>
              </div>
              <div>
                <dt className="text-forest/45">Category</dt>
                <dd className="mt-0.5 font-medium text-forest">{item.category}</dd>
              </div>
              <div>
                <dt className="text-forest/45">Sold by</dt>
                <dd className="mt-0.5 font-medium text-forest">{item.seller.businessName}</dd>
              </div>
              <div>
                <dt className="text-forest/45">Seller market</dt>
                <dd className="mt-0.5 font-medium text-forest">{countryName(item.seller.country)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/stores/${item.seller.storeSlug}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-forest/55 hover:text-forest">
              <Store className="h-3.5 w-3.5" /> {item.seller.businessName}
            </Link>
            {item.negotiation.negotiable ? <Badge tone="forest">Negotiable by agents</Badge> : <Badge tone="outline">Fixed price</Badge>}
            {item.stock === 0 && <Badge tone="amber">Out of stock</Badge>}
          </div>

          <h1 className="mt-3 text-[2.2rem] font-semibold leading-tight tracking-[-0.03em] text-forest">{item.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-forest/60">{item.description.slice(0, 220)}{item.description.length > 220 ? '…' : ''}</p>

          <div className="mt-5 flex items-end gap-3">
            <p className="text-3xl font-semibold tracking-tight text-forest">{formatMoney(item.listedPrice, item.currency)}</p>
            <p className="pb-1 text-xs text-forest/45">listed per {item.unit}</p>
          </div>

          <Card className="mt-5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-forest">Public negotiation terms</p>
                <p className="mt-0.5 text-[0.7rem] text-forest/50">These facts are safe to show buyers and agents.</p>
              </div>
              <Handshake className="h-5 w-5 text-teal-deep" aria-hidden />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-pale/60 px-3 py-2">
                <p className="text-forest/45">Minimum quantity</p>
                <p className="mt-0.5 font-semibold text-forest">{minimumQuantity} units</p>
              </div>
              <div className="rounded-lg bg-pale/60 px-3 py-2">
                <p className="text-forest/45">Round limit</p>
                <p className="mt-0.5 font-semibold text-forest">{item.negotiation.maxRounds}</p>
              </div>
            </div>
            {item.negotiation.bulkTiers.length > 0 ? (
              <div className="mt-3">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-forest/45">Bulk tiers</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.negotiation.bulkTiers.map((tier) => (
                    <Badge key={tier.minimumQuantity} tone="mint">
                      {tier.minimumQuantity}+ · {percent(tier.discountPercent, 0)} off
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[0.7rem] text-forest/50">No published bulk tiers for this product.</p>
            )}
          </Card>

          {me?.user.role === 'BUYER' ? (
            <Card className="mt-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-forest">Open a negotiation</h2>
                  <p className="mt-0.5 text-xs text-forest/55">
                    Your buyer agent negotiates inside the seller&apos;s rules. Every price is revalidated on the server.
                  </p>
                </div>
                <LockKeyhole className="h-4 w-4 shrink-0 text-teal-deep" aria-hidden />
              </div>

              {item.stock === 0 ? (
                <InlineNotice tone="warning">This product is out of stock. Negotiation cannot start until the seller restocks.</InlineNotice>
              ) : (
                <form onSubmit={(event) => void startNegotiation(event)} className="mt-4 space-y-3">
                  {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Quantity" htmlFor="negotiation-quantity" hint={`Minimum ${minimumQuantity}`}>
                      <input
                        id="negotiation-quantity"
                        type="number"
                        min={minimumQuantity}
                        max={item.stock}
                        className="field"
                        placeholder={String(minimumQuantity)}
                        value={form.quantity}
                        onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                        required
                      />
                    </Field>
                    <Field label="Opening offer per unit" htmlFor="negotiation-price" hint={`Listed ${formatMoney(item.listedPrice, item.currency)}`}>
                      <input
                        id="negotiation-price"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={item.listedPrice}
                        className="field"
                        placeholder={String(roundMoney(item.listedPrice * 0.9))}
                        value={form.unitPrice}
                        onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))}
                      />
                    </Field>
                  </div>
                  <Field label="Total budget (optional)" htmlFor="negotiation-budget" hint="The agent will not cross this total.">
                    <input
                      id="negotiation-budget"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="field"
                      placeholder={String(roundMoney(item.listedPrice * quantity))}
                      value={form.budgetTotal}
                      onChange={(event) => setForm((current) => ({ ...current, budgetTotal: event.target.value }))}
                    />
                  </Field>
                  <Field label="Message to the seller (optional)" htmlFor="negotiation-message">
                    <input
                      id="negotiation-message"
                      className="field"
                      maxLength={600}
                      placeholder="We are sourcing for a Diwali collection."
                      value={form.message}
                      onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                    />
                  </Field>
                  <Button type="submit" className="w-full" loading={starting}>
                    Start negotiation <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                  <p className="text-[0.66rem] leading-relaxed text-forest/45">
                    {domestic
                      ? 'Your buyer country is India and this seller is in India: any resulting order uses manual, off-platform settlement. No PayPal charge will be attempted.'
                      : buyerCountry
                        ? 'This is a cross-border deal. Payment uses PayPal Sandbox when the deployment has credentials; otherwise the API returns a clear 503.'
                        : 'The payment rail is chosen server-side from your buyer country.'}
                  </p>
                </form>
              )}
            </Card>
          ) : me?.user.role === 'SELLER' ? (
            <InlineNotice tone="info" title="You are signed in as a seller">
              Buyer accounts open negotiations. Use the public storefront and MCP server to test agent discovery, or sign in as a
              buyer to run the negotiation flow.
            </InlineNotice>
          ) : (
            <Card className="mt-5 p-5">
              <h2 className="text-base font-semibold text-forest">Sign in to negotiate</h2>
              <p className="mt-1 text-sm leading-relaxed text-forest/60">
                BhavAI matches your buyer agent against this seller&apos;s confidential rules. Create a free buyer account or use
                the seeded demo buyer.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/login" className="btn btn-primary">
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/signup?role=buyer" className="btn btn-secondary">
                  Create buyer account
                </Link>
              </div>
              <p className="mt-3 text-[0.68rem] leading-relaxed text-forest/45">
                Demo buyer: alex@bhavai.demo · password BhavAI!2026
              </p>
            </Card>
          )}

          <div className="mt-5 space-y-2">
            {[
              'Confidential floor prices stay server-side and are never returned to buyers.',
              'Stock is reserved only when a deal is accepted, inside a row-locked transaction.',
              'The same pricing engine powers the web app, HTTP API and MCP tools.',
            ].map((line) => (
              <p key={line} className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-forest/55">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden /> {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14 border-t border-forest/10 pt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-forest">More from {item.seller.businessName}</h2>
            <Link to={`/stores/${item.seller.storeSlug}`} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-deep">
              Visit storefront <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {related.map((candidate) => (
              <Link key={candidate.id} to={`/stores/${item.seller.storeSlug}/${candidate.id}`} className="group">
                <Card className="card-hover h-full overflow-hidden p-0">
                  <ProductArt name={candidate.name} category={candidate.category} images={candidate.images} className="h-36 rounded-none" />
                  <div className="p-4">
                    <h3 className="truncate text-sm font-semibold text-forest group-hover:text-teal-deep">{candidate.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-forest">{formatMoney(candidate.listedPrice, candidate.currency)}</p>
                    <p className="mt-1 text-[0.65rem] text-forest/45">
                      {candidate.stock} in stock · min {candidate.negotiation.minimumQuantity}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <Link to={`/stores/${item.seller.storeSlug}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-forest/55 hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to storefront
        </Link>
      </div>
    </div>
  );
}

function MiniFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface flex items-center gap-3 rounded-xl p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mint/60 text-forest">{icon}</div>
      <div>
        <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">{label}</p>
        <p className="text-xs font-semibold text-forest">{value}</p>
      </div>
    </div>
  );
}
