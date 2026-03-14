import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  ArrowLeft, Package, MapPin, Warehouse, TrendingDown, AlertTriangle,
  Tag, Ruler, IndianRupee, BarChart3, ArrowDownCircle, ArrowUpCircle,
  ArrowLeftRight, SlidersHorizontal, FileDown, FileSpreadsheet
} from 'lucide-react';
import api from '../../configs/api';
import { Btn, LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { downloadExcel } from '../../lib/export';

const TYPE_CONFIG = {
  in:         { icon: ArrowDownCircle,    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20', label: 'Receipt',    sign: '+' },
  out:        { icon: ArrowUpCircle,      color: 'text-red-500 dark:text-red-400',          bg: 'bg-red-100 dark:bg-red-900/20',         label: 'Delivery',   sign: '-' },
  transfer:   { icon: ArrowLeftRight,     color: 'text-violet-600 dark:text-violet-400',    bg: 'bg-violet-100 dark:bg-violet-900/20',   label: 'Transfer',   sign: '⇄' },
  adjustment: { icon: SlidersHorizontal, color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-100 dark:bg-amber-900/20',     label: 'Adjustment', sign: '~' },
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [distData, setDistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const headerRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/api/products/${id}/timeline`),
      api.get(`/api/products/${id}/stock-distribution`),
    ])
      .then(([tRes, dRes]) => { setData(tRes.data); setDistData(dRes.data); })
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && headerRef.current) {
      gsap.fromTo(headerRef.current, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
      if (timelineRef.current?.children.length) {
        gsap.fromTo(timelineRef.current.children,
          { x: -10, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.3, stagger: 0.04, ease: 'power2.out', delay: 0.2 }
        );
      }
    }
  }, [loading]);

  const handleExcel = () => {
    if (!data) return;
    const headers = ['Date', 'Reference', 'Type', 'From', 'To', 'Quantity', 'Balance', 'Contact'];
    const rows = data.events.map(e => [
      formatDateTime(e.date),
      e.reference,
      TYPE_CONFIG[e.move_type]?.label || e.move_type,
      e.from_location || 'Vendor',
      e.to_location || 'Customer',
      e.quantity,
      e.running_balance,
      e.contact || '',
    ]);
    downloadExcel(
      `${data.product.name}_history`,
      headers,
      rows,
      'Product History'
    );
  };

  const handlePDF = () => {
    window.print();
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const { product: p, events, summary } = data;
  const distribution = distData?.distribution || [];
  const isOut = summary.current_stock === 0;
  const isLow = !isOut && summary.current_stock <= p.reorder_point && p.reorder_point > 0;

  const byWarehouse = distribution.reduce((acc, d) => {
    if (!acc[d.warehouse_id]) acc[d.warehouse_id] = { name: d.warehouse_name, code: d.warehouse_code, locations: [] };
    acc[d.warehouse_id].locations.push(d);
    return acc;
  }, {});

  return (
    <div className="print:p-4">
      <div className="no-print">
        <Breadcrumb extra={[
          { label: 'Products', path: '/products' },
          { label: p.name, isLast: true },
        ]} />
      </div>

      {/* Header */}
      <div ref={headerRef} className="flex items-start gap-4 mb-6 flex-wrap">
        <button onClick={() => navigate(-1)} className="mt-1 w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all no-print">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {p.image_url
              ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              : <Package size={22} className="text-indigo-600 dark:text-indigo-400" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{p.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">[{p.sku}]</span>
              {p.category_name && <span className="text-xs text-slate-400">{p.category_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 no-print">
          <Btn variant="secondary" size="sm" onClick={handleExcel}>
            <FileSpreadsheet size={14} /> Export Excel
          </Btn>
          <Btn variant="secondary" size="sm" onClick={handlePDF}>
            <FileDown size={14} /> Print / PDF
          </Btn>
        </div>
      </div>

      {/* Status alert */}
      {isOut && (
        <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={15} className="text-red-500" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">This product is currently out of stock</p>
        </div>
      )}
      {isLow && (
        <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-4">
          <TrendingDown size={15} className="text-amber-500" />
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Low stock — {summary.current_stock} {p.unit_of_measure} remaining (reorder at {p.reorder_point})
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: info + distribution */}
        <div className="xl:col-span-1 space-y-5">
          {/* Product Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Product Details</h3>
            <div className="space-y-3">
              {[
                { icon: Tag, label: 'Category', value: p.category_name || '—' },
                { icon: Ruler, label: 'Unit of Measure', value: p.unit_of_measure },
                { icon: IndianRupee, label: 'Cost Price', value: formatCurrency(p.cost_price) },
                { icon: TrendingDown, label: 'Reorder Point', value: `${p.reorder_point} ${p.unit_of_measure}` },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <item.icon size={13} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stock Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Stock Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'On Hand', value: summary.current_stock, color: isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600' },
                { label: 'Free to Use', value: p.free_to_use, color: 'text-indigo-600 dark:text-indigo-400' },
                { label: 'Total Value', value: formatCurrency(summary.current_stock * p.cost_price), color: 'text-violet-600 dark:text-violet-400' },
                { label: 'Total Moves', value: summary.total_moves, color: 'text-slate-600 dark:text-slate-300' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lifetime Stats */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Lifetime Statistics</h3>
            <div className="space-y-2.5">
              {[
                { icon: ArrowDownCircle, label: 'Total Received', value: summary.total_received, color: 'text-emerald-600' },
                { icon: ArrowUpCircle,   label: 'Total Delivered', value: summary.total_delivered, color: 'text-red-500' },
                { icon: ArrowLeftRight,  label: 'Total Transferred', value: summary.total_transferred, color: 'text-violet-600' },
                { icon: SlidersHorizontal, label: 'Total Adjusted', value: summary.total_adjusted, color: 'text-amber-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <item.icon size={14} className={item.color} />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stock distribution */}
          {distribution.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={14} className="text-slate-500" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Distribution</h3>
              </div>
              {Object.values(byWarehouse).map(wh => (
                <div key={wh.code} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Warehouse size={12} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{wh.name}</span>
                  </div>
                  {wh.locations.map(loc => (
                    <div key={loc.location_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">{loc.location_name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{loc.quantity}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Timeline */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Movement History
                <span className="ml-2 text-xs font-normal text-slate-400">({events.length} events)</span>
              </h3>
              <div className="flex gap-2 text-xs">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <div key={key} className={`flex items-center gap-1 ${cfg.color}`}>
                    <cfg.icon size={11} /> {cfg.label}
                  </div>
                ))}
              </div>
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">No movement history yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">From → To</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Balance</th>
                    </tr>
                  </thead>
                  <tbody ref={timelineRef}>
                    {events.map((e, i) => {
                      const cfg = TYPE_CONFIG[e.move_type] || TYPE_CONFIG.adjustment;
                      const Icon = cfg.icon;
                      return (
                        <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDateTime(e.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{e.reference}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                              <Icon size={11} /> {cfg.label}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-40">
                            <div className="truncate">
                              {e.from_location || 'Vendor'} → {e.to_location || 'Customer'}
                            </div>
                            {e.contact && (
                              <div className="text-xs text-slate-400 truncate mt-0.5">{e.contact}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${cfg.color}`}>
                              {cfg.sign}{e.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                              {e.running_balance}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
