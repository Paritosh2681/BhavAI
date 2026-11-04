import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, LockKeyhole, Plus, Save, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { formatMoney, minimumAllowedPrice, targetPrice } from '@bhavai/shared';
import { Badge, Button, Card, EmptyState, Field, InlineNotice, PageHeader, Spinner } from '../../components/ui';
import { ErrorNotice } from '../../components/Feedback';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api, errorMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import type { RuleListRow, RulePreview } from '../../lib/types';

type Form = {
  floorPrice: string;
  maxDiscountPercent: string;
  minimumQuantity: string;
  maxRounds: string;
  autoAcceptThreshold: string;
  requireApprovalBelow: string;
  approvalRequired: boolean;
  bulkDiscounts: Array<{ minimumQuantity: string; discountPercent: string }>;
};

function formFromRow(row: RuleListRow | null): Form {
  if (!row) {
    return {
      floorPrice: '',
      maxDiscountPercent: '15',
      minimumQuantity: '1',
      maxRounds: '5',
      autoAcceptThreshold: '',
      requireApprovalBelow: '',
      approvalRequired: false,
      bulkDiscounts: [],
    };
  }
  return {
    floorPrice: String(row.rules.floorPrice),
    maxDiscountPercent: String(row.rules.maxDiscountPercent),
    minimumQuantity: String(row.rules.minimumQuantity),
    maxRounds: String(row.rules.maxRounds),
    autoAcceptThreshold: row.rules.autoAcceptThreshold === null ? '' : String(row.rules.autoAcceptThreshold),
    requireApprovalBelow: row.rules.requireApprovalBelow === null ? '' : String(row.rules.requireApprovalBelow),
    approvalRequired: row.rules.approvalRequired,
    bulkDiscounts: row.rules.bulkDiscounts.map((tier) => ({
      minimumQuantity: String(tier.minimumQuantity),
      discountPercent: String(tier.discountPercent),
    })),
  };
}

export function SellerRules() {
  useDocumentTitle('Pricing rules');
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const rules = useAsync<{ rules: RuleListRow[]; currency: string }>(() => api.get('/api/rules'));
  const rows = rules.data?.rules ?? [];
  const currency = rules.data?.currency ?? 'USD';

  const [selectedId, setSelectedId] = useState(params.get('product') ?? '');
  const [form, setForm] = useState<Form>(formFromRow(null));
  const [preview, setPreview] = useState<RulePreview | null>(null);
  const [samplePrice, setSamplePrice] = useState('');
  const [sampleQuantity, setSampleQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].product.id);
  }, [rows, selectedId]);

  const selected = useMemo(() => rows.find((row) => row.product.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    setForm(formFromRow(selected));
    setPreview(null);
    setSamplePrice('');
    setSampleQuantity('');
    if (selected) {
      setParams({ product: selected.product.id }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.rules.updatedAt]);

  const localMinimum = useMemo(() => {
    if (!selected) return 0;
    return minimumAllowedPrice({
      listedPrice: selected.product.listedPrice,
      floorPrice: Number(form.floorPrice || 0),
      maxDiscountPercent: Number(form.maxDiscountPercent || 0),
    });
  }, [selected, form.floorPrice, form.maxDiscountPercent]);

  const localTarget = useMemo(() => {
    if (!selected) return 0;
    return targetPrice(
      {
        listedPrice: selected.product.listedPrice,
        floorPrice: Number(form.floorPrice || 0),
        maxDiscountPercent: Number(form.maxDiscountPercent || 0),
        minimumQuantity: Number(form.minimumQuantity || 1),
        bulkDiscounts: form.bulkDiscounts
          .map((tier) => ({ minimumQuantity: Number(tier.minimumQuantity || 0), discountPercent: Number(tier.discountPercent || 0) }))
          .filter((tier) => tier.minimumQuantity > 0),
        maxRounds: Number(form.maxRounds || 5),
        autoAcceptThreshold: form.autoAcceptThreshold ? Number(form.autoAcceptThreshold) : null,
        requireApprovalBelow: form.requireApprovalBelow ? Number(form.requireApprovalBelow) : null,
      },
      Number(form.minimumQuantity || 1),
    );
  }, [selected, form]);

  const payload = () => ({
    floorPrice: Number(form.floorPrice),
    maxDiscountPercent: Number(form.maxDiscountPercent),
    minimumQuantity: Number(form.minimumQuantity),
    maxRounds: Number(form.maxRounds),
    autoAcceptThreshold: form.autoAcceptThreshold ? Number(form.autoAcceptThreshold) : null,
    requireApprovalBelow: form.requireApprovalBelow ? Number(form.requireApprovalBelow) : null,
    approvalRequired: form.approvalRequired,
    bulkDiscounts: form.bulkDiscounts
      .map((tier) => ({ minimumQuantity: Number(tier.minimumQuantity), discountPercent: Number(tier.discountPercent) }))
      .filter((tier) => Number.isFinite(tier.minimumQuantity) && Number.isFinite(tier.discountPercent)),
  });

  const validate = async () => {
    if (!selected) return;
    setPreviewing(true);
    setError(null);
    try {
      const result = await api.post<RulePreview>('/api/rules/validate', {
        rules: payload(),
        listedPrice: selected.product.listedPrice,
        sampleUnitPrice: samplePrice ? Number(samplePrice) : undefined,
        sampleQuantity: sampleQuantity ? Number(sampleQuantity) : undefined,
      });
      setPreview(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPreviewing(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/rules/${selected.product.id}`, payload());
      toast('Pricing rules saved and marked as reviewed.', 'success');
      rules.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (rules.loading) return <Spinner label="Loading pricing rules" />;
  if (rules.error) return <ErrorNotice error={rules.error} onRetry={rules.reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Confidential policy"
        title="Pricing rules"
        description="These values are seller-only. The pricing engine revalidates every offer, acceptance and payment against them."
        actions={
          selected ? (
            <Button size="sm" variant="secondary" loading={previewing} onClick={() => void validate()}>
              <Sparkles className="h-3.5 w-3.5" /> Simulate
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      {!rules.data || rows.length === 0 ? (
        <EmptyState
          icon={<LockKeyhole className="h-5 w-5" />}
          title="No product rules yet"
          description="Add a product to create conservative default rules, then review them here before publishing."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr] lg:items-start">
          <Card className="p-2">
            <p className="px-2 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/45">Your catalog</p>
            <div className="space-y-1">
              {rows.map((row) => (
                <button
                  key={row.product.id}
                  type="button"
                  onClick={() => setSelectedId(row.product.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    selectedId === row.product.id ? 'bg-forest text-ivory' : 'hover:bg-pale/60'
                  }`}
                >
                  <span className="block truncate text-xs font-semibold">{row.product.name}</span>
                  <span className={`mt-0.5 block text-[0.65rem] ${selectedId === row.product.id ? 'text-ivory/60' : 'text-forest/45'}`}>
                    {formatMoney(row.product.listedPrice, row.product.currency)} · min {row.rules.minimumQuantity}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {selected && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 border-b border-forest/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/45">{selected.product.sku}</p>
                  <h2 className="mt-1 text-lg font-semibold text-forest">{selected.product.name}</h2>
                  <p className="mt-0.5 text-xs text-forest/55">
                    Listed {formatMoney(selected.product.listedPrice, currency)} · {selected.product.stock} in stock
                  </p>
                </div>
                <Badge tone="amber">
                  <LockKeyhole className="h-3 w-3" aria-hidden /> Seller only
                </Badge>
              </div>

              <form onSubmit={(event) => void save(event)} className="mt-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Confidential floor (${currency})`} htmlFor="floor" hint="The absolute lowest unit price you will accept.">
                    <input
                      id="floor"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="field"
                      value={form.floorPrice}
                      onChange={(event) => setForm((current) => ({ ...current, floorPrice: event.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Maximum discount (%)" htmlFor="max-discount" hint="Caps discount from the listed price.">
                    <input
                      id="max-discount"
                      type="number"
                      step="0.1"
                      min="0"
                      max="90"
                      className="field"
                      value={form.maxDiscountPercent}
                      onChange={(event) => setForm((current) => ({ ...current, maxDiscountPercent: event.target.value }))}
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-3 rounded-xl bg-pale/60 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Minimum allowed</p>
                    <p className="mt-1 text-sm font-semibold text-forest">{formatMoney(localMinimum, currency)}</p>
                    <p className="mt-0.5 text-[0.62rem] text-forest/45">max(floor, listed − discount)</p>
                  </div>
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Target at min qty</p>
                    <p className="mt-1 text-sm font-semibold text-forest">{formatMoney(localTarget, currency)}</p>
                    <p className="mt-0.5 text-[0.62rem] text-forest/45">After applicable bulk tier</p>
                  </div>
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Maximum discount</p>
                    <p className="mt-1 text-sm font-semibold text-forest">{(selected.product.listedPrice - localMinimum).toFixed(2)}</p>
                    <p className="mt-0.5 text-[0.62rem] text-forest/45">Absolute headroom</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Minimum quantity" htmlFor="min-quantity">
                    <input
                      id="min-quantity"
                      type="number"
                      min="1"
                      step="1"
                      className="field"
                      value={form.minimumQuantity}
                      onChange={(event) => setForm((current) => ({ ...current, minimumQuantity: event.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Maximum rounds" htmlFor="max-rounds" hint="1–12">
                    <input
                      id="max-rounds"
                      type="number"
                      min="1"
                      max="12"
                      step="1"
                      className="field"
                      value={form.maxRounds}
                      onChange={(event) => setForm((current) => ({ ...current, maxRounds: event.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Approval gate" htmlFor="approval-required" hint="Pause deals for review.">
                    <select
                      id="approval-required"
                      className="field"
                      value={form.approvalRequired ? 'true' : 'false'}
                      onChange={(event) => setForm((current) => ({ ...current, approvalRequired: event.target.value === 'true' }))}
                    >
                      <option value="false">No manual approval</option>
                      <option value="true">Seller approves every deal</option>
                    </select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Auto-accept at or above (${currency})`} htmlFor="auto-accept" hint="Optional. Must be within authorised range.">
                    <input
                      id="auto-accept"
                      type="number"
                      step="0.01"
                      className="field"
                      value={form.autoAcceptThreshold}
                      onChange={(event) => setForm((current) => ({ ...current, autoAcceptThreshold: event.target.value }))}
                      placeholder="Leave blank to always counter"
                    />
                  </Field>
                  <Field label={`Require approval below (${currency})`} htmlFor="approval-below" hint="Optional. Deals below this pause for review.">
                    <input
                      id="approval-below"
                      type="number"
                      step="0.01"
                      className="field"
                      value={form.requireApprovalBelow}
                      onChange={(event) => setForm((current) => ({ ...current, requireApprovalBelow: event.target.value }))}
                      placeholder="Leave blank to use the global gate"
                    />
                  </Field>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="label mb-0">Bulk tiers</p>
                      <p className="hint">Published to buyers. Each tier must be at or below the maximum discount.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setForm((current) => ({ ...current, bulkDiscounts: [...current.bulkDiscounts, { minimumQuantity: '', discountPercent: '' }] }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Add tier
                    </Button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.bulkDiscounts.map((tier, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border border-forest/10 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                        <label className="flex items-center gap-2 text-[0.68rem] text-forest/60">
                          <span className="w-20 shrink-0">From qty</span>
                          <input
                            type="number"
                            min="2"
                            step="1"
                            className="field min-h-0 py-1.5"
                            value={tier.minimumQuantity}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                bulkDiscounts: current.bulkDiscounts.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, minimumQuantity: event.target.value } : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2 text-[0.68rem] text-forest/60">
                          <span className="w-20 shrink-0">Discount %</span>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            step="0.1"
                            className="field min-h-0 py-1.5"
                            value={tier.discountPercent}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                bulkDiscounts: current.bulkDiscounts.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, discountPercent: event.target.value } : item,
                                ),
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({ ...current, bulkDiscounts: current.bulkDiscounts.filter((_, itemIndex) => itemIndex !== index) }))
                          }
                          className="justify-self-start rounded-lg p-2 text-forest/45 hover:bg-pale hover:text-[#8a5a22]"
                          aria-label="Remove bulk tier"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {form.bulkDiscounts.length === 0 && <p className="text-[0.68rem] text-forest/45">No bulk tiers. Add one if quantity should lower the target price.</p>}
                  </div>
                </div>

                <InlineNotice tone="warning" title="Confidential data">
                  Never paste floor prices or these rule values into buyer-facing copy, MCP responses or analytics narratives. Only
                  minimum quantity, round limit and bulk tiers are public.
                </InlineNotice>

                <div className="flex flex-wrap items-center gap-2 border-t border-forest/10 pt-4">
                  <Button type="submit" loading={saving}>
                    <Save className="h-3.5 w-3.5" /> Save rules
                  </Button>
                  <Button type="button" variant="ghost" loading={previewing} onClick={() => void validate()}>
                    Simulate a price
                  </Button>
                </div>
              </form>

              <div className="mt-5 border-t border-forest/10 pt-5">
                <h3 className="text-sm font-semibold text-forest">Policy simulator</h3>
                <p className="mt-0.5 text-xs text-forest/55">Uses the same pure functions as the backend. Nothing is written.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Field label={`Sample unit price (${currency})`} htmlFor="sample-price">
                    <input
                      id="sample-price"
                      type="number"
                      step="0.01"
                      className="field"
                      value={samplePrice}
                      onChange={(event) => setSamplePrice(event.target.value)}
                      placeholder={String(localMinimum)}
                    />
                  </Field>
                  <Field label="Sample quantity" htmlFor="sample-quantity">
                    <input
                      id="sample-quantity"
                      type="number"
                      min="1"
                      className="field"
                      value={sampleQuantity}
                      onChange={(event) => setSampleQuantity(event.target.value)}
                      placeholder={form.minimumQuantity || '1'}
                    />
                  </Field>
                  <Button type="button" variant="secondary" loading={previewing} onClick={() => void validate()}>
                    Run
                  </Button>
                </div>
                {preview && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="mint">Minimum allowed {formatMoney(preview.minimumAllowed, currency)}</Badge>
                      <Badge tone="sage">Target {formatMoney(preview.target, currency)}</Badge>
                      {preview.sample && (
                        <Badge tone={preview.sample.valid ? 'teal' : 'amber'}>
                          {preview.sample.valid ? 'Offer accepted by rules' : preview.sample.message}
                        </Badge>
                      )}
                    </div>
                    {preview.sample && (
                      <p className="flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-forest/60">
                        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-teal-deep" aria-hidden />
                        {preview.sample.message}
                      </p>
                    )}
                    <p className="flex items-start gap-1.5 text-[0.65rem] text-forest/45">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {preview.note}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
