import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'quiet-danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'quiet-danger' && 'btn-quiet-danger',
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

type BadgeTone = 'teal' | 'sage' | 'amber' | 'forest' | 'mint' | 'outline';
const badgeTones: Record<BadgeTone, string> = {
  teal: 'bg-[#d9eef0] text-[#00565a]',
  sage: 'bg-[#e7f1e9] text-[#173c3d]',
  amber: 'bg-[#f6e9d8] text-[#6b3a12]',
  forest: 'bg-[#173c3d] text-[#f6f8f3]',
  mint: 'bg-[#dbe8d8] text-[#173c3d]',
  outline: 'border border-forest/20 text-forest',
};

export function Badge({ children, tone = 'sage', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={clsx('chip', badgeTones[tone], className)}>{children}</span>;
}

export function Card({ children, className, muted = false }: { children: ReactNode; className?: string; muted?: boolean }) {
  return <div className={clsx(muted ? 'surface-muted' : 'surface', 'rounded-2xl', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[1.9rem] font-semibold tracking-[-0.025em] text-forest sm:text-[2.2rem]">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-forest/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#8a5a22]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center rounded-2xl px-6 py-12 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pale text-teal-deep">{icon}</div>}
      <h3 className="text-base font-semibold text-forest">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-forest/65">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-forest/60" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-forest/[0.06]', className)} aria-hidden />;
}

export function Stat({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'teal' | 'amber';
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 sm:p-5',
        tone === 'teal' && 'border-[#01949a]/20 bg-[#eef7f7]',
        tone === 'amber' && 'border-[#d99a55]/30 bg-[#fbf3e8]',
        tone === 'default' && 'surface',
      )}
    >
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.13em] text-forest/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-forest">{value}</p>
      {detail && <div className="mt-1 text-xs leading-relaxed text-forest/60">{detail}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <dialog
      ref={ref}
      className={clsx('modal no-print', wide && 'modal-wide')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-forest/10 bg-ivory/95 px-5 py-4 backdrop-blur-sm">
        <div>
          <h2 id="modal-title" className="text-base font-semibold text-forest">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-forest/60">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-forest/55 hover:bg-forest/10 hover:text-forest"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </dialog>,
    document.body,
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="surface inline-flex flex-wrap gap-1 rounded-xl p-1" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          data-active={value === tab.value}
          className="tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 opacity-60">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
  title,
}: {
  tone?: 'info' | 'warning' | 'success';
  children: ReactNode;
  title?: string;
}) {
  const styles =
    tone === 'warning'
      ? 'border-[#d99a55]/45 bg-[#fbf3e8] text-[#6b3a12]'
      : tone === 'success'
        ? 'border-[#01949a]/25 bg-[#eef7f7] text-[#00565a]'
        : 'border-forest/12 bg-pale text-forest/80';
  return (
    <div className={clsx('rounded-xl border px-3.5 py-3 text-xs leading-relaxed', styles)} role="note">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}
