import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Compass, ShieldQuestion } from 'lucide-react';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { useAuth, homeFor } from './context/AuthContext';
import { Logo } from './components/Logo';
import { LandingPage, ForSellersPage, StoreListPage, StorefrontPage } from './pages/PublicPages';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { DocsPage } from './pages/DocsPage';
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages';
import { SellerDashboard } from './pages/seller/SellerDashboard';
import { SellerOnboarding } from './pages/seller/Onboarding';
import { SellerProducts } from './pages/seller/Products';
import { SellerRules } from './pages/seller/Rules';
import { SellerNegotiations, SellerNegotiationDetail } from './pages/seller/Negotiations';
import { SellerAnalytics } from './pages/seller/Analytics';
import { SellerDeveloper } from './pages/seller/Developer';
import { SellerStorefront } from './pages/seller/Storefront';
import { BuyerOverview, BuyerDiscover, BuyerDeals, BuyerDealDetail, BuyerArena, BuyerOrders } from './pages/buyer/BuyerPages';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';

/* ------------------------------------------------------------------ */
/* Route utilities                                                     */
/* ------------------------------------------------------------------ */

/**
 * Reset scroll on route change and honour in-page anchors on arrival.
 * Hash scrolling is deferred a frame so the destination content is mounted.
 */
function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
      return () => window.cancelAnimationFrame(frame);
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
    return undefined;
  }, [location.pathname, location.hash]);

  return null;
}

function SessionGate() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <span className="h-1 w-28 overflow-hidden rounded-full bg-forest/10">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-teal-deep" />
        </span>
        <p className="text-xs font-medium text-forest/55">Restoring your session…</p>
      </div>
    </div>
  );
}

function RequireRole({ role, children }: { role: 'SELLER' | 'BUYER'; children: ReactNode }) {
  const { me, loading } = useAuth();

  if (loading) return <SessionGate />;
  if (!me) {
    return <Navigate to="/login" replace state={{ from: typeof window !== 'undefined' ? window.location.pathname : '/' }} />;
  }

  const actual = me.user.role === 'ADMIN' ? 'SELLER' : me.user.role;
  if (actual !== role) {
    return <Navigate to={homeFor(me)} replace />;
  }

  return <>{children}</>;
}

/** Signed-in users should not sit on the auth screens again. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <SessionGate />;
  if (me) return <Navigate to={homeFor(me)} replace />;
  return <>{children}</>;
}

function NotFoundPage() {
  const { me, loading } = useAuth();
  const destination = loading ? '/' : me ? homeFor(me) : '/';

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pale text-forest/50">
        <ShieldQuestion className="h-8 w-8" aria-hidden />
      </div>
      <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-forest/45">404</p>
      <h1 className="mt-2 font-display text-3xl text-forest">This aisle does not exist.</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-forest/65">
        The page may have moved, or the link may belong to a negotiation that was never opened. Nothing was charged.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {destination !== '/' && (
          <Link to={destination} className="btn btn-primary">
            Go to workspace
          </Link>
        )}
        <Link to="/stores" className="btn btn-secondary">
          <Compass className="h-4 w-4" aria-hidden />
          Browse marketplace
        </Link>
        <Link to="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        {/* Public marketplace, documentation, and the marketing surface */}
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="for-sellers" element={<ForSellersPage />} />
          <Route path="stores" element={<StoreListPage />} />
          <Route path="stores/:slug" element={<StorefrontPage />} />
          <Route path="stores/:slug/:productId" element={<ProductDetailPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="developer/docs" element={<DocsPage />} />
          <Route path="demo/arena" element={<BuyerArena />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Auth screens render their own split layout */}
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route
          path="forgot-password"
          element={
            <GuestOnly>
              <ForgotPasswordPage />
            </GuestOnly>
          }
        />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        {/* Seller studio */}
        <Route
          path="seller"
          element={
            <RequireRole role="SELLER">
              <AppLayout />
            </RequireRole>
          }
        >
          <Route index element={<SellerDashboard />} />
          <Route path="overview" element={<SellerDashboard />} />
          <Route path="storefront" element={<SellerStorefront />} />
          <Route path="onboarding" element={<SellerOnboarding />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="products/new" element={<SellerProducts />} />
          <Route path="rules" element={<SellerRules />} />
          <Route path="negotiations" element={<SellerNegotiations />} />
          <Route path="negotiations/:id" element={<SellerNegotiationDetail />} />
          <Route path="orders" element={<OrdersPage role="SELLER" />} />
          <Route path="analytics" element={<SellerAnalytics />} />
          <Route path="developer" element={<SellerDeveloper />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Buyer workspace */}
        <Route
          path="buyer"
          element={
            <RequireRole role="BUYER">
              <AppLayout />
            </RequireRole>
          }
        >
          <Route index element={<BuyerOverview />} />
          <Route path="discover" element={<BuyerDiscover />} />
          <Route path="deals" element={<BuyerDeals />} />
          <Route path="deals/:id" element={<BuyerDealDetail />} />
          <Route path="negotiation/:id" element={<BuyerDealDetail />} />
          <Route path="arena" element={<BuyerArena />} />
          <Route path="orders" element={<BuyerOrders />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
