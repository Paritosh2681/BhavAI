import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { COUNTRIES } from '@bhavai/shared';
import { LogoMark } from '../components/Logo';
import { Button, Field, InlineNotice } from '../components/ui';
import { errorMessage, fieldErrors } from '../lib/api';
import { homeFor, useAuth } from '../context/AuthContext';

function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-forest p-10 text-ivory lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-30 grid-fade" aria-hidden />
        <Link to="/" className="relative inline-flex items-center gap-2.5 text-ivory">
          <LogoMark />
          <span className="text-lg font-semibold tracking-tight">BhavAI</span>
        </Link>
        <div className="relative max-w-md">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-sage">Policy before prose</p>
          <h2 className="serif mt-4 text-[2.7rem] leading-[1.05] text-ivory">
            A storefront that can explain its prices.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ivory/70">
            BhavAI lets AI buyers discover your catalog, negotiate inside rules you set, and pay through the right rail for
            the market — PayPal Sandbox across borders, honest manual settlement inside India.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ivory/75">
            {[
              'Deterministic pricing engine owns every accept and counter',
              'MCP tools expose the same authority to external agents',
              'Floor prices never cross into buyer-facing responses',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative rounded-xl border border-ivory/15 bg-ivory/[0.06] p-4">
          <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sage">
            <ShieldCheck className="h-3.5 w-3.5" /> Honest by construction
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ivory/65">
            No simulated payment successes. If PayPal is not configured, the API returns a clear 503 instead of pretending.
          </p>
        </div>
      </aside>

      <main id="main" className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-forest/60 hover:text-forest lg:hidden">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to BhavAI
          </Link>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] text-forest">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-forest/65">{description}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-sm text-forest/65">{footer}</div>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const me = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : homeFor(me), { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const fill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('BhavAI!2026');
    setError('');
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      description="Sellers manage catalogs, rules and settlement. Buyers negotiate and pay from one place."
      footer={
        <p>
          New to BhavAI?{' '}
          <Link to="/signup" className="font-semibold text-teal-deep hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <InlineNotice tone="warning">{error}</InlineNotice>}
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@business.com"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            required
          />
        </Field>
        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-xs font-medium text-teal-deep hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Sign in <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </form>

      <div className="mt-7 rounded-xl border border-forest/10 bg-pale/60 p-3.5">
        <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-forest/55">
          <Sparkles className="h-3 w-3" /> Demo accounts · sample data
        </p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {[
            { label: 'Seller · USD', email: 'seller@bhavai.demo' },
            { label: 'Seller · INR', email: 'meera@bhavai.demo' },
            { label: 'Buyer · US', email: 'alex@bhavai.demo' },
            { label: 'Buyer · IN', email: 'priya@bhavai.demo' },
          ].map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fill(account.email)}
              className="rounded-lg border border-forest/10 bg-white px-2.5 py-2 text-left text-[0.7rem] transition-colors hover:border-teal/40 hover:bg-ivory"
            >
              <span className="block font-semibold text-forest">{account.label}</span>
              <span className="text-forest/55">{account.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.65rem] leading-relaxed text-forest/45">
          Shared demo password: <code className="rounded bg-white px-1 py-0.5">BhavAI!2026</code>. Every seeded row is marked
          “Sample”.
        </p>
      </div>
    </AuthShell>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: params.get('role') === 'seller' ? 'SELLER' : 'BUYER',
    country: 'IN',
  });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setErrors({});
    setLoading(true);
    try {
      const me = await signup({
        ...form,
        role: form.role as 'SELLER' | 'BUYER',
      });
      navigate(me.user.role === 'SELLER' ? '/seller/onboarding' : '/buyer/discover', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
      setErrors(fieldErrors(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create an account"
      title="Open your BhavAI workspace"
      description="Set up a seller storefront or a buyer account. You can explore the marketplace before publishing."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-deep hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <InlineNotice tone="warning">{error}</InlineNotice>}

        <fieldset>
          <legend className="label">I am joining as</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'SELLER', title: 'A seller', detail: 'Publish a storefront and set pricing rules' },
              { value: 'BUYER', title: 'A buyer', detail: 'Negotiate with AI agents and place orders' },
            ].map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                  form.role === option.value ? 'border-teal-deep bg-[#eef7f7]' : 'border-forest/15 bg-white hover:border-forest/30'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={form.role === option.value}
                  onChange={() => set('role', option.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-forest">{option.title}</span>
                <span className="mt-0.5 block text-[0.68rem] leading-snug text-forest/55">{option.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={form.role === 'SELLER' ? 'Business name' : 'Your name'} htmlFor="name" error={errors.name}>
          <input
            id="name"
            className="field"
            autoComplete="name"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder={form.role === 'SELLER' ? 'Aaranya Crafts' : 'Alex Rivera'}
            required
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="field"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
            placeholder="you@business.com"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" hint="At least 8 characters" error={errors.password}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="field"
              value={form.password}
              onChange={(event) => set('password', event.target.value)}
              required
            />
          </Field>
          <Field label="Country" htmlFor="country" error={errors.country}>
            <select id="country" className="field" value={form.country} onChange={(event) => set('country', event.target.value)}>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Create account <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <p className="text-[0.68rem] leading-relaxed text-forest/45">
          By creating an account you agree that this is a hackathon reference build. Do not use production credentials or
          real customer data.
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ message: string; devResetUrl: string | null } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).then(async (response) => {
        const json = (await response.json()) as { data?: { message: string; devResetUrl: string | null }; error?: { message: string } };
        if (!response.ok) throw new Error(json.error?.message ?? 'Could not request a reset link.');
        return json.data!;
      });
      setSent(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Request a reset link"
      description="No email provider is configured in this build. In development the API returns a direct reset link below."
      footer={
        <p>
          <Link to="/login" className="font-semibold text-teal-deep hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <InlineNotice tone="success">{sent.message}</InlineNotice>
          {sent.devResetUrl ? (
            <div className="rounded-xl border border-[#d99a55]/40 bg-[#fbf3e8] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#6b3a12]">
                <KeyRound className="h-3.5 w-3.5" /> Development-only reset link
              </p>
              <Link to={sent.devResetUrl.replace(/^https?:\/\/[^/]+/, '')} className="mt-2 break-all text-xs font-medium text-teal-deep underline">
                Open reset link
              </Link>
            </div>
          ) : (
            <p className="text-sm text-forest/60">
              A reset link was created if the account exists. Delivery is not configured, so no email was sent.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <InlineNotice tone="warning">{error}</InlineNotice>}
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              className="field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@business.com"
              required
            />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Request reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = params.get('token') ?? '';
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(json.error?.message ?? 'Could not reset the password.');
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1600);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Choose a new password"
      title="Reset your password"
      description="Use at least 8 characters. Existing sessions stay valid until they expire."
      footer={
        <p>
          <Link to="/login" className="font-semibold text-teal-deep hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {done ? (
        <InlineNotice tone="success">Password updated. Taking you to sign in…</InlineNotice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <InlineNotice tone="warning">{error}</InlineNotice>}
          <Field label="New password" htmlFor="password" hint="At least 8 characters">
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
