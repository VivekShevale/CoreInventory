import React, { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, SlidersHorizontal, Filter, FileSpreadsheet } from 'lucide-react';
import api from '../../configs/api';
import { Table, SearchBar, Btn, LoadingSpinner, PageHeader, SelectField } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDateTime } from '../../lib/utils';
import { downloadExcel } from '../../lib/export';

const TYPE_ICONS = {
  in:         { icon: ArrowDownCircle,    color: 'text-emerald-500', sign: '+' },
  out:        { icon: ArrowUpCircle,      color: 'text-red-400',     sign: '-' },
  transfer:   { icon: ArrowLeftRight,     color: 'text-violet-500',  sign: '⇄' },
  adjustment: { icon: SlidersHorizontal, color: 'text-amber-500',   sign: '~' },
};

export default function MoveHistoryPage() {
  const [moves, setMoves] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const tableRef = useRef(null);

  const fetchMoves = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProduct) params.product_id = filterProduct;
      if (filterType) params.move_type = filterType;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      const res = await api.get('/api/move-history/', { params });
      setMoves(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/api/move-history/products').then(r => setProducts(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchMoves(); }, [filterProduct, filterType, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (!loading && tableRef.current) {
      gsap.fromTo(tableRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }, [loading]);

  const filtered = moves.filter(m =>
    !search ||
    m.reference?.toLowerCase().includes(search.toLowerCase()) ||
    m.contact?.toLowerCase().includes(search.toLowerCase()) ||
    m.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const headers = ['Date', 'Reference', 'Type', 'Product', 'Contact', 'From', 'To', 'Quantity', 'Status'];
    const rows = filtered.map(m => [
      formatDateTime(m.date),
      m.reference,
      m.move_type,
      m.product_name || '',
      m.contact || '',
      m.from_location || 'Vendor',
      m.to_location || 'Customer',
      m.quantity,
      m.status,
    ]);
    downloadExcel('move_history', headers, rows, 'Move History');
  };

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (v, row) => {
        const cfg = TYPE_ICONS[row.move_type] || TYPE_ICONS.in;
        const Icon = cfg.icon;
        return (
          <div className="flex items-center gap-2">
            <Icon size={14} className={`${cfg.color} flex-shrink-0`} />
            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{v}</span>
          </div>
        );
      }
    },
    {
      key: 'date',
      label: 'Date',
      render: v => <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(v)}</span>
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{v || '—'}</p>
          {row.product_sku && <p className="text-xs font-mono text-slate-400">[{row.product_sku}]</p>}
        </div>
      )
    },
    {
      key: 'contact',
      label: 'Contact',
      render: v => <span className="text-sm text-slate-600 dark:text-slate-300">{v || '—'}</span>
    },
    {
      key: 'from_code',
      label: 'From',
      render: (_, row) => (
        <span className={`font-medium text-sm ${row.move_type === 'out' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {row.from_location || 'Vendor'}
        </span>
      )
    },
    {
      key: 'to_code',
      label: 'To',
      render: (_, row) => (
        <span className={`font-medium text-sm ${row.move_type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {row.to_location || 'Customer'}
        </span>
      )
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (v, row) => {
        const cfg = TYPE_ICONS[row.move_type] || TYPE_ICONS.in;
        const isPositive = row.move_type === 'in' || (row.move_type === 'adjustment' && row.to_location_id);
        return (
          <span className={`font-bold text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {cfg.sign}{v}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
          Done
        </span>
      )
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Move History">
        <SearchBar value={search} onChange={setSearch} placeholder="Reference, contact, product..." />
        <Btn variant="secondary" size="sm" onClick={handleExport}>
          <FileSpreadsheet size={14} /> Export Excel
        </Btn>
      </PageHeader>

      {/* Filters row */}
      <div className="flex gap-3 mb-5 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Filter by Product</label>
          <select
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 min-w-44"
          >
            <option value="">All Products</option>
            {products.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Move Type</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Types</option>
            <option value="in">Receipt (In)</option>
            <option value="out">Delivery (Out)</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">From Date</label>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">To Date</label>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
        </div>
        {(filterProduct || filterType || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterProduct(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs flex-wrap">
        {Object.entries(TYPE_ICONS).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <span key={key} className={`flex items-center gap-1.5 ${cfg.color} capitalize`}>
              <Icon size={13} /> {key}
            </span>
          );
        })}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div ref={tableRef}>
          <Table columns={columns} data={filtered} emptyText="No stock movements found." />
          <p className="text-xs text-slate-400 mt-3 text-right">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
