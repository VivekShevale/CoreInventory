import React, { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import { ArrowDownCircle, ArrowUpCircle, Filter } from 'lucide-react';
import api from '../../configs/api';
import { Table, SearchBar, Btn, LoadingSpinner, PageHeader } from '../../components/ui';
import FilterDrawer from '../../components/FilterDrawer';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDateTime } from '../../lib/utils';

export default function MoveHistoryPage() {
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const tableRef = useRef(null);

  const fetchMoves = async (params = {}) => {
    setLoading(true);
    try {
      const res = await api.get('/api/move-history/', { params });
      setMoves(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMoves(filters); }, [filters]);

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

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          {row.move_type === 'in' || row.move_type === 'adjustment'
            ? <ArrowDownCircle size={14} className="text-emerald-500 flex-shrink-0" />
            : <ArrowUpCircle size={14} className="text-red-400 flex-shrink-0" />
          }
          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{v}</span>
        </div>
      )
    },
    {
      key: 'date',
      label: 'Date',
      render: (v) => <span className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(v)}</span>
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (v) => <span>{v || '—'}</span>
    },
    {
      key: 'from_code',
      label: 'From',
      render: (v, row) => (
        <span className={`font-medium text-sm ${row.move_type === 'out' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {row.from_location || 'Vendor'}
        </span>
      )
    },
    {
      key: 'to_code',
      label: 'To',
      render: (v, row) => (
        <span className={`font-medium text-sm ${row.move_type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {row.to_location || 'Vendor'}
        </span>
      )
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (v, row) => (
        <span className={`font-bold text-sm ${row.move_type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {row.move_type === 'in' ? '+' : '-'}{v}
        </span>
      )
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
        <SearchBar value={search} onChange={setSearch} placeholder="Search reference, contact, product..." />
        <Btn variant="secondary" size="sm" onClick={() => setFilterOpen(true)}>
          <Filter size={14} /> Filter
        </Btn>
      </PageHeader>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <ArrowDownCircle size={13} /> Incoming (green)
        </span>
        <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
          <ArrowUpCircle size={13} /> Outgoing (red)
        </span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div ref={tableRef}>
          <Table
            columns={columns}
            data={filtered}
            emptyText="No stock movements found."
          />
          <p className="text-xs text-slate-400 mt-3 text-right">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
      />
    </div>
  );
}
