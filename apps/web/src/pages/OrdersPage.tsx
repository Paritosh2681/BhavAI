import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, ExternalLink, PackageCheck, Search, Truck } from 'lucide-react';
import { formatMoney } from '@bhavai/shared';
import { Button, Card, EmptyState, Field, InlineNotice, PageHeader, Spinner, Tabs } from '../components/ui';
import { ErrorNotice, FieldRow } from '../components/Feedback';
import { MarketBadge, OrderStatusBadge, PaymentStatusBadge, SampleBadge } from '../components/StatusBadge';
import { useAsync, useDocumentTitle } from '../lib/useAsync';
import { api, errorMessage, queryString } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { dateTime, shortId } from '../lib/format';
import type { OrderDetail, OrderListResult, PaymentResponse } from '../lib/types';

type StatusTab = 'ALL' | 'PENDING_PAYMENT' | 'SETTLEMENT_PENDING' | 'PAID' | 'SETTLED' | 'FULFILLED' | 'CANCELLED';

export function OrdersPage({ role }: { role: 'SELLER' | 'BUYER' }) {
  useDocumentTitle('Orders');
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusTab>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settlementNote, setSettlementNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useAsync<OrderListResult>(
    () => api.get(`/api/orders${queryString({ status: status === 'ALL' ? undefined : status, search, pageSize: 60 })}`),
    [status, search],
  );
  const rows = list.data?.orders ?? [];

  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    if (selectedId && rows.length > 0 && !rows.some((row) => row.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  const detail = useAsync<{ order: OrderDetail } | null>(
    async () => (selectedId ? api.get<{ order: OrderDetail }>(`/api/orders/${selectedId}`) : null),
    [selectedId],
  );

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      toast(message, 'success');
      setSettlementNote('');
      list.reload();
      detail.reload();
    } catch (caught) {
      const text = errorMessage(caught);
      setError(text);
      toast(text, 'error');
    } finally {
      setBusy(null);
    }
  };

  const settle = (orderId: string) =>
    run(
      'settle',
      () => api.post(`/api/orders/${orderId}/settle`, { note: settlementNote || undefined }),
      'Domestic order marked settled. BhavAI recorded that you confirmed funds off-platform.',
    );

  const fulfil = (orderId: string) => run('fulfil', () => api.post(`/api/orders/${orderId}/fulfil`), 'Order marked fulfilled.');

  const cancel = (orderId: string) => {
    if (!window.confirm('Cancel this order? Stock is returned and the deal is cancelled. Paid orders cannot be cancelled.')) return;
    void run('cancel', () => api.post(`/api/orders/${orderId}/cancel`, { reason: 'Cancelled from orders workspace.' }), 'Order cancelled.');
  };

  const order = detail.data?.order ?? null;
  const payment = order?.payment ?? null;
  const paid = order ? ['PAID', 'SETTLED', 'FULFILLED'].includes(order.status) : false;

  const isPendingPayPal =
    order?.paymentProvider === 'PAYPAL' &&
    payment &&
    ['CREATED', 'APPROVAL_PENDING', 'APPROVED', 'CAPTURE_PENDING'].includes(payment.status) &&
    !['CANCELLED', 'FAILED', 'PAID', 'FULFILLED'].includes(order.status);

  useEffect(() => {
    if (!isPendingPayPal || !payment) return;
    const timer = window.setInterval(() => {
      void api
        .get<PaymentResponse>(`/api/payments/${encodeURIComponent(payment.id)}?reconcile=true`)
        .then((fresh) => {
          if (fresh.payment.status !== payment.status) {
            detail.reload();
            list.reload();
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isPendingPayPal, payment, detail, list]);

  const tabs = useMemo(
    () => [
      { value: 'ALL' as const, label: 'All', count: list.data?.total },
      { value: 'SETTLEMENT_PENDING' as const, label: 'Settlement' },
      { value: 'PAID' as const, label: 'Paid' },
      { value: 'SETTLED' as const, label: 'Settled' },
      { value: 'FULFILLED' as const, label: 'Fulfilled' },
      { value: 'CANCELLED' as const, label: 'Cancelled' },
    ],
    [list.data?.total],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        description={
          role === 'SELLER'
            ? 'Orders exist only for accepted, confirmed deals. Domestic Indian orders require your manual settlement confirmation.'
            : 'Track the payment rail for each accepted deal. Cross-border uses PayPal Sandbox; India domestic settles off-platform.'
        }
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search orders</span>
          <input className="field pl-9" placeholder="Search order, customer or product" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/35" aria-hidden />
        </label>
        <Tabs label="Filter orders" value={status} onChange={setStatus} tabs={tabs} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.9fr] lg:items-start">
        <div className="space-y-2.5">
          {list.loading && <Spinner label="Loading orders" />}
          {!list.loading && rows.length === 0 && (
            <EmptyState
              icon={<PackageCheck className="h-5 w-5" />}
              title="No orders in this view"
              description="An order is created only after a deal is agreed, confirmed by the buyer and paired with a payment rail."
            />
          )}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedId(row.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                selectedId === row.id ? 'border-teal/45 bg-[#eef7f7]' : 'border-forest/10 bg-white hover:border-teal/25 hover:bg-pale/20'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={row.status} />
                  <MarketBadge market={row.marketType} />
                  {row.isSample && <SampleBadge />}
                </div>
                <p className="text-sm font-semibold text-forest">{formatMoney(row.totalAmount, row.currency)}</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-forest">{row.productName ?? 'Order'}</p>
              <p className="mt-0.5 text-xs text-forest/55">
                {row.customerName ?? 'Customer'} · {dateTime(row.createdAt)} · {shortId(row.id)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.66rem] text-forest/45">
                <span>{row.paymentProvider === 'MANUAL' ? 'Manual settlement · no PayPal' : 'PayPal Sandbox'}</span>
                <span className="divider-dot" />
                <PaymentStatusBadge status={row.paymentState} />
              </div>
            </button>
          ))}
        </div>

        <div className="lg:sticky lg:top-20">
          {detail.loading && <Spinner label="Loading order" />}
          {detail.error && <ErrorNotice error={detail.error} onRetry={detail.reload} />}
          {order && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-forest/45">Order detail</p>
                  <h2 className="mt-1 text-base font-semibold text-forest">{order.productName ?? 'Order'}</h2>
                  <p className="mt-0.5 text-xs text-forest/50">{shortId(order.id)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="mt-4 rounded-xl bg-pale/60 px-4 py-3">
                <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Order total</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-forest">{formatMoney(order.totalAmount, order.currency)}</p>
                <p className="mt-1 text-xs text-forest/55">
                  {order.paymentProvider === 'MANUAL' ? 'Manual settlement · domestic India' : 'PayPal Sandbox · cross-border'}
                </p>
              </div>

              <dl className="mt-3">
                <FieldRow label="Customer" value={order.customerName ?? '—'} />
                <FieldRow label="Created" value={dateTime(order.createdAt)} />
                <FieldRow label="Market" value={<MarketBadge market={order.marketType} />} />
                <FieldRow label="Payment state" value={<PaymentStatusBadge status={order.paymentState} />} />
                {payment && <FieldRow label="Provider order" value={payment.providerOrderId ?? '—'} mono />}
                {payment && <FieldRow label="Capture" value={payment.providerCaptureId ?? '—'} mono />}
                {order.externalOrderId && <FieldRow label="External order" value={order.externalOrderId} mono />}
              </dl>

              {order.settlementNote && (
                <div className="mt-3 rounded-lg bg-[#fbf3e8] px-3 py-2.5 text-[0.68rem] leading-relaxed text-[#6b3a12]">
                  <p className="font-semibold">Settlement note</p>
                  <p className="mt-0.5">{order.settlementNote}</p>
                </div>
              )}

              {order.paymentProvider === 'MANUAL' && order.marketType === 'DOMESTIC' && !paid && role === 'SELLER' && (
                <div className="mt-4 rounded-xl border border-[#d99a55]/40 bg-[#fbf3e8] p-3">
                  <p className="text-xs font-semibold text-[#6b3a12]">Confirm off-platform settlement</p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-[#6b3a12]/80">
                    Only use this after you have received funds outside BhavAI. This does not process a payment.
                  </p>
                  <div className="mt-2">
                    <Field label="Note (optional)" htmlFor="settlement-note">
                      <input
                        id="settlement-note"
                        className="field"
                        placeholder="UPI reference or bank note"
                        value={settlementNote}
                        onChange={(event) => setSettlementNote(event.target.value)}
                        maxLength={280}
                      />
                    </Field>
                  </div>
                  <Button size="sm" className="mt-2" loading={busy === 'settle'} onClick={() => void settle(order.id)}>
                    <CircleDollarSign className="h-3.5 w-3.5" /> Mark settled
                  </Button>
                </div>
              )}

              {order.status === 'CANCELLED' && payment?.status === 'COMPLETED' && (
                <div className="mt-3">
                  <InlineNotice tone="warning" title="Refund / Reconciliation Required">
                    PayPal captured this payment after the order was cancelled. Issue a refund in PayPal Sandbox; do not fulfill.
                  </InlineNotice>
                </div>
              )}

              {payment?.approvalUrl &&
                payment.status !== 'COMPLETED' &&
                !['CANCELLED', 'FAILED'].includes(order.status) &&
                role === 'BUYER' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={payment.approvalUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm flex-1">
                      Approve in PayPal Sandbox <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {['APPROVAL_PENDING', 'APPROVED', 'CREATED'].includes(payment.status) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === 'capture'}
                        onClick={() =>
                          void run(
                            'capture',
                            () => api.post(`/api/payments/${payment.id}/capture`),
                            'Payment captured and reconciled against the agreed deal.',
                          )
                        }
                      >
                        Capture payment
                      </Button>
                    )}
                  </div>
                )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-forest/10 pt-3">
                {role === 'SELLER' && ['PAID', 'SETTLED'].includes(order.status) && (
                  <Button size="sm" loading={busy === 'fulfil'} onClick={() => void fulfil(order.id)}>
                    <Truck className="h-3.5 w-3.5" /> Mark fulfilled
                  </Button>
                )}
                {!paid && !['CANCELLED', 'FAILED'].includes(order.status) && (
                  <Button size="sm" variant="quiet-danger" loading={busy === 'cancel'} onClick={() => void cancel(order.id)}>
                    Cancel order
                  </Button>
                )}
              </div>

              <InlineNotice tone="info" title="No fabricated success" >
                {order.paymentProvider === 'MANUAL'
                  ? 'BhavAI did not process this payment. The seller confirmation is a recorded statement, not a verified transfer.'
                  : 'PayPal capture and webhook events are verified against the local deal amount before an order becomes paid.'}
              </InlineNotice>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
