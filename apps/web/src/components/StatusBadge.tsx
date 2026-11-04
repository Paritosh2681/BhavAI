import {
  NEGOTIATION_LABEL,
  ORDER_LABEL,
  PAYMENT_LABEL,
  type NegotiationStatus,
  type OrderStatus,
  type PaymentStatus,
} from '@bhavai/shared';
import { Badge } from './ui';

type Tone = 'teal' | 'sage' | 'amber' | 'forest' | 'mint' | 'outline';

const negotiationTone: Record<NegotiationStatus, Tone> = {
  OPEN: 'teal',
  AWAITING_APPROVAL: 'amber',
  AGREED: 'forest',
  REJECTED: 'outline',
  CANCELLED: 'outline',
  EXPIRED: 'outline',
};

const orderTone: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: 'amber',
  APPROVAL_PENDING: 'amber',
  PAID: 'teal',
  SETTLEMENT_PENDING: 'amber',
  SETTLED: 'sage',
  FULFILLED: 'forest',
  CANCELLED: 'outline',
  FAILED: 'outline',
};

const paymentTone: Record<PaymentStatus, Tone> = {
  CREATED: 'sage',
  APPROVAL_PENDING: 'amber',
  APPROVED: 'teal',
  CAPTURE_PENDING: 'amber',
  COMPLETED: 'forest',
  FAILED: 'outline',
  CANCELLED: 'outline',
};

export function NegotiationStatusBadge({ status }: { status: NegotiationStatus }) {
  return <Badge tone={negotiationTone[status]}>{NEGOTIATION_LABEL[status]}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const key = status as OrderStatus;
  return <Badge tone={orderTone[key] ?? 'outline'}>{ORDER_LABEL[key] ?? status}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus | string }) {
  const key = status as PaymentStatus;
  return <Badge tone={paymentTone[key] ?? 'outline'}>{PAYMENT_LABEL[key] ?? status}</Badge>;
}

export function MarketBadge({ market }: { market: string }) {
  return market === 'DOMESTIC' ? (
    <Badge tone="sage">India domestic · manual</Badge>
  ) : (
    <Badge tone="teal">Cross-border · PayPal Sandbox</Badge>
  );
}

export function SampleBadge() {
  return <Badge tone="amber">Sample</Badge>;
}
