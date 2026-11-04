import type { ReactNode } from 'react';
import { AlertTriangle, Bot, Cpu } from 'lucide-react';
import { Badge } from './ui';
import { modeDetail } from '../lib/format';

export function ErrorNotice({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-[#d99a55]/45 bg-[#fbf3e8] px-4 py-3 text-sm text-[#6b3a12]" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">That action did not complete</p>
          <p className="mt-0.5 text-xs leading-relaxed">{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold underline">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentModeBadge({ mode }: { mode: string | null | undefined }) {
  const gemini = mode === 'GEMINI';
  return (
    <Badge tone={gemini ? 'teal' : 'sage'}>
      {gemini ? <Bot className="h-3 w-3" aria-hidden /> : <Cpu className="h-3 w-3" aria-hidden />}
      {gemini ? 'Gemini phrasing' : 'Policy text'}
    </Badge>
  );
}

export function AgentModeNote({ mode }: { mode: string | null | undefined }) {
  return (
    <p className="flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-forest/50">
      {mode === 'GEMINI' ? <Bot className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : <Cpu className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
      {modeDetail(mode)}
    </p>
  );
}

export function FieldRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-forest/[0.07] py-2 last:border-b-0">
      <dt className="text-xs text-forest/55">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-[0.7rem] text-forest' : 'text-right text-xs font-semibold text-forest'}>{value}</dd>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-pale px-1.5 py-0.5 font-mono text-[0.72rem] text-forest">{children}</code>;
}

export function CodeBlock({ title, code }: { title?: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ivory/15 bg-[#0f2c2d]">
      {title && (
        <div className="border-b border-ivory/10 px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-sage">
          {title}
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3 text-[0.7rem] leading-relaxed text-ivory/80">
        <code>{code}</code>
      </pre>
    </div>
  );
}
