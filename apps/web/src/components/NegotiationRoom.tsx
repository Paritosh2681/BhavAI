import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  Check,
  CircleDollarSign,
  Clock3,
  Gavel,
  Handshake,
  LockKeyhole,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { formatDateTime, formatMoney, marketLabel, percent } from '../lib/format';
import { Badge, Button, Card, Field, InlineNotice } from './ui';
import { AgentModeBadge, AgentModeNote, ErrorNotice, FieldRow } from './Feedback';
import { MarketBadge, NegotiationStatusBadge, OrderStatusBadge, SampleBadge } from './StatusBadge';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import type { NegotiationDetailView, OrderDetail, PaymentResponse } from '../lib/types';
import { useAsync } from '../lib/useAsync';

const validationLabel: Record<string, string> = {
  VALID: 'Within authorised range',
  BELOW_MINIMUM: 'Below the authorised range',
  ABOVE_LISTED: 'Above the listed price',
  QUANTITY_UNAVAILABLE: 'Quantity unavailable',
  BELOW_MIN_QUANTITY: 'Below minimum quantity',
  INVALID: 'Invalid offer',
};

function actorName(actor: string): string {
  if (actor === 'BUYER_AGENT' || actor === 'BUYER') return 'Buyer agent';
  return 'Seller agent';
}

function actorInitials(actor: string): string {
  return actor.startsWith('BUYER') ? 'BA' : 'SA';
}

export function NegotiationRoom({
  negotiation,
  role,
  onRefresh,
}: {
  negotiation: NegotiationDetailView;
  role: 'SELLER' | 'BUYER';
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [counter, setCounter] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [payment, setPayment] = useState<PaymentResponse | null>(null);

  const order = useAsync<{ order: OrderDetail } | null>(
    async () => (negotiation.order ? api.get<{ order: OrderDetail }>(`/api/orders/${negotiation.order.id}`) : null),
    [negotiation.order?.id],
  );
  const paymentRecord = payment?.payment ?? order.data?.order.payment ?? null;

  const lastOffer = [...negotiation.offers].reverse().find((offer) => offer.kind !== 'REJECTION') ?? null;
  const sellerTurn = lastOffer ? lastOffer.submittedBy.startsWith('BUYER') : false;
  const isOpen = negotiation.status === 'OPEN';
  const isBuyer = role === 'BUYER';

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      if (success) toast(success, 'success');
      onRefresh();
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const step = () =>
    run(
      'step',
      () => api.post(`/api/negotiations/${negotiation.id}/step`),
      sellerTurn ? 'The seller agent moved once.' : 'The buyer agent moved once.',
    );

  const sendCounter = async (event: React.FormEvent) => {
    event.preventDefault();
    const unitPrice = Number(counter);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError('Enter a counteroffer above zero.');
      return;
    }
    await run(
      'counter',
      () =>
        api.post(`/api/negotiations/${negotiation.id}/offers`, {
          unitPrice,
          quantity: negotiation.quantity,
          message: counterMessage,
        }),
      'Counteroffer recorded. The seller agent can respond on the next turn.',
    );
    setShowCounter(false);
    setCounter('');
    setCounterMessage('');
  };

  const confirmDeal = () =>
    run(
      'confirm',
      () => api.post(`/api/negotiations/${negotiation.id}/confirm`),
      'Deal confirmed. You can now create the payment.',
    );

  const approveDeal = () =>
    run(
      'approve',
      () => api.post(`/api/negotiations/${negotiation.id}/accept`),
      'Deal approved. Stock is now reserved.',
    );

  const reject = () =>
    run(
      'reject',
      () => api.post(`/api/negotiations/${negotiation.id}/reject`, { reason: 'Closed from the negotiation room.' }),
      'Negotiation rejected.',
    );

  const cancel = () =>
    run(
      'cancel',
      () => api.post(`/api/negotiations/${negotiation.id}/cancel`, { reason: 'Cancelled from the negotiation room.' }),
      'Negotiation cancelled.',
    );

  const createPayment = async () => {
    setBusy('payment');
    setError(null);
    try {
      const response = await api.post<PaymentResponse>(`/api/payments/deals/${negotiation.id}`, {
        origin: window.location.origin,
      });
      setPayment(response);
      toast(
        response.mode === 'MANUAL'
          ? 'Manual settlement order created. No PayPal charge was attempted.'
          : 'PayPal order created. Approve it in the PayPal Sandbox window.',
        'success',
      );
      onRefresh();
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const capture = () => {
    if (!paymentRecord) return;
    void run(
      'capture',
      () => api.post(`/api/payments/${paymentRecord.id}/capture`),
      'Payment captured and reconciled against the agreed deal.',
    );
  };

  return (
    <div className="space-y-5">
      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-forest/10 bg-pale/35 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <NegotiationStatusBadge status={negotiation.status} />
                <MarketBadge market={negotiation.marketType} />
                {negotiation.isSample && <SampleBadge />}
                <AgentModeBadge mode={negotiation.agentMode} />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-forest">{negotiation.productName}</h1>
              <p className="mt-1 text-sm text-forest/60">
                {role === 'SELLER' ? `Buyer: ${negotiation.buyerName}` : `Seller: ${negotiation.sellerName}`} ·{' '}
                {negotiation.quantity} units · opened {formatDateTime(negotiation.createdAt)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-forest/45">Current position</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-forest">
                {lastOffer ? formatMoney(lastOffer.unitPrice, negotiation.currency) : formatMoney(negotiation.listedPrice, negotiation.currency)}
                <span className="text-xs font-normal text-forest/50"> / unit</span>
              </p>
              <p className="mt-0.5 text-xs text-forest/50">
                {lastOffer ? `Total ${formatMoney(lastOffer.totalPrice, negotiation.currency)}` : 'No offer yet'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-forest/10 sm:grid-cols-4">
          <MetaCell label="Listed price" value={formatMoney(negotiation.listedPrice, negotiation.currency)} />
          <MetaCell label="Quantity" value={`${negotiation.quantity} units`} />
          <MetaCell label="Rounds" value={`${negotiation.roundsUsed} of ${negotiation.maxRounds}`} />
          <MetaCell
            label="Buyer budget"
            value={negotiation.budgetTotal ? formatMoney(negotiation.budgetTotal, negotiation.currency) : 'Not stated'}
          />
        </div>

        {negotiation.deal && (
          <div className="border-t border-forest/10 bg-[#eef7f7] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-teal-ink">
                  <Handshake className="h-3.5 w-3.5" aria-hidden /> Agreed deal
                </p>
                <p className="mt-1 text-sm font-semibold text-forest">
                  {formatMoney(negotiation.deal.agreedUnitPrice, negotiation.currency)} × {negotiation.deal.agreedQuantity} ={' '}
                  {formatMoney(negotiation.deal.totalAmount, negotiation.currency)}
                </p>
                <p className="mt-0.5 text-xs text-forest/60">
                  {negotiation.deal.buyerConfirmedAt
                    ? `Buyer confirmed ${formatDateTime(negotiation.deal.buyerConfirmedAt)}.`
                    : 'Awaiting buyer confirmation before payment can be created.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {negotiation.order && (
                  <Link to={`/${role === 'SELLER' ? 'seller' : 'buyer'}/orders`} className="btn btn-secondary btn-sm">
                    <PackageCheck className="h-3.5 w-3.5" /> View order
                  </Link>
                )}
                {isBuyer && !negotiation.deal.buyerConfirmedAt && (
                  <Button size="sm" loading={busy === 'confirm'} onClick={() => void confirmDeal()}>
                    <Check className="h-3.5 w-3.5" /> Confirm deal
                  </Button>
                )}
                {isBuyer && negotiation.deal.buyerConfirmedAt && !negotiation.order && (
                  <Button size="sm" loading={busy === 'payment'} onClick={() => void createPayment()}>
                    <CircleDollarSign className="h-3.5 w-3.5" /> Create payment
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {negotiation.order && (
          <div className="border-t border-forest/10 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={negotiation.order.status} />
                <span className="text-xs text-forest/60">
                  {negotiation.order.paymentProvider === 'MANUAL'
                    ? 'Manual settlement · no PayPal charge'
                    : 'PayPal Sandbox · server verified'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {paymentRecord?.approvalUrl && paymentRecord.status !== 'COMPLETED' && (
                  <a href={paymentRecord.approvalUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                    Approve in PayPal <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                )}
                {isBuyer && paymentRecord && paymentRecord.provider === 'PAYPAL' && ['APPROVAL_PENDING', 'APPROVED', 'CREATED'].includes(paymentRecord.status) && (
                  <Button size="sm" variant="secondary" loading={busy === 'capture'} onClick={capture}>
                    Capture payment
                  </Button>
                )}
              </div>
            </div>
            {negotiation.order.paymentProvider === 'MANUAL' && (
              <p className="mt-3 rounded-lg bg-[#fbf3e8] px-3 py-2 text-[0.7rem] leading-relaxed text-[#6b3a12]">
                India domestic order. The seller confirms receipt off-platform; BhavAI never presents this as a PayPal payment.
              </p>
            )}
            {payment && payment.mode === 'MANUAL' && (
              <p className="mt-2 text-[0.7rem] text-forest/60">
                A manual settlement order was created. The seller can mark it settled from their Orders page.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_0.85fr] lg:items-start">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-forest">Offer history</h2>
              <p className="mt-0.5 text-xs text-forest/55">Every number carries the policy receipt that authorised it.</p>
            </div>
            <Badge tone="sage">{negotiation.offers.length} moves</Badge>
          </div>

          <ol className="mt-5 space-y-0">
            {negotiation.offers.map((offer, index) => {
              const buyer = offer.submittedBy.startsWith('BUYER');
              const isAcceptance = offer.kind === 'ACCEPTANCE';
              const isRejection = offer.kind === 'REJECTION';
              return (
                <li key={offer.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < negotiation.offers.length - 1 && (
                    <span className="absolute left-[15px] top-8 h-full w-px bg-forest/12" aria-hidden />
                  )}
                  <div
                    className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-bold ${
                      isRejection
                        ? 'bg-[#f6e9d8] text-[#6b3a12]'
                        : isAcceptance
                          ? 'bg-teal-deep text-white'
                          : buyer
                            ? 'bg-forest text-ivory'
                            : 'bg-sage text-forest'
                    }`}
                  >
                    {isRejection ? <X className="h-3.5 w-3.5" /> : isAcceptance ? <Check className="h-3.5 w-3.5" /> : actorInitials(offer.submittedBy)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-forest">
                          {isRejection ? `${actorName(offer.submittedBy)} ended the conversation` : actorName(offer.submittedBy)}
                        </p>
                        <Badge tone={isRejection ? 'amber' : isAcceptance ? 'forest' : offer.validationStatus === 'VALID' ? 'teal' : 'amber'}>
                          {isRejection ? 'Rejected' : validationLabel[offer.validationStatus] ?? offer.validationStatus}
                        </Badge>
                        <span className="text-[0.65rem] text-forest/40">Round {offer.round}</span>
                      </div>
                      <p className="text-sm font-semibold text-forest">
                        {formatMoney(offer.unitPrice, negotiation.currency)}
                        <span className="text-[0.65rem] font-normal text-forest/45"> / unit</span>
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-forest/70">{offer.message}</p>
                    {offer.explanation && offer.explanation !== offer.message && (
                      <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-pale/60 px-2.5 py-2 text-[0.68rem] leading-relaxed text-forest/60">
                        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-teal-deep" aria-hidden />
                        {offer.explanation}
                      </p>
                    )}
                    <p className="mt-1.5 text-[0.62rem] text-forest/40">
                      {formatDateTime(offer.createdAt)} · {formatMoney(offer.totalPrice, negotiation.currency)} total
                    </p>
                  </div>
                </li>
              );
            })}
            {negotiation.offers.length === 0 && (
              <li className="rounded-xl border border-dashed border-forest/15 bg-pale/30 px-4 py-8 text-center">
                <MessageSquare className="mx-auto h-5 w-5 text-forest/30" aria-hidden />
                <p className="mt-2 text-sm font-medium text-forest">No agent has moved yet.</p>
                <p className="mt-1 text-xs text-forest/55">Advance one turn to let the buyer agent open the conversation.</p>
              </li>
            )}
          </ol>

          <div className="mt-5 border-t border-forest/10 pt-5">
            {isOpen && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={busy === 'step'} onClick={() => void step()}>
                    <Sparkles className="h-3.5 w-3.5" />
                    {sellerTurn ? 'Seller agent responds' : 'Buyer agent moves'}
                  </Button>
                  {isBuyer && (
                    <Button size="sm" variant="secondary" onClick={() => setShowCounter((value) => !value)}>
                      <Gavel className="h-3.5 w-3.5" /> Human counteroffer
                    </Button>
                  )}
                </div>
                <p className="text-[0.7rem] leading-relaxed text-forest/50">
                  Turns alternate. The server validates every movement against the seller&apos;s confidential policy before it is
                  written. {sellerTurn ? 'It is the seller agent’s turn.' : 'It is the buyer agent’s turn.'}
                </p>

                {showCounter && isBuyer && (
                  <form onSubmit={(event) => void sendCounter(event)} className="rounded-xl border border-forest/10 bg-pale/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                      <Field label="Unit price" htmlFor="counter-price" hint={`Currency: ${negotiation.currency}`}>
                        <input
                          id="counter-price"
                          className="field"
                          inputMode="decimal"
                          value={counter}
                          onChange={(event) => setCounter(event.target.value)}
                          placeholder={(lastOffer?.unitPrice ?? negotiation.listedPrice).toFixed(2)}
                          required
                        />
                      </Field>
                      <Field label="Message" htmlFor="counter-message" hint="Optional, shown to the seller">
                        <input
                          id="counter-message"
                          className="field"
                          value={counterMessage}
                          onChange={(event) => setCounterMessage(event.target.value)}
                          placeholder="We can commit this week."
                          maxLength={600}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="submit" size="sm" loading={busy === 'counter'}>
                        Send counteroffer
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowCounter(false)}>
                        Cancel
                      </Button>
                    </div>
                    {sellerTurn === false && (
                      <p className="mt-2 text-[0.68rem] text-[#6b3a12]">
                        The seller agent has not answered your last offer yet. Advance the seller turn first.
                      </p>
                    )}
                  </form>
                )}
              </div>
            )}

            {negotiation.status === 'AWAITING_APPROVAL' && (
              <div className="rounded-xl border border-[#d99a55]/40 bg-[#fbf3e8] p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#6b3a12]">
                  <Clock3 className="h-3.5 w-3.5" /> Seller approval required
                </p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-[#6b3a12]/85">
                  The agent reached a price inside the rules but below the seller&apos;s approval threshold. Stock is not reserved
                  until the seller approves.
                </p>
                {role === 'SELLER' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === 'approve'} onClick={() => void approveDeal()}>
                      <Check className="h-3.5 w-3.5" /> Approve deal
                    </Button>
                    <Button size="sm" variant="quiet-danger" loading={busy === 'reject'} onClick={() => void reject()}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}

            {['OPEN', 'AWAITING_APPROVAL', 'AGREED'].includes(negotiation.status) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {negotiation.status !== 'AGREED' && (
                  <Button size="sm" variant="ghost" loading={busy === 'reject'} onClick={() => void reject()}>
                    <Ban className="h-3.5 w-3.5" /> End without a deal
                  </Button>
                )}
                {negotiation.status !== 'AWAITING_APPROVAL' && !negotiation.order && (
                  <Button size="sm" variant="ghost" loading={busy === 'cancel'} onClick={() => void cancel()}>
                    Cancel negotiation
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-forest">Public policy facts</h2>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-forest/55">
              Only terms that are safe to publish are shown. The confidential floor never leaves the server.
            </p>
            <dl className="mt-3">
              <FieldRow label="Minimum quantity" value={`${negotiation.policy.minimumQuantity} units`} />
              <FieldRow label="Round limit" value={`${negotiation.policy.maxRounds}`} />
              <FieldRow label="Available stock" value={`${negotiation.availableStock} units`} />
              <FieldRow label="Approval gate" value={negotiation.policy.approvalRequired ? 'Seller review required' : 'Policy-bounded'} />
              <FieldRow label="Market" value={marketLabel(negotiation.marketType)} />
              <FieldRow label="Negotiation ID" value={negotiation.id} mono />
              {negotiation.expiresAt && <FieldRow label="Expires" value={formatDateTime(negotiation.expiresAt)} />}
            </dl>
            {negotiation.policy.bulkTiers.length > 0 && (
              <div className="mt-3 border-t border-forest/10 pt-3">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-forest/45">Published bulk tiers</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {negotiation.policy.bulkTiers.map((tier) => (
                    <Badge key={tier.minimumQuantity} tone="mint">
                      {tier.minimumQuantity}+ · {percent(tier.discountPercent, 0)} off
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 rounded-lg bg-pale/60 px-3 py-2.5">
              <p className="flex items-start gap-1.5 text-[0.66rem] leading-relaxed text-forest/60">
                <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0 text-teal-deep" aria-hidden />
                The floor price and minimum allowed price are seller-only fields. Buyer-facing APIs and MCP tools never return
                them.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-forest">Agent authority</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef7f7] text-teal-deep">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-semibold text-forest">Deterministic decision</p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-forest/55">
                    The pricing engine owns every accept, counter and reject. Language never controls a number.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pale text-forest">
                  <UserRound className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-semibold text-forest">Server-side revalidation</p>
                  <p className="mt-0.5 text-[0.68rem] leading-relaxed text-forest/55">
                    Acceptance, stock reservation and payment all re-run the same rules inside a transaction.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-forest/10 pt-3">
              <AgentModeNote mode={negotiation.agentMode} />
            </div>
          </Card>

          <InlineNotice tone="info" title="What happens next">
            {isBuyer
              ? 'After agreement, confirm the deal, then create the payment. Domestic Indian deals become manual settlement orders; cross-border deals use PayPal Sandbox when configured.'
              : 'Once the buyer confirms, a payment or manual settlement order is created. You can settle and fulfil the order from Orders.'}
          </InlineNotice>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-forest/45">{label}</p>
      <p className="mt-1 text-sm font-semibold text-forest">{value}</p>
    </div>
  );
}
