import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SellerAnalytics } from './Analytics';
import { api } from '../../lib/api';

describe('SellerAnalytics', () => {
  it('renders without crashing on empty analytics workspace', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      analytics: {
        totals: {
          products: 0,
          activeProducts: 0,
          negotiationsToday: 0,
          negotiationsAllTime: 0,
          acceptedDeals: 0,
          totalSales: 0,
          pendingPayments: 0,
          averageDiscountPercent: 0,
          conversionRate: 0,
          orders: 0,
        },
        deltas: { negotiationsToday: 0, acceptedDeals: 0, totalSales: 0 },
        revenueSeries: [{ date: '2026-11-12', revenue: 0, orders: 0 }],
        negotiationSeries: [{ date: '2026-11-12', started: 0, agreed: 0 }],
        topProducts: [],
        markets: [{ market: 'DOMESTIC', count: 0, value: 0 }, { market: 'CROSS_BORDER', count: 0, value: 0 }],
        discounts: { bands: [{ label: 'No discount', count: 0 }], average: 0 },
        aiSummary: { text: 'No negotiations yet.', mode: 'POLICY', generatedAt: '2026-11-12T15:25:41.525Z' },
        includesSample: false,
      },
      negotiations: [],
      products: [],
      transactions: [],
      generatedAt: '2026-11-12T15:25:41.680Z',
      agentMode: 'POLICY',
      llmConfigured: false,
      currency: 'USD',
    });

    render(
      <MemoryRouter>
        <SellerAnalytics />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Performance from your own rows')).toBeInTheDocument();
    });
  });
});

