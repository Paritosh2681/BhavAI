import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3,
  BookOpen,
  Boxes,
  Compass,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Swords,
  X,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const sellerNav: NavItem[] = [
  { to: '/seller', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/seller/products', label: 'Products', icon: Boxes },
  { to: '/seller/storefront', label: 'AI Storefront', icon: Store },
  { to: '/seller/negotiations', label: 'Negotiations', icon: Handshake },
  { to: '/seller/orders', label: 'Orders', icon: PackageCheck },
  { to: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/seller/rules', label: 'Pricing rules', icon: SlidersHorizontal },
  { to: '/seller/developer', label: 'Developer', icon: KeyRound },
  { to: '/seller/settings', label: 'Settings', icon: Settings },
];

const buyerNav: NavItem[] = [
  { to: '/buyer', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/buyer/discover', label: 'Discover', icon: Compass },
  { to: '/buyer/deals', label: 'Negotiations', icon: Handshake },
  { to: '/buyer/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/buyer/arena', label: 'Agent Arena', icon: Swords },
  { to: '/buyer/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isSeller = me?.user.role === 'SELLER' || me?.user.role === 'ADMIN';
  const nav = isSeller ? sellerNav : buyerNav;
  const initials = (me?.user.name ?? 'B')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-ivory">
      {/* Floating Pill Navigation Header */}
      <div className="sticky top-3.5 z-40 w-full px-3.5 sm:px-6 lg:px-8 pointer-events-none no-print transition-all duration-300">
        <header className="header-pill pointer-events-auto mx-auto flex h-14 max-w-6xl items-center justify-between px-3.5 sm:px-5">
          {/* Left: Logo & Workspace indicator */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOpen((val) => !val)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-forest hover:bg-pale/70 lg:hidden transition-colors"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Logo to={isSeller ? '/seller' : '/buyer'} compact={false} />
            <span className="hidden xl:inline-block h-4 w-px bg-forest/15" />
            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-pale px-2.5 py-0.5 text-[0.68rem] font-semibold text-forest border border-forest/10">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-deep" />
              {isSeller ? 'Seller studio' : 'Buyer workspace'}
            </span>
          </div>

          {/* Center: Desktop Navigation Pills */}
          <nav className="hidden items-center gap-1 lg:flex overflow-x-auto no-scrollbar py-1" aria-label="Workspace">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => clsx('nav-pill text-xs', isActive && 'active')}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Public Marketplace & User Profile Chip */}
          <div className="flex items-center gap-2">
            <Link
              to="/stores"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-forest/12 bg-white/70 px-3 py-1.5 text-xs font-medium text-forest/75 hover:bg-pale/60 hover:text-forest transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Marketplace</span>
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-forest/12 bg-white/80 py-1 pl-1 pr-2.5 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[0.65rem] font-bold text-ivory">
                {initials}
              </div>
              <span className="max-w-[110px] truncate text-xs font-semibold text-forest hidden sm:inline">
                {me?.seller?.businessName ?? me?.user.name}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full p-1 text-forest/50 hover:bg-pale hover:text-forest transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Dropdown Menu (Under the floating pill) */}
        {open && (
          <div className="header-pill pointer-events-auto mx-auto mt-2 max-w-6xl rounded-3xl p-4 lg:hidden">
            <div className="mb-2 flex items-center justify-between border-b border-forest/10 pb-2.5 px-2">
              <span className="text-xs font-semibold text-forest">
                {me?.seller?.businessName ?? me?.user.name}
              </span>
              <span className="rounded-full bg-pale px-2 py-0.5 text-[0.65rem] font-semibold text-forest">
                {isSeller ? 'Seller studio' : 'Buyer workspace'}
              </span>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Mobile Navigation">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-pale font-semibold text-forest' : 'text-forest/75 hover:bg-pale/40',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-3 flex flex-col gap-1.5 border-t border-forest/10 pt-3">
                <Link
                  to="/stores"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-medium text-forest/75 hover:bg-pale/40"
                >
                  <BookOpen className="h-4 w-4" /> Public marketplace
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-medium text-forest/60 hover:bg-pale/40 text-left"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content Area - Shifted cleanly below the floating pill */}
      <main id="main" className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-20 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
