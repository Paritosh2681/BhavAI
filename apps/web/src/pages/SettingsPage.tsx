import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  KeyRound,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { COUNTRIES, CURRENCIES } from '@bhavai/shared';
import { Badge, Button, Card, Field, InlineNotice, PageHeader } from '../components/ui';
import { ErrorNotice, FieldRow } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { useDocumentTitle } from '../lib/useAsync';
import { dateTime } from '../lib/format';

export function SettingsPage() {
  useDocumentTitle('Settings');
  const { me, loading, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  const [sellerForm, setSellerForm] = useState({
    businessName: '',
    description: '',
    country: 'IN',
    currency: 'INR',
    storeSlug: '',
  });
  const [buyerForm, setBuyerForm] = useState({
    companyName: '',
    country: 'US',
    currency: 'USD',
    preferences: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!me) return;
    setName(me.user.name);
    if (me.seller) {
      setSellerForm({
        businessName: me.seller.businessName,
        description: me.seller.description,
        country: me.seller.country,
        currency: me.seller.currency,
        storeSlug: me.seller.storeSlug,
      });
    }
    if (me.buyer) {
      setBuyerForm({
        companyName: me.buyer.companyName,
        country: me.buyer.country,
        currency: me.buyer.currency,
        preferences: me.buyer.preferences,
      });
    }
  }, [me]);

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingAccount(true);
    setError(null);
    try {
      await api.post('/api/auth/profile', { name });
      await refresh();
      toast('Account name updated.', 'success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingAccount(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      if (me?.seller) {
        await api.patch('/api/seller/profile', sellerForm);
      } else {
        await api.put('/api/buyer/profile', buyerForm);
      }
      await refresh();
      toast('Commerce profile saved. Payment routing uses the saved country.', 'success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingProfile(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-forest/[0.05]" aria-hidden />;
  if (!me) return null;

  const isSeller = me.user.role === 'SELLER' || me.user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage the identity behind your storefront or buying desk, and the commerce fields that decide market routing."
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pale text-teal-deep">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-forest">Account</h2>
                  <p className="text-xs text-forest/55">Your sign-in identity.</p>
                </div>
              </div>
              <Badge tone="sage">{me.user.role}</Badge>
            </div>

            <form onSubmit={(event) => void saveAccount(event)} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="account-name">
                  <input
                    id="account-name"
                    className="field"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </Field>
                <Field label="Email" htmlFor="account-email" hint="Email changes are not exposed in this build.">
                  <input id="account-email" className="field" value={me.user.email} readOnly aria-readonly />
                </Field>
              </div>
              <Button type="submit" loading={savingAccount}>
                <Save className="h-3.5 w-3.5" /> Save account
              </Button>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pale text-forest">
                  {isSeller ? <Building2 className="h-4 w-4" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-forest">{isSeller ? 'Seller profile' : 'Buyer profile'}</h2>
                  <p className="text-xs text-forest/55">
                    {isSeller
                      ? 'What buyers and agents read about your store.'
                      : 'Preferences the buyer agent reads before a negotiation.'}
                  </p>
                </div>
              </div>
            </div>

            {isSeller ? (
              <form onSubmit={(event) => void saveProfile(event)} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Business name" htmlFor="settings-business">
                    <input
                      id="settings-business"
                      className="field"
                      value={sellerForm.businessName}
                      onChange={(event) => setSellerForm((current) => ({ ...current, businessName: event.target.value }))}
                      required
                      minLength={2}
                    />
                  </Field>
                  <Field label="Store URL" htmlFor="settings-slug" hint={`/stores/${sellerForm.storeSlug || 'your-store'}`}>
                    <input
                      id="settings-slug"
                      className="field"
                      value={sellerForm.storeSlug}
                      onChange={(event) =>
                        setSellerForm((current) => ({ ...current, storeSlug: event.target.value.toLowerCase() }))
                      }
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      minLength={3}
                      maxLength={48}
                    />
                  </Field>
                </div>
                <Field label="Description" htmlFor="settings-description" hint="At least 10 characters before publishing.">
                  <textarea
                    id="settings-description"
                    className="field min-h-[100px] resize-y"
                    value={sellerForm.description}
                    onChange={(event) => setSellerForm((current) => ({ ...current, description: event.target.value }))}
                    maxLength={1200}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Country" htmlFor="settings-seller-country" hint="Decides domestic vs cross-border routing.">
                    <select
                      id="settings-seller-country"
                      className="field"
                      value={sellerForm.country}
                      onChange={(event) => setSellerForm((current) => ({ ...current, country: event.target.value }))}
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Store currency"
                    htmlFor="settings-seller-currency"
                    hint="Locked once products exist. BhavAI does not convert currencies."
                  >
                    <select
                      id="settings-seller-currency"
                      className="field"
                      value={sellerForm.currency}
                      onChange={(event) => setSellerForm((current) => ({ ...current, currency: event.target.value }))}
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <InlineNotice tone="warning" title="Changing the store URL">
                  A new URL replaces the old public path. Existing links will no longer resolve. The server checks uniqueness before
                  saving.
                </InlineNotice>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" loading={savingProfile}>
                    <Save className="h-3.5 w-3.5" /> Save seller profile
                  </Button>
                  <Link to="/seller/onboarding" className="btn btn-secondary btn-sm">
                    Setup checklist
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={(event) => void saveProfile(event)} className="mt-5 space-y-4">
                <Field label="Company or buying desk" htmlFor="settings-company">
                  <input
                    id="settings-company"
                    className="field"
                    value={buyerForm.companyName}
                    onChange={(event) => setBuyerForm((current) => ({ ...current, companyName: event.target.value }))}
                    maxLength={100}
                    placeholder="Rivera Import Co."
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Country" htmlFor="settings-buyer-country" hint="Decides domestic vs cross-border routing.">
                    <select
                      id="settings-buyer-country"
                      className="field"
                      value={buyerForm.country}
                      onChange={(event) => setBuyerForm((current) => ({ ...current, country: event.target.value }))}
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Preferred currency" htmlFor="settings-buyer-currency" hint="Searches are limited to one currency.">
                    <select
                      id="settings-buyer-currency"
                      className="field"
                      value={buyerForm.currency}
                      onChange={(event) => setBuyerForm((current) => ({ ...current, currency: event.target.value }))}
                    >
                      {CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field
                  label="Buying preferences"
                  htmlFor="settings-preferences"
                  hint="Optional context for your agent: materials, lead time, repeat-order intent."
                >
                  <textarea
                    id="settings-preferences"
                    className="field min-h-[100px] resize-y"
                    value={buyerForm.preferences}
                    onChange={(event) => setBuyerForm((current) => ({ ...current, preferences: event.target.value }))}
                    maxLength={600}
                    placeholder="Prefer handcrafted suppliers. Lead time under six weeks."
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" loading={savingProfile}>
                    <Save className="h-3.5 w-3.5" /> Save buyer profile
                  </Button>
                  <Link to="/buyer/discover" className="btn btn-secondary btn-sm">
                    Open discover
                  </Link>
                </div>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-forest">Session</h2>
            <dl className="mt-3">
              <FieldRow label="Signed in as" value={me.user.name} />
              <FieldRow label="Email" value={me.user.email} mono />
              <FieldRow label="Role" value={me.user.role} />
              <FieldRow label="Auth source" value={me.source === 'api_key' ? 'API key' : 'Browser session'} />
              <FieldRow label="Timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'} />
              <FieldRow label="Local time" value={dateTime(new Date().toISOString())} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void signOut()}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
              <Link to="/forgot-password" className="btn btn-ghost btn-sm">
                Reset password
              </Link>
            </div>
            <p className="mt-2 text-[0.65rem] leading-relaxed text-forest/45">
              No email provider is configured. Password-reset links are generated but not delivered; the development link is
              returned on the reset request screen.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-forest">Integrations</h2>
            <div className="mt-3 space-y-2.5">
              <StatusRow label="Gemini language layer" on={me.integrations.gemini} />
              <StatusRow label="PayPal Sandbox" on={me.integrations.paypal} />
              <StatusRow label="MCP server" on={me.integrations.mcp} />
            </div>
            <div className="mt-3 border-t border-forest/10 pt-3">
              <FieldRow label="API keys" value={`${me.apiKeys} active`} />
              <FieldRow label="Database" value="Server-configured" />
            </div>
            <Link
              to={isSeller ? '/seller/developer' : '/docs#mcp'}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-deep"
            >
              {isSeller ? 'Open developer console' : 'Read the MCP guide'} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-forest">
              <ShieldCheck className="h-4 w-4 text-teal-deep" aria-hidden /> Privacy and authority
            </h2>
            <ul className="mt-2 space-y-2 text-[0.7rem] leading-relaxed text-forest/60">
              {[
                'Your confidential pricing rules never appear in buyer-facing responses, MCP buyer tools or public storefront JSON.',
                'The pricing engine, not a language model, decides every offer, acceptance and payment amount.',
                'Passwords are stored with scrypt; sessions use an httpOnly, SameSite=Lax cookie.',
                'API keys are shown once and stored only as hashes.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-deep" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Mail className="h-4 w-4 text-teal-deep" aria-hidden /> Support
            </h2>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-forest/60">
              BhavAI is a hackathon reference build. Use the seeded demo accounts and Sandbox credentials only. Open the docs for
              integration details and honest limitations.
            </p>
            <Link to="/docs#limitations" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-deep">
              Read limitations <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-forest">Developer keys</h2>
            <p className="mt-1.5 text-[0.7rem] leading-relaxed text-forest/60">
              {isSeller
                ? 'Create buyer or seller keys for MCP agents in the developer console.'
                : 'Buyer keys let an external agent open negotiations on your behalf.'}
            </p>
            <Link to={isSeller ? '/seller/developer' : '/docs#mcp'} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-deep">
              <KeyRound className="h-3.5 w-3.5" /> {isSeller ? 'Manage keys' : 'How MCP auth works'}
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-medium text-forest">{label}</p>
      <Badge tone={on ? 'teal' : 'outline'}>{on ? 'Configured' : 'Off'}</Badge>
    </div>
  );
}
