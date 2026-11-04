import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Circle, Globe2, Save, Store } from 'lucide-react';
import { COUNTRIES } from '@bhavai/shared';
import { Badge, Button, Card, Field, InlineNotice, PageHeader, Spinner } from '../../components/ui';
import { ErrorNotice } from '../../components/Feedback';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { OnboardingView } from '../../lib/types';

export function SellerOnboarding() {
  useDocumentTitle('Storefront setup');
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const onboarding = useAsync<OnboardingView>(() => api.get('/api/seller/onboarding'));
  const [form, setForm] = useState({ businessName: '', description: '', country: 'IN', storeSlug: '' });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me?.seller) {
      setForm({
        businessName: me.seller.businessName,
        description: me.seller.description,
        country: me.seller.country,
        storeSlug: me.seller.storeSlug,
      });
    }
  }, [me?.seller]);

  const profile = me?.seller;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch('/api/seller/profile', {
        businessName: form.businessName,
        description: form.description,
        country: form.country,
        storeSlug: form.storeSlug,
      });
      await refresh();
      onboarding.reload();
      toast('Business profile saved.', 'success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await api.post('/api/seller/publish');
      await refresh();
      onboarding.reload();
      toast('Storefront published. It is now agent-readable.', 'success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await api.post('/api/seller/unpublish');
      await refresh();
      onboarding.reload();
      toast('Storefront unpublished. Public endpoints now return 404 for it.', 'info');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPublishing(false);
    }
  };

  if (onboarding.loading) return <Spinner label="Loading setup checklist" />;
  if (onboarding.error) return <ErrorNotice error={onboarding.error} onRetry={onboarding.reload} />;
  if (!onboarding.data || !profile) return null;

  const data = onboarding.data;
  const complete = data.steps.filter((step) => step.complete).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Storefront setup"
        title="Prepare your agent-readable storefront"
        description="A storefront publishes only when the profile, catalog and confidential rules are ready. You can unpublish at any time."
        actions={
          data.published ? (
            <>
              <Link to={`/stores/${profile.storeSlug}`} className="btn btn-secondary btn-sm">
                View public storefront
              </Link>
              <Button size="sm" variant="quiet-danger" loading={publishing} onClick={() => void unpublish()}>
                Unpublish
              </Button>
            </>
          ) : (
            <Button size="sm" loading={publishing} onClick={() => void publish()}>
              <Globe2 className="h-3.5 w-3.5" /> Publish storefront
            </Button>
          )
        }
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-forest">Business profile</h2>
              <p className="mt-0.5 text-xs text-forest/55">This is what buyers and agents read first.</p>
            </div>
            <Badge tone={data.published ? 'teal' : 'sage'}>{data.published ? 'Published' : 'Draft'}</Badge>
          </div>

          <form onSubmit={(event) => void save(event)} className="mt-4 space-y-4">
            <Field label="Business name" htmlFor="business-name">
              <input
                id="business-name"
                className="field"
                value={form.businessName}
                onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                required
                minLength={2}
              />
            </Field>
            <Field
              label="Store description"
              htmlFor="description"
              hint="At least 10 characters. Describe the craft, materials and what buyers can expect."
            >
              <textarea
                id="description"
                className="field min-h-[110px] resize-y"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                required
                maxLength={1200}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" htmlFor="country" hint="Payment routing uses this country.">
                <select
                  id="country"
                  className="field"
                  value={form.country}
                  onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Store URL" htmlFor="slug" hint={`Public path: /stores/${form.storeSlug || 'your-store'}`}>
                <input
                  id="slug"
                  className="field"
                  value={form.storeSlug}
                  onChange={(event) => setForm((current) => ({ ...current, storeSlug: event.target.value.toLowerCase() }))}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={48}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={saving}>
                <Save className="h-3.5 w-3.5" /> Save profile
              </Button>
              <p className="text-[0.68rem] text-forest/45">Currency: {profile.currency} · changing currency is blocked once products exist.</p>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-forest">Setup checklist</h2>
              <Badge tone={complete === data.steps.length ? 'forest' : 'sage'}>{complete}/{data.steps.length}</Badge>
            </div>
            <ol className="mt-4 space-y-3">
              {data.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      step.complete ? 'bg-teal-deep text-white' : 'border border-forest/20 text-forest/30'
                    }`}
                  >
                    {step.complete ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                  </span>
                  <div>
                    <p className={`text-xs font-semibold ${step.complete ? 'text-forest' : 'text-forest/70'}`}>{step.label}</p>
                    <p className="text-[0.68rem] leading-relaxed text-forest/50">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-forest">Next steps</h2>
            <div className="mt-3 space-y-2">
              <Link to="/seller/products" className="flex items-center justify-between rounded-lg border border-forest/10 px-3 py-2.5 text-xs font-medium text-forest hover:bg-pale/50">
                <span className="inline-flex items-center gap-2">
                  <Store className="h-3.5 w-3.5" /> Add products ({data.counts.products})
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/seller/rules" className="flex items-center justify-between rounded-lg border border-forest/10 px-3 py-2.5 text-xs font-medium text-forest hover:bg-pale/50">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" /> Review pricing rules
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {!data.published && (
              <InlineNotice tone="info">
                Publishing checks the server-side requirements. If something is missing, the API returns a specific message instead
                of publishing an incomplete storefront.
              </InlineNotice>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
