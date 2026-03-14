import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Plus, LayoutList, Kanban, Filter } from 'lucide-react';
import api from '../../configs/api';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWarehouses } from '../../store/slices/warehouseSlice';
import { Table, KanbanBoard, Btn, StatusBadge, SearchBar, LoadingSpinner, PageHeader } from '../../components/ui';
import FilterDrawer from '../../components/FilterDrawer';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDate } from '../../lib/utils';

export default function TransferPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { warehouses } = useSelector(s => s.warehouse);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const tableRef = useRef(null);

  const fetchAll = async (params = {}) => {
    setLoading(true);
    try {
      const res = await api.get('/api/transfers/', { params });
      setList(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAll(filters);
    dispatch(fetchWarehouses());
  }, [filters]);

  useEffect(() => {
    if (!loading && tableRef.current) {
      gsap.fromTo(tableRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }, [loading, view]);

  const filtered = list.filter(r =>
    !search || r.reference?.toLowerCase().includes(search.toLowerCase()) ||
    r.contact?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: v => <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">{v}</span>
    },
    {
      key: 'from_code',
      label: 'From',
      render: (_, row) => <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{row.from_code || '—'}</span>
    },
    {
      key: 'to_code',
      label: 'To',
      render: (_, row) => <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{row.to_code || '—'}</span>
    },
    {
      key: 'responsible_name',
      label: 'Responsible',
      render: v => <span className="text-slate-500 dark:text-slate-400 text-xs">{v || '—'}</span>
    },
    {
      key: 'scheduled_date',
      label: 'Scheduled Date',
      render: v => <span className="text-slate-500 text-xs">{formatDate(v)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: v => <StatusBadge status={v} />
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Internal Transfers">
        <SearchBar value={search} onChange={setSearch} placeholder="Search reference..." />
        <Btn variant="secondary" size="sm" onClick={() => setFilterOpen(true)}>
          <Filter size={14} /> Filter
        </Btn>
        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <LayoutList size={14} /> List
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'kanban' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Kanban size={14} /> Kanban
          </button>
        </div>
        <Btn
          onClick={() => navigate('/transfers/new')}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus size={16} /> New Transfer
        </Btn>
      </PageHeader>

      {loading ? <LoadingSpinner /> : (
        <div ref={tableRef}>
          {view === 'list' ? (
            <Table
              columns={columns}
              data={filtered}
              onRowClick={row => navigate(`/transfers/${row.id}`)}
              emptyText="No internal transfers found. Create your first transfer."
            />
          ) : (
            <KanbanBoard items={filtered} onCardClick={row => navigate(`/transfers/${row.id}`)} />
          )}
        </div>
      )}

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={f => { setFilters(f); fetchAll(f); }}
        warehouses={warehouses}
      />
    </div>
  );
}
