import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  Package, TrendingDown, AlertTriangle, PackageCheck,
  Truck, ArrowLeftRight, Clock, CheckCheck, Hourglass
} from 'lucide-react';
import { fetchDashboardStats } from '../../store/slices/dashboardSlice';
import { KpiCard, LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';

function OpBlock({ title, icon: Icon, color, items, onClick }) {
  const colors = {
    indigo: { bg: 'bg-indigo-600', light: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-100 dark:border-indigo-800' },
    emerald: { bg: 'bg-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 shadow-sm`}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={18} className="text-white" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-white text-base">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={i} className={`rounded-xl ${c.light} border ${c.border} p-3 text-center`}>
            <p className={`text-2xl font-bold ${c.text}`}>{item.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { stats, loading } = useSelector(s => s.dashboard);
  const kpiRef = useRef(null);
  const blocksRef = useRef(null);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  useEffect(() => {
    if (!stats) return;
    gsap.fromTo(
      kpiRef.current?.children,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
    );
    gsap.fromTo(
      blocksRef.current?.children,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.12, ease: 'power2.out', delay: 0.3 }
    );
  }, [stats]);

  if (loading && !stats) return <LoadingSpinner />;

  const s = stats || {};

  return (
    <div>
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time snapshot of your inventory operations</p>
      </div>

      {/* KPIs */}
      <div ref={kpiRef} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard title="Total Products" value={s.total_products} icon={Package} color="indigo" />
        <KpiCard title="Low Stock" value={s.low_stock} icon={TrendingDown} color="amber" />
        <KpiCard title="Out of Stock" value={s.out_of_stock} icon={AlertTriangle} color="red" />
        <KpiCard title="Pending Receipts" value={s.pending_receipts} icon={PackageCheck} color="blue" onClick={() => navigate('/receipts')} />
        <KpiCard title="Pending Deliveries" value={s.pending_deliveries} icon={Truck} color="emerald" onClick={() => navigate('/delivery')} />
      </div>

      {/* Internal Transfers row */}
      <div className="mb-6">
        <KpiCard
          title="Internal Transfers Scheduled"
          value={s.internal_transfers}
          icon={ArrowLeftRight}
          color="indigo"
          sub="Active transfers between locations"
        />
      </div>

      {/* Operation Blocks */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">Operations Overview</h2>
      <div ref={blocksRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OpBlock
          title="Receipts"
          icon={PackageCheck}
          color="indigo"
          onClick={() => navigate('/receipts')}
          items={[
            { label: 'To Receive', value: s.receipts?.to_receive ?? 0 },
            { label: 'Late', value: s.receipts?.late ?? 0 },
            { label: 'Scheduled', value: s.receipts?.operations ?? 0 },
          ]}
        />
        <OpBlock
          title="Delivery"
          icon={Truck}
          color="emerald"
          onClick={() => navigate('/delivery')}
          items={[
            { label: 'To Deliver', value: s.deliveries?.to_deliver ?? 0 },
            { label: 'Late', value: s.deliveries?.late ?? 0 },
            { label: 'Waiting', value: s.deliveries?.waiting ?? 0 },
          ]}
        />
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><Clock size={12} className="text-red-400" /> <b>Late</b> = scheduled date &lt; today</span>
        <span className="flex items-center gap-1.5"><CheckCheck size={12} className="text-blue-400" /> <b>Scheduled</b> = scheduled date &gt; today</span>
        <span className="flex items-center gap-1.5"><Hourglass size={12} className="text-amber-400" /> <b>Waiting</b> = waiting for stock availability</span>
      </div>
    </div>
  );
}
