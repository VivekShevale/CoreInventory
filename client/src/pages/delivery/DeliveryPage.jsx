import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, LayoutList, Kanban, Filter } from 'lucide-react';
import { fetchDeliveries } from '../../store/slices/deliverySlice';
import { fetchWarehouses } from '../../store/slices/warehouseSlice';
import { Table, KanbanBoard, Btn, StatusBadge, SearchBar, LoadingSpinner, PageHeader } from '../../components/ui';
import FilterDrawer from '../../components/FilterDrawer';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDate } from '../../lib/utils';

export default function DeliveryPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading } = useSelector(s => s.delivery);
  const { warehouses } = useSelector(s => s.warehouse);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const tableRef = useRef(null);

  useEffect(() => {
    dispatch(fetchDeliveries(filters));
    dispatch(fetchWarehouses());
  }, [dispatch, filters]);

  useEffect(() => {
    if (!loading && tableRef.current) {
      gsap.fromTo(tableRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }, [loading, view]);

  const filtered = list.filter(d =>
    !search || d.reference?.toLowerCase().includes(search.toLowerCase()) || d.contact?.toLowerCase().includes(search.toLowerCase())
  );

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const columns = [
    { key: 'reference', label: 'Reference', render: (v) => <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{v}</span> },
    { key: 'from_code', label: 'From', render: (_, row) => <span className="font-medium text-sm">{row.from_code || '—'}</span> },
    { key: 'to_code', label: 'To', render: (_, row) => <span className="text-slate-500 dark:text-slate-400 text-xs">Vendor</span> },
    { key: 'contact', label: 'Contact', render: (v) => <span className="text-slate-600 dark:text-slate-300">{v || '—'}</span> },
    { key: 'scheduled_date', label: 'Scheduled Date', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Delivery">
        <SearchBar value={search} onChange={setSearch} placeholder="Search reference, contact..." />
        <div className="relative">
          <Btn variant="secondary" size="sm" onClick={() => setFilterOpen(true)}>
            <Filter size={14} />
            Filter
            {activeFilters > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">{activeFilters}</span>
            )}
          </Btn>
        </div>
        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <LayoutList size={14} /> List
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'kanban' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Kanban size={14} /> Kanban
          </button>
        </div>
        <Btn variant="emerald" onClick={() => navigate('/delivery/new')}>
          <Plus size={16} /> New
        </Btn>
      </PageHeader>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div ref={tableRef}>
          {view === 'list' ? (
            <Table
              columns={columns}
              data={filtered}
              onRowClick={(row) => navigate(`/delivery/${row.id}`)}
              emptyText="No deliveries found. Create your first delivery."
            />
          ) : (
            <KanbanBoard items={filtered} onCardClick={(row) => navigate(`/delivery/${row.id}`)} />
          )}
        </div>
      )}

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={(f) => { setFilters(f); dispatch(fetchDeliveries(f)); }}
        warehouses={warehouses}
      />
    </div>
  );
}
