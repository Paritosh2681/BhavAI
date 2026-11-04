import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={clsx('h-8 w-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#173C3D" />
      <path d="M9 22V13.2C9 10.88 10.88 9 13.2 9h5.6C21.12 9 23 10.88 23 13.2V22" stroke="#DBE8D8" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 22v-6.5C13 14.67 13.67 14 14.5 14h3c.83 0 1.5.67 1.5 1.5V22" stroke="#01949A" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="18.4" r="1.6" fill="#D99A55" />
    </svg>
  );
}

export function Logo({ to = '/', compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="BhavAI home">
      <LogoMark className="transition-transform duration-200 group-hover:-rotate-3" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-forest">BhavAI</span>
          <span className="mt-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-forest/45">Agentic commerce</span>
        </span>
      )}
    </Link>
  );
}
