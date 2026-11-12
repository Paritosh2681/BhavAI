import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { PaymentResponse } from '../lib/types';
import { InlineNotice, Spinner } from './ui';

type PayPalPublicConfig = {
  demoMode: boolean;
  paypal?: {
    configured: boolean;
    clientId: string | null;
    environment: string;
  };
};

type PayPalButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close?: () => Promise<void>;
};

type PayPalNamespace = {
  Buttons: (options: {
    style?: { layout?: 'vertical' | 'horizontal'; shape?: 'rect' | 'pill'; label?: string; height?: number };
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => PayPalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
    __bhavaiPayPalSdkKey?: string;
  }
}

function loadPayPalSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  const sdkKey = `${clientId}:${currency}`;
  if (window.paypal && window.__bhavaiPayPalSdkKey === sdkKey) {
    return Promise.resolve(window.paypal);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-bhavai-paypal-sdk]');
    if (existing) {
      if (window.paypal && window.__bhavaiPayPalSdkKey === sdkKey) {
        resolve(window.paypal);
        return;
      }
      existing.remove();
      delete window.paypal;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    script.async = true;
    script.dataset.bhavaiPaypalSdk = sdkKey;
    script.onload = () => {
      if (window.paypal) {
        window.__bhavaiPayPalSdkKey = sdkKey;
        resolve(window.paypal);
      } else {
        reject(new Error('PayPal JavaScript SDK loaded without window.paypal.'));
      }
    };
    script.onerror = () => reject(new Error('Could not load the PayPal JavaScript SDK.'));
    document.head.appendChild(script);
  });
}

export function PayPalCheckoutButton({
  negotiationId,
  currency,
  existingPaymentId,
  onSuccess,
  onStatusChange,
}: {
  negotiationId: string;
  currency: string;
  existingPaymentId?: string | null;
  onSuccess: () => void;
  onStatusChange?: (state: { status: 'capturing' | 'cancelled' | 'error'; message?: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paymentIdRef = useRef<string | null>(existingPaymentId ?? null);
  const [sdkState, setSdkState] = useState<'loading' | 'ready' | 'unconfigured' | 'error'>('loading');
  const [sdkError, setSdkError] = useState<string | null>(null);

  useEffect(() => {
    paymentIdRef.current = existingPaymentId ?? null;
  }, [existingPaymentId]);

  useEffect(() => {
    let active = true;
    let instance: PayPalButtonsInstance | null = null;

    async function mount() {
      setSdkState('loading');
      setSdkError(null);
      try {
        const config = await api.get<PayPalPublicConfig>('/api/public/config');
        if (!active) return;

        const clientId = config.paypal?.clientId;
        if (!config.paypal?.configured || !clientId) {
          setSdkState('unconfigured');
          return;
        }

        const paypal = await loadPayPalSdk(clientId, currency);
        if (!active || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        instance = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'paypal', height: 42 },
          createOrder: async () => {
            const response = await api.post<PaymentResponse>(`/api/payments/deals/${encodeURIComponent(negotiationId)}`, {
              origin: window.location.origin,
            });
            paymentIdRef.current = response.payment.id;
            if (!response.payment.providerOrderId) {
              throw new Error('Backend did not return a PayPal order ID.');
            }
            return response.payment.providerOrderId;
          },
          onApprove: async () => {
            if (!paymentIdRef.current) {
              throw new Error('Missing local payment reference for capture.');
            }
            onStatusChange?.({ status: 'capturing' });
            await api.post(`/api/payments/${encodeURIComponent(paymentIdRef.current)}/capture`);
            onSuccess();
          },
          onCancel: () => {
            onStatusChange?.({
              status: 'cancelled',
              message: 'PayPal checkout was cancelled before approval. No funds were captured.',
            });
          },
          onError: (err) => {
            onStatusChange?.({
              status: 'error',
              message: err instanceof Error ? err.message : errorMessage(err),
            });
          },
        });

        await instance.render(containerRef.current);
        if (active) setSdkState('ready');
      } catch (err) {
        if (!active) return;
        setSdkError(errorMessage(err));
        setSdkState('error');
      }
    }

    void mount();

    return () => {
      active = false;
      if (instance?.close) {
        void instance.close().catch(() => undefined);
      }
    };
  }, [negotiationId, currency, onSuccess, onStatusChange]);

  if (sdkState === 'unconfigured') {
    return (
      <InlineNotice tone="warning" title="PayPal Sandbox not configured">
        Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the server environment to render the PayPal Checkout button.
      </InlineNotice>
    );
  }

  return (
    <div className="space-y-2">
      {sdkState === 'loading' && <Spinner label="Loading PayPal Checkout" />}
      {sdkState === 'error' && sdkError && (
        <InlineNotice tone="warning" title="PayPal SDK unavailable">
          {sdkError}
        </InlineNotice>
      )}
      <div ref={containerRef} className="min-h-[46px]" />
    </div>
  );
}

