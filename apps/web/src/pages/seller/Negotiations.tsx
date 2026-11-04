import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Handshake, Search } from 'lucide-react';
import { formatMoney } from '@bhavai/shared';
import { Badge, EmptyState, PageHeader, Spinner, Tabs } from '../../components/ui';
import { ErrorNotice } from '../../components/Feedback';
import { MarketBadge, NegotiationStatusBadge, SampleBadge } from '../../components/StatusBadge';
import { NegotiationRoom } from '../../components/NegotiationRoom';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api, queryString } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { NegotiationDetailView, NegotiationListResult } from '../../lib/types';

type StatusTab = 'ALL' | 'OPEN' | 'AWAITING_APPROVAL' | 'AGREED' | 'REJECTED';

export function SellerNegotiations() {
  useDocumentTitle('Negotiations');
  const [status, setStatus] = useState<StatusTab>('ALL');
  const [search, setSearch] = useState('');
  const list = useAsync<NegotiationListResult>(
    () =>
      api.get(
        `/api/negotiations${queryString({ status: status === 'ALL' ? undefined : status, search, pageSize: 50 })}`,
      ),
    [status, search],
  );

  const rows = list.data?.negotiations ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deal flow"
        title="Negotiations"
        description="Every buyer-agent conversation on your catalog, with its policy state, current position and resulting order."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search negotiations</span>
          <input className="field pl-9" placeholder="Search product or buyer" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/35" aria-hidden />
        </label>
        <Tabs
          label="Filter negotiations"
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'ALL', label: 'All' },
            { value: 'OPEN', label: 'Open' },
            { value: 'AWAITING_APPROVAL', label: 'Approval' },
            { value: 'AGREED', label: 'Agreed' },
            { value: 'REJECTED', label: 'Closed' },
          ]}
        />
      </div>

      {list.loading && <Spinner label="Loading negotiations" />}
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}

      {!list.loading && rows.length === 0 && (
        <EmptyState
          icon={<Handshake className="h-5 w-5" />}
          title="No negotiations in this view"
          description="Buyer agents open negotiations from your published storefront or through the MCP tools. Sample data appears here when seeded."
        />
      )}

      <div className="space-y-2.5">
        {rows.map((negotiation) => (
          <Link
            key={negotiation.id}
            to={`/seller/negotiations/${negotiation.id}`}
            className="block rounded-2xl border border-forest/10 bg-white p-4 transition-colors hover:border-teal/30 hover:bg-pale/20"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-forest">{negotiation.productName}</h2>
                  {negotiation.isSample && <SampleBadge />}
                  <NegotiationStatusBadge status={negotiation.status} />
                  <MarketBadge market={negotiation.marketType} />
                </div>
                <p className="mt-1 text-xs text-forest/55">
                  {negotiation.buyerName} · {negotiation.quantity} units · {negotiation.roundsUsed} of {negotiation.maxRounds} rounds
                </p>
                <p className="mt-0.5 text-[0.66rem] text-forest/40">Updated {dateTime(negotiation.updatedAt)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-end gap-5 text-right sm:justify-end">
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.12em] text-forest/40">Current offer</p>
                  <p className="text-sm font-semibold text-forest">
                    {negotiation.currentOffer
                      ? formatMoney(negotiation.currentOffer.unitPrice, negotiation.currency)
                      : formatMoney(negotiation.listedPrice, negotiation.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.12em] text-forest/40">Listed</p>
                  <p className="text-sm font-medium text-forest/60">{formatMoney(negotiation.listedPrice, negotiation.currency)}</p>
                </div>
                {negotiation.agreedUnitPrice !== null && (
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.12em] text-forest/40">Agreed</p>
                    <p className="text-sm font-semibold text-teal-deep">{formatMoney(negotiation.agreedUnitPrice, negotiation.currency)}</p>
                  </div>
                )}
                <Badge tone="outline">
                  {negotiation.orderStatus ? `Order ${negotiation.orderStatus.toLowerCase().replace(/_/g, ' ')}` : 'No order yet'}
                </Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SellerNegotiationDetail() {
  const { id = '' } = useParams();
  useDocumentTitle('Negotiation detail');
  const detail = useAsync<{ negotiation: NegotiationDetailView }>(
    () => api.get(`/api/negotiations/${encodeURIComponent(id)}`),
    [id],
  );

  if (detail.loading) return <Spinner label="Loading negotiation" />;
  if (detail.error) {
    return (
      <div className="space-y-4">
        <Link to="/seller/negotiations" className="inline-flex items-center gap-1.5 text-xs font-medium text-forest/55 hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to negotiations
        </Link>
        <ErrorNotice error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }
  if (!detail.data) return null;

  return (
    <div className="space-y-4">
      <Link to="/seller/negotiations" className="inline-flex items-center gap-1.5 text-xs font-medium text-forest/55 hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to negotiations
      </Link>
      <NegotiationRoom negotiation={detail.data.negotiation} role="SELLER" onRefresh={detail.reload} />
    </div>
  );
}
