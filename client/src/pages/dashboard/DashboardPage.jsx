import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  Package, TrendingDown, AlertTriangle, PackageCheck,
  Truck, ArrowLeftRight, Clock, CheckCheck, Hourglass,
  ZapIcon
} from 'lucide-react';
import { fetchDashboardStats } from '../../store/slices/dashboardSlice';
import { KpiCard, LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';

function OpBlock({ title, icon: Icon, color, items, onClick }) {
  const colors = {
    indigo: { 
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
      light: 'bg-blue-50 dark:bg-blue-500/10', 
      text: 'text-blue-600 dark:text-blue-400', 
      border: 'border-blue-100 dark:border-blue-900/50' 
    },
    emerald: { 
      bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', 
      light: 'bg-emerald-50 dark:bg-emerald-500/10', 
      text: 'text-emerald-600 dark:text-emerald-400', 
      border: 'border-emerald-100 dark:border-emerald-900/50' 
    },
    amber: { 
      bg: 'bg-gradient-to-br from-amber-500 to-amber-600', 
      light: 'bg-amber-50 dark:bg-amber-500/10', 
      text: 'text-amber-600 dark:text-amber-400', 
      border: 'border-amber-100 dark:border-amber-900/50' 
    },
    red: { 
      bg: 'bg-gradient-to-br from-red-500 to-red-600', 
      light: 'bg-red-50 dark:bg-red-500/10', 
      text: 'text-red-600 dark:text-red-400', 
      border: 'border-red-100 dark:border-red-900/50' 
    },
    blue: { 
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
      light: 'bg-blue-50 dark:bg-blue-500/10', 
      text: 'text-blue-600 dark:text-blue-400', 
      border: 'border-blue-100 dark:border-blue-900/50' 
    },
  };
  const c = colors[color] || colors.indigo;
  
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon size={18} className="text-white" />
          </div>
          <h3 className="font-medium text-zinc-900 dark:text-white text-base">{title}</h3>
        </div>
        <ZapIcon className={`size-4 ${c.text}`} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={i} className={`rounded-lg ${c.light} border ${c.border} p-3 text-center`}>
            <p className={`text-2xl font-bold ${c.text}`}>{item.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">{item.label}</p>
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

  // Status color mapping (from ProjectDetail)
  const getStatusColor = (status) => {
    const colors = {
      PLANNING: "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200",
      ACTIVE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-900",
      ON_HOLD: "bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-900",
      COMPLETED: "bg-blue-200 text-blue-900 dark:bg-blue-500 dark:text-blue-900",
      CANCELLED: "bg-red-200 text-red-900 dark:bg-red-500 dark:text-red-900",
    };
    return colors[status] || "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200";
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />
      
      {/* Header - matching Dashboard style */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white mb-1">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Real-time snapshot of your inventory operations</p>
        </div>
        
        {/* Optional: Add a quick action button if needed */}
        {/* <button className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">
          <Package size={16} /> Quick Action
        </button> */}
      </div>

      {/* KPIs - matching StatsGrid style */}
      <div ref={kpiRef} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Total Products" value={s.total_products} icon={Package} color="blue" />
        <KpiCard title="Low Stock" value={s.low_stock} icon={TrendingDown} color="amber" />
        <KpiCard title="Out of Stock" value={s.out_of_stock} icon={AlertTriangle} color="red" />
        <KpiCard title="Pending Receipts" value={s.pending_receipts} icon={PackageCheck} color="blue" onClick={() => navigate('/receipts')} />
        <KpiCard title="Pending Deliveries" value={s.pending_deliveries} icon={Truck} color="emerald" onClick={() => navigate('/delivery')} />
      </div>

      {/* Internal Transfers card - matching ProjectDetail info cards style */}
      <div className="grid grid-cols-1 sm:flex flex-wrap gap-6">
        <div className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between sm:min-w-60 p-4 py-2.5 rounded w-full">
          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Internal Transfers Scheduled</div>
            <div className={`text-2xl font-bold text-blue-600 dark:text-blue-400`}>{s.internal_transfers || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">Active transfers between locations</div>
          </div>
          <ArrowLeftRight className="size-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {/* Operation Blocks */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Operations Overview</h2>
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
      </div>

      {/* Legend - matching TasksSummary style */}
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <span className="flex items-center gap-1.5">
          <Clock size={12} className="text-red-500 dark:text-red-400" /> 
          <span><b className="text-zinc-700 dark:text-zinc-300">Late</b> = scheduled date &lt; today</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCheck size={12} className="text-blue-500 dark:text-blue-400" /> 
          <span><b className="text-zinc-700 dark:text-zinc-300">Scheduled</b> = scheduled date &gt; today</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Hourglass size={12} className="text-amber-500 dark:text-amber-400" /> 
          <span><b className="text-zinc-700 dark:text-zinc-300">Waiting</b> = waiting for stock availability</span>
        </span>
      </div>
    </div>
  );
}