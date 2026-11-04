import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { CATEGORIES, formatMoney } from '@bhavai/shared';
import { Badge, Button, Card, EmptyState, Field, InlineNotice, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { ErrorNotice } from '../../components/Feedback';
import { ProductArt } from '../../components/ProductArt';
import { useAsync, useDocumentTitle } from '../../lib/useAsync';
import { api, errorMessage, queryString } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { CsvImportResult, CsvPreview, Product, ProductListResult } from '../../lib/types';

type StatusFilter = 'all' | 'active' | 'inactive' | 'out';

const emptyForm = {
  name: '',
  description: '',
  sku: '',
  category: CATEGORIES[0] as string,
  listedPrice: '',
  stock: '',
  unit: 'piece',
  countryOfOrigin: 'IN',
  images: '',
  active: true,
};

export function SellerProducts() {
  useDocumentTitle('Products');
  const { me } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useAsync<ProductListResult>(
    () => api.get(`/api/products${queryString({ search, status: status === 'all' ? undefined : status, pageSize: 100 })}`),
    [search, status],
  );

  const rows = products.data?.products ?? [];
  const currency = me?.seller?.currency ?? 'USD';

  const toggleActive = async (product: Product) => {
    setError(null);
    try {
      await api.patch(`/api/products/${product.id}`, { active: !product.active });
      toast(product.active ? 'Product deactivated.' : 'Product activated.', 'success');
      products.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const remove = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? Products with negotiation history are deactivated instead.`)) return;
    setError(null);
    try {
      const result = await api.delete<{ deleted: boolean; deactivated: boolean; message: string }>(`/api/products/${product.id}`);
      toast(result.message, result.deactivated ? 'info' : 'success');
      products.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description={`Everything here is priced in ${currency}. Adding a product creates conservative default negotiation rules that you should review.`}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setCsvOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" /> Add product
            </Button>
          </>
        }
      />

      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search products</span>
          <input
            className="field pl-9"
            placeholder="Search name or SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest/35" aria-hidden />
        </label>
        <Tabs
          label="Filter products"
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'all', label: 'All', count: products.data?.total },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Hidden' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
      </div>

      {products.loading && <Spinner label="Loading catalog" />}

      {!products.loading && rows.length === 0 && (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={search || status !== 'all' ? 'No products match that filter' : 'Your catalog is empty'}
          description={
            search || status !== 'all'
              ? 'Clear the search or choose another status filter.'
              : 'Add your first product or import a CSV. A product needs a SKU, price, stock and category.'
          }
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" /> Add product
            </Button>
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((product) => (
          <Card key={product.id} className="overflow-hidden p-0">
            <div className="relative">
              <ProductArt name={product.name} category={product.category} images={product.images} className="h-40 rounded-none" />
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {!product.active && <Badge tone="outline">Hidden</Badge>}
                {product.stock === 0 && <Badge tone="amber">Out of stock</Badge>}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-forest">{product.name}</h2>
                  <p className="mt-0.5 text-[0.68rem] text-forest/45">
                    {product.sku} · {product.category}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-forest">{formatMoney(product.listedPrice, product.currency)}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.68rem] text-forest/50">
                <span>{product.stock} {product.unit}s in stock</span>
                <span className="divider-dot" />
                <span>{product.active ? 'Visible' : 'Hidden from market'}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-forest/10 pt-3">
                <Button size="sm" variant="secondary" onClick={() => setEditing(product)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Link to={`/seller/rules?product=${product.id}`} className="btn btn-ghost btn-sm">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Rules
                </Link>
                <Button size="sm" variant="ghost" onClick={() => void toggleActive(product)}>
                  {product.active ? 'Hide' : 'Publish'}
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-[#8a5a22]" onClick={() => void remove(product)} aria-label={`Delete ${product.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ProductModal
        open={editing !== null}
        product={editing === 'new' ? null : editing}
        currency={currency}
        country={me?.seller?.country ?? 'IN'}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          products.reload();
        }}
      />

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} onImported={() => products.reload()} />
    </div>
  );
}

function ProductModal({
  open,
  product,
  currency,
  country,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  currency: string;
  country: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...emptyForm, countryOfOrigin: country });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState<string | null>(null);

  const key = product?.id ?? 'new';
  if (open && initialised !== key) {
    setInitialised(key);
    setForm(
      product
        ? {
            name: product.name,
            description: product.description,
            sku: product.sku,
            category: product.category,
            listedPrice: String(product.listedPrice),
            stock: String(product.stock),
            unit: product.unit,
            countryOfOrigin: product.countryOfOrigin,
            images: product.images.join(', '),
            active: product.active,
          }
        : { ...emptyForm, countryOfOrigin: country },
    );
    setError(null);
  }
  if (!open && initialised !== null) setInitialised(null);

  const set = (field: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      sku: form.sku,
      category: form.category,
      listedPrice: Number(form.listedPrice),
      currency,
      stock: Number(form.stock),
      unit: form.unit,
      countryOfOrigin: form.countryOfOrigin,
      images: form.images
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      active: form.active,
    };
    try {
      if (product) await api.patch(`/api/products/${product.id}`, payload);
      else await api.post('/api/products', payload);
      toast(product ? 'Product updated.' : 'Product created with default negotiation rules.', 'success');
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Edit product' : 'Add a product'}
      description={product ? `Priced in ${currency}. Existing negotiation history stays intact.` : `Priced in ${currency}. Default rules are created for you to review.`}
      wide
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="product-name">
            <input id="product-name" className="field" value={form.name} onChange={(event) => set('name', event.target.value)} required minLength={2} />
          </Field>
          <Field label="SKU" htmlFor="product-sku" hint="Letters, numbers, dot, underscore or hyphen.">
            <input id="product-sku" className="field" value={form.sku} onChange={(event) => set('sku', event.target.value.toUpperCase())} required minLength={2} />
          </Field>
        </div>
        <Field label="Description" htmlFor="product-description">
          <textarea
            id="product-description"
            className="field min-h-[88px] resize-y"
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={4000}
            placeholder="Materials, dimensions, care and what makes this piece useful to a buyer."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" htmlFor="product-category">
            <select id="product-category" className="field" value={form.category} onChange={(event) => set('category', event.target.value)}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Listed price (${currency})`} htmlFor="product-price">
            <input
              id="product-price"
              type="number"
              step="0.01"
              min="0.01"
              className="field"
              value={form.listedPrice}
              onChange={(event) => set('listedPrice', event.target.value)}
              required
            />
          </Field>
          <Field label="Stock" htmlFor="product-stock">
            <input
              id="product-stock"
              type="number"
              min="0"
              step="1"
              className="field"
              value={form.stock}
              onChange={(event) => set('stock', event.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Unit" htmlFor="product-unit">
            <input id="product-unit" className="field" value={form.unit} onChange={(event) => set('unit', event.target.value)} placeholder="piece" />
          </Field>
          <Field label="Country of origin" htmlFor="product-origin">
            <input
              id="product-origin"
              className="field"
              value={form.countryOfOrigin}
              onChange={(event) => set('countryOfOrigin', event.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
            />
          </Field>
          <Field label="Active" htmlFor="product-active" hint="Hidden products are not searchable.">
            <select id="product-active" className="field" value={form.active ? 'true' : 'false'} onChange={(event) => set('active', event.target.value === 'true')}>
              <option value="true">Visible in market</option>
              <option value="false">Hidden</option>
            </select>
          </Field>
        </div>
        <Field label="Image URLs (optional)" htmlFor="product-images" hint="Comma-separated. Leave blank to use the generated product illustration.">
          <input id="product-images" className="field" value={form.images} onChange={(event) => set('images', event.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-2 border-t border-forest/10 pt-4">
          <Button type="submit" loading={saving}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const csvFields = [
  { value: 'name', label: 'Product name' },
  { value: 'sku', label: 'SKU' },
  { value: 'listedPrice', label: 'Listed price' },
  { value: 'stock', label: 'Stock' },
  { value: 'category', label: 'Category' },
  { value: 'description', label: 'Description' },
  { value: 'unit', label: 'Unit' },
  { value: 'countryOfOrigin', label: 'Country of origin' },
  { value: 'images', label: 'Image URLs' },
  { value: 'currency', label: 'Currency' },
  { value: 'active', label: 'Active' },
];

function CsvImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { toast } = useToast();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<CsvImportResult | null>(null);

  const reset = () => {
    setCsv('');
    setFileName('');
    setPreview(null);
    setMapping({});
    setError(null);
    setImported(null);
  };

  const choose = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setImported(null);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setBusy('preview');
    try {
      const result = await api.post<CsvPreview>('/api/products/import/preview', { csv: text });
      setPreview(result);
      setMapping(result.suggestedMapping ?? {});
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const validateMapping = async () => {
    setBusy('mapping');
    setError(null);
    try {
      const result = await api.post<CsvPreview>('/api/products/import/preview', { csv, mapping });
      setPreview(result);
      toast(`${result.validCount} of ${result.totalRows} rows are valid.`, result.validCount === result.totalRows ? 'success' : 'info');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    setError(null);
    try {
      const result = await api.post<CsvImportResult>('/api/products/import', { csv, mapping });
      setImported(result);
      toast(result.imported > 0 ? `${result.imported} products imported.` : 'No products were imported.', result.imported > 0 ? 'success' : 'info');
      onImported();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const headerRows = useMemo(() => preview?.headers ?? [], [preview]);

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import products from CSV"
      description="Preview first. BhavAI maps columns explicitly and rejects rows that fail validation."
      wide
    >
      <div className="space-y-4">
        {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}

        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-secondary btn-sm cursor-pointer">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void choose(event.target.files?.[0] ?? null)}
            />
          </label>
          <a href="/api/products/import/template" className="btn btn-ghost btn-sm" download>
            <Download className="h-3.5 w-3.5" /> Template
          </a>
          {fileName && <span className="text-xs text-forest/55">{fileName}</span>}
        </div>

        {busy === 'preview' && <Spinner label="Reading CSV" />}

        {preview && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-pale/60 px-3 py-2">
                <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Rows</p>
                <p className="mt-0.5 text-sm font-semibold text-forest">{preview.totalRows}</p>
              </div>
              <div className="rounded-lg bg-pale/60 px-3 py-2">
                <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Valid</p>
                <p className="mt-0.5 text-sm font-semibold text-forest">{preview.validCount}</p>
              </div>
              <div className="rounded-lg bg-pale/60 px-3 py-2">
                <p className="text-[0.62rem] uppercase tracking-[0.1em] text-forest/45">Issues</p>
                <p className="mt-0.5 text-sm font-semibold text-forest">{preview.errors.length + preview.duplicateSkus.length}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-forest">Column mapping</p>
                <Button size="sm" variant="ghost" loading={busy === 'mapping'} onClick={() => void validateMapping()}>
                  Validate mapping
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {headerRows.map((header) => (
                  <label key={header} className="flex items-center gap-2 rounded-lg border border-forest/10 px-2.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-[0.7rem] text-forest/60">{header}</span>
                    <select
                      className="field min-h-0 w-auto py-1 text-xs"
                      value={mapping[header] ?? ''}
                      onChange={(event) =>
                        setMapping((current) => {
                          const next = { ...current };
                          if (event.target.value) next[header] = event.target.value;
                          else delete next[header];
                          return next;
                        })
                      }
                      aria-label={`Map ${header}`}
                    >
                      <option value="">Ignore</option>
                      {csvFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[#d99a55]/40 bg-[#fbf3e8] p-3">
                <p className="text-[0.68rem] font-semibold text-[#6b3a12]">Rows that will be skipped</p>
                <ul className="mt-1.5 space-y-1">
                  {preview.errors.slice(0, 30).map((issue, index) => (
                    <li key={`${issue.row}-${issue.field}-${index}`} className="text-[0.66rem] text-[#6b3a12]/80">
                      Row {issue.row} · {issue.field}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.duplicateSkus.length > 0 && (
              <InlineNotice tone="warning" title="Duplicate SKUs">
                {preview.duplicateSkus.join(', ')} appear more than once. Only the first valid row for each SKU is imported.
              </InlineNotice>
            )}

            {imported && (
              <InlineNotice tone={imported.imported > 0 ? 'success' : 'warning'} title="Import result">
                {imported.imported} imported, {imported.skipped} skipped.
                {imported.errors.length > 0 ? ` ${imported.errors.length} row issues reported.` : ''}
              </InlineNotice>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-forest/10 pt-4">
              <Button loading={busy === 'import'} onClick={() => void doImport()} disabled={Object.keys(mapping).length === 0}>
                <Upload className="h-3.5 w-3.5" /> Import {preview.validCount} valid rows
              </Button>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
            </div>
          </>
        )}

        {!preview && busy !== 'preview' && (
          <InlineNotice tone="info">
            Use the template or your own CSV. The preview is computed by the API and no product is written until you import.
          </InlineNotice>
        )}
      </div>
    </Modal>
  );
}
