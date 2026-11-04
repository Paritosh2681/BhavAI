import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2,
  Webhook,
  X,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, InlineNotice, Modal, PageHeader, Spinner } from '../../components/ui';
import { CodeBlock, ErrorNotice, FieldRow } from '../../components/Feedback';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api, errorMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { dateTime } from '../../lib/format';
import type {
  ApiKeyCreated,
  ApiKeyView,
  IntegrationWorkspace,
  McpToolView,
} from '../../lib/types';

type ToolCatalog = {
  tools: McpToolView[];
  endpoint: string;
  protocolVersion: string;
  auth: string;
};

type TestKey = 'paypal' | 'gemini';

export function SellerDeveloper() {
  useDocumentTitle('Developer');
  const { toast } = useToast();
  const workspace = useAsync<IntegrationWorkspace>(() => api.get('/api/developer/integrations'));
  const catalog = useAsync<ToolCatalog>(() => api.get('/api/developer/tools'));
  const keys = useAsync<{ keys: ApiKeyView[] }>(() => api.get('/api/developer/keys'));

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('My agent key');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<'ALL' | McpToolView['audience']>('ALL');
  const [testing, setTesting] = useState<TestKey | null>(null);
  const [tests, setTests] = useState<Partial<Record<TestKey, { ok: boolean; message: string }>>>({});

  const tools = catalog.data?.tools ?? [];
  const filteredTools = useMemo(
    () => (audience === 'ALL' ? tools : tools.filter((tool) => tool.audience === audience)),
    [tools, audience],
  );
  const integrations = workspace.data?.integrations;
  const mcpEndpoint = workspace.data?.mcpEndpoint ?? catalog.data?.endpoint ?? '/mcp';

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const next = await api.post<ApiKeyCreated>('/api/developer/keys', { label });
      setCreated(next);
      setCreateOpen(false);
      keys.reload();
      toast('API key created. Copy it now — it is shown once.', 'success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (key: ApiKeyView) => {
    if (!window.confirm(`Revoke “${key.label}”? Any agent using it will lose access immediately.`)) return;
    setRevoking(key.id);
    setError(null);
    try {
      await api.delete(`/api/developer/keys/${encodeURIComponent(key.id)}`);
      keys.reload();
      toast('API key revoked.', 'info');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRevoking(null);
    }
  };

  const copy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(message, 'success');
    } catch {
      toast('Copy failed. Select the value and copy it manually.', 'error');
    }
  };

  const runTest = async (kind: TestKey) => {
    setTesting(kind);
    setTests((current) => ({ ...current, [kind]: undefined }));
    try {
      const result = await api.post<{ ok?: boolean; message: string }>(`/api/developer/test/${kind}`);
      setTests((current) => ({
        ...current,
        [kind]: { ok: result.ok !== false, message: result.message },
      }));
      toast(result.message, result.ok === false ? 'error' : 'success');
    } catch (caught) {
      setTests((current) => ({ ...current, [kind]: { ok: false, message: errorMessage(caught) } }));
      toast(errorMessage(caught), 'error');
    } finally {
      setTesting(null);
    }
  };

  const activeKeys = (keys.data?.keys ?? []).filter((key) => !key.revokedAt);
  const revokedKeys = (keys.data?.keys ?? []).filter((key) => key.revokedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Developer"
        title="Connect an agent"
        description="The MCP endpoint and HTTP API share the same pricing engine, stock reservation and payment verification as this web app. Optional integrations report their real status."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={workspace.loading || catalog.loading}
              onClick={() => {
                workspace.reload();
                catalog.reload();
                keys.reload();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh status
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create API key
            </Button>
          </>
        }
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}
      {workspace.error && <ErrorNotice error={workspace.error} onRetry={workspace.reload} />}
      {keys.error && <ErrorNotice error={keys.error} onRetry={keys.reload} />}

      {created && (
        <Card className="border-[#01949a]/35 bg-[#eef7f7] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-teal-ink">
                <KeyRound className="h-4 w-4" aria-hidden /> New API key
              </p>
              <p className="mt-1 text-xs leading-relaxed text-teal-ink/80">
                Copy this secret now. Only its hash is stored; it cannot be recovered after you dismiss this panel.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)} aria-label="Dismiss new key">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-[#01949a]/25 bg-white px-3 py-2.5 font-mono text-xs text-forest">
              {created.secret}
            </code>
            <Button size="sm" variant="secondary" onClick={() => void copy(created.secret, 'API key copied.')}>
              <Copy className="h-3.5 w-3.5" /> Copy key
            </Button>
          </div>
          <p className="mt-2 text-[0.68rem] text-teal-ink/70">{created.warning}</p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-forest">MCP endpoint</h2>
                <p className="mt-0.5 text-xs text-forest/55">Streamable HTTP transport. Stateless per request.</p>
              </div>
              <Badge tone="teal">Protocol {catalog.data?.protocolVersion ?? '2025-06-18'}</Badge>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-pale px-3 py-2.5 font-mono text-xs text-forest">
                POST {mcpEndpoint}
              </code>
              <Button size="sm" variant="secondary" onClick={() => void copy(mcpEndpoint, 'MCP endpoint copied.')}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="mt-3">
              <CodeBlock
                title="Generic MCP client config"
                code={`{
  "mcpServers": {
    "bhavai": {
      "type": "http",
      "url": "${mcpEndpoint}",
      "headers": {
        "Authorization": "Bearer bvk_your_key"
      }
    }
  }
}`}
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-forest/10 px-3 py-2.5">
                <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Authentication</p>
                <p className="mt-0.5 text-[0.7rem] text-forest/65">
                  {integrations?.mcp.authenticated
                    ? 'Server-wide MCP_API_KEY gate is on. Send an API key as well.'
                    : 'Bearer buyer/seller API key required for tools; the endpoint itself is open.'}
                </p>
              </div>
              <div className="rounded-lg border border-forest/10 px-3 py-2.5">
                <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Tool count</p>
                <p className="mt-0.5 text-[0.7rem] text-forest/65">
                  {catalog.data?.tools.length ?? 15} tools. Buyer keys cannot read confidential rules.
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[0.66rem] leading-relaxed text-forest/50">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-teal-deep" aria-hidden />
              Every MCP write goes through the same HTTP services and audit log. The floor price never appears in a buyer-tool
              response.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-forest">API keys</h2>
                <p className="mt-0.5 text-xs text-forest/55">
                  {activeKeys.length} active · {revokedKeys.length} revoked
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New key
              </Button>
            </div>

            {keys.loading && <Spinner label="Loading keys" />}

            {!keys.loading && activeKeys.length === 0 && (
              <div className="mt-3">
                <EmptyState
                  icon={<KeyRound className="h-5 w-5" />}
                  title="No API keys yet"
                  description="Create a key so an external agent can search, negotiate, read orders or manage your rules through MCP."
                  action={
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      Create the first key
                    </Button>
                  }
                />
              </div>
            )}

            <div className="mt-3 space-y-2">
              {activeKeys.map((key) => (
                <div key={key.id} className="rounded-xl border border-forest/10 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-forest">{key.label}</p>
                      <p className="mt-0.5 font-mono text-[0.66rem] text-forest/55">{key.prefix}…</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={key.role === 'SELLER' ? 'sage' : 'teal'}>{key.role}</Badge>
                      <Button
                        size="sm"
                        variant="quiet-danger"
                        loading={revoking === key.id}
                        onClick={() => void revoke(key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[0.64rem] text-forest/45">
                    Created {dateTime(key.createdAt)} · Last used {key.lastUsedAt ? dateTime(key.lastUsedAt) : 'never'}
                  </p>
                </div>
              ))}
            </div>

            {revokedKeys.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.68rem] font-medium text-forest/50">
                  {revokedKeys.length} revoked key{revokedKeys.length === 1 ? '' : 's'}
                </summary>
                <div className="mt-2 space-y-1.5">
                  {revokedKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between gap-2 rounded-lg bg-pale/50 px-2.5 py-2 text-[0.66rem] text-forest/50">
                      <span className="truncate">
                        {key.label} · {key.prefix}…
                      </span>
                      <span>Revoked {key.revokedAt ? dateTime(key.revokedAt) : ''}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-forest">Integration status</h2>
            <p className="mt-0.5 text-xs text-forest/55">Read live from the server configuration. Nothing is assumed.</p>
            <div className="mt-3 space-y-2 text-xs">
              <IntegrationRow
                icon={<Database className="h-3.5 w-3.5" />}
                label="Database"
                ok={Boolean(integrations?.database.ok)}
                detail={
                  integrations
                    ? `${integrations.database.mode === 'embedded' ? 'Embedded PGlite' : 'Managed Postgres'} · ${integrations.database.label}`
                    : 'Loading'
                }
              />
              <IntegrationRow
                icon={<Terminal className="h-3.5 w-3.5" />}
                label="Gemini language layer"
                ok={Boolean(integrations?.gemini.configured)}
                detail={
                  integrations?.gemini.configured
                    ? `Configured · ${integrations.gemini.model ?? 'model set'}`
                    : 'Not configured · deterministic policy text is used'
                }
              />
              <IntegrationRow
                icon={<Webhook className="h-3.5 w-3.5" />}
                label="PayPal Sandbox"
                ok={Boolean(integrations?.paypal.configured)}
                detail={
                  integrations?.paypal.configured
                    ? `${integrations.paypal.environment} · webhook ${integrations.paypal.webhookConfigured ? 'configured' : 'not configured'}`
                    : 'Not configured · cross-border payment returns an honest 503'
                }
              />
              <IntegrationRow
                icon={<Terminal className="h-3.5 w-3.5" />}
                label="MCP server"
                ok={Boolean(integrations?.mcp.enabled)}
                detail={integrations ? `${integrations.mcp.path} · ${integrations.mcp.toolCount} tools` : 'Loading'}
              />
              <IntegrationRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email delivery"
                ok={Boolean(integrations?.email.configured)}
                detail={integrations?.email.note ?? 'Not configured'}
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-forest/10 p-3">
                <p className="text-xs font-semibold text-forest">PayPal credentials</p>
                <p className="mt-0.5 text-[0.64rem] leading-relaxed text-forest/50">
                  OAuth check only. It does not create or capture an order.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  loading={testing === 'paypal'}
                  onClick={() => void runTest('paypal')}
                >
                  Test PayPal
                </Button>
                {tests.paypal && <TestResult ok={tests.paypal.ok} message={tests.paypal.message} />}
              </div>
              <div className="rounded-xl border border-forest/10 p-3">
                <p className="text-xs font-semibold text-forest">Gemini</p>
                <p className="mt-0.5 text-[0.64rem] leading-relaxed text-forest/50">
                  A small structured-intent request. No customer data is sent.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  loading={testing === 'gemini'}
                  onClick={() => void runTest('gemini')}
                >
                  Test Gemini
                </Button>
                {tests.gemini && <TestResult ok={tests.gemini.ok} message={tests.gemini.message} />}
              </div>
            </div>

            {integrations && (
              <p className="mt-3 flex items-start gap-1.5 border-t border-forest/10 pt-3 text-[0.64rem] leading-relaxed text-forest/45">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Optional integrations never block the app. When they are off, the product works with deterministic text,
                manual settlement and honest 503 responses.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-forest">Environment</h2>
            <dl className="mt-3">
              <FieldRow label="Environment" value={workspace.data?.environment ?? '—'} />
              <FieldRow label="API base" value={workspace.data?.apiBaseUrl ?? '—'} mono />
              <FieldRow label="MCP endpoint" value={mcpEndpoint} mono />
              <FieldRow label="Channel3 enrichment" value={integrations?.channel3.configured ? 'Configured' : 'Off'} />
            </dl>
            <p className="mt-3 text-[0.65rem] leading-relaxed text-forest/45">
              {integrations?.channel3.note ?? 'Optional enrichment is reported honestly.'}
            </p>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-forest">MCP tool catalog</h2>
            <p className="mt-0.5 text-xs text-forest/55">
              The 15 tools exposed at <code className="rounded bg-pale px-1 py-0.5 text-[0.68rem]">{mcpEndpoint}</code>. Buyer
              keys cannot call seller-only tools.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'BUYER', 'SELLER', 'COMMERCE'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-medium transition-colors ${
                  audience === value
                    ? 'border-forest bg-forest text-ivory'
                    : 'border-forest/15 bg-white text-forest/60 hover:border-forest/30'
                }`}
              >
                {value === 'ALL' ? 'All tools' : value.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredTools.map((tool) => (
            <div key={tool.name} className="rounded-xl border border-forest/10 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="rounded bg-pale px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold text-forest">
                  {tool.name}
                </code>
                <div className="flex items-center gap-1.5">
                  <Badge tone={tool.audience === 'SELLER' ? 'sage' : tool.audience === 'BUYER' ? 'teal' : 'mint'}>
                    {tool.audience}
                  </Badge>
                  <Badge tone="outline">{tool.invocation}</Badge>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-forest">{tool.title}</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-forest/55">{tool.description}</p>
            </div>
          ))}
        </div>

        {catalog.loading && <Spinner label="Loading tools" />}
        {catalog.error && <ErrorNotice error={catalog.error} onRetry={catalog.reload} />}
        {!catalog.loading && filteredTools.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-forest/15 px-4 py-8 text-center text-xs text-forest/50">
            No tools in this audience.
          </p>
        )}
      </Card>

      <InlineNotice tone="info" title="Try it from a terminal">
        Send a JSON-RPC <code>initialize</code> request, then <code>tools/list</code>. The MCP transport requires the{' '}
        <code>Accept: application/json, text/event-stream</code> header. See the{' '}
        <a href="/docs#mcp" className="font-semibold underline">MCP guide</a> for a copy-paste example.
      </InlineNotice>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create an API key"
        description="The key inherits your account role. A seller key can read confidential rules; a buyer key cannot."
      >
        <form onSubmit={(event) => void createKey(event)} className="space-y-4">
          <Field label="Label" htmlFor="key-label" hint="Something you will recognise later, e.g. “Procurement agent”.">
            <input
              id="key-label"
              className="field"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}
          <InlineNotice tone="warning">
            The secret is shown once. Store it in your agent&apos;s secret manager, not in source control.
          </InlineNotice>
          <div className="flex justify-end gap-2 border-t border-forest/10 pt-4">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              <Check className="h-3.5 w-3.5" /> Create key
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function IntegrationRow({
  icon,
  label,
  ok,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-forest/10 px-3 py-2.5">
      <span className={`mt-0.5 ${ok ? 'text-teal-deep' : 'text-forest/35'}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.72rem] font-semibold text-forest">{label}</p>
        <p className="mt-0.5 text-[0.64rem] leading-relaxed text-forest/50">{detail}</p>
      </div>
      <Badge tone={ok ? 'teal' : 'outline'}>{ok ? 'On' : 'Off'}</Badge>
    </div>
  );
}

function TestResult({ ok, message }: { ok: boolean; message: string }) {
  return (
    <p
      className={`mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[0.64rem] leading-relaxed ${
        ok ? 'bg-[#eef7f7] text-teal-ink' : 'bg-[#fbf3e8] text-[#6b3a12]'
      }`}
      role="status"
    >
      {ok ? <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
      {message}
    </p>
  );
}

