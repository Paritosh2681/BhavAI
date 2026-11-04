import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth, homeFor } from '../context/AuthContext';
import clsx from 'clsx';

const links = [
  { to: '/stores', label: 'Marketplace' },
  { to: '/for-sellers', label: 'For sellers' },
  { to: '/docs', label: 'Developers' },
];

export function PublicLayout() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-forest focus:px-4 focus:py-2 focus:text-sm focus:text-ivory"
      >
        Skip to content
      </a>

      <div className="sticky top-3.5 z-50 w-full px-3.5 sm:px-6 pointer-events-none transition-all duration-300">
        <header className="header-pill pointer-events-auto mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-5">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => clsx('nav-pill', isActive && 'active')}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {me ? (
              <Link to={homeFor(me)} className="btn btn-primary btn-sm rounded-full px-4 py-2 text-xs">
                {me.user.role === 'SELLER' ? 'Seller studio' : 'Buyer workspace'}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm rounded-full px-3.5 py-1.5 text-xs">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm rounded-full px-4 py-2 text-xs">
                  Open BhavAI
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-forest hover:bg-pale/70 md:hidden transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="header-pill pointer-events-auto mx-auto mt-2 max-w-5xl rounded-3xl p-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                    location.pathname.startsWith(link.to) ? 'bg-pale font-semibold text-forest' : 'text-forest/75 hover:bg-pale/40',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-forest/10 pt-3">
                {me ? (
                  <Link to={homeFor(me)} onClick={() => setOpen(false)} className="btn btn-primary rounded-full">
                    Open workspace
                  </Link>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setOpen(false)} className="btn btn-secondary rounded-full">
                      Sign in
                    </Link>
                    <Link to="/signup" onClick={() => setOpen(false)} className="btn btn-primary rounded-full">
                      Open BhavAI
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>

      <main id="main">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-forest/10 bg-pale/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-forest/65">
              Agent-readable storefronts and policy-bounded negotiation for small businesses. Built for the PayPal AI Hackathon 2026.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-forest/50">
              PayPal runs in Sandbox. Indian domestic orders settle off-platform and are never presented as PayPal payments.
            </p>
          </div>
          <FooterCol
            title="Marketplace"
            links={[
              { to: '/stores', label: 'Browse storefronts' },
              { to: '/for-sellers', label: 'For sellers' },
              { to: '/signup?role=buyer', label: 'Buyer account' },
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              { to: '/docs', label: 'Documentation' },
              { to: '/docs#mcp', label: 'MCP integration' },
              { to: '/docs#api', label: 'HTTP API' },
            ]}
          />
          <FooterCol
            title="Platform"
            links={[
              { to: '/login', label: 'Sign in' },
              { to: '/signup?role=seller', label: 'Sell on BhavAI' },
              { to: '/docs#limitations', label: 'Honest limitations' },
            ]}
          />
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-forest/10 px-4 py-5 text-xs text-forest/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} BhavAI. MIT licensed reference implementation.</p>
          <p>No production money movement. Verify every integration before commercial use.</p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ to: string; label: string }> }) {
  return (
    <div>
      <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-forest/45">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={`${link.to}-${link.label}`}>
            <Link to={link.to} className="text-sm text-forest/70 hover:text-forest">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
