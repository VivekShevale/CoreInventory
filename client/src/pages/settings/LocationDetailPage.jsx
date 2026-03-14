import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ArrowLeft, MapPin, Package, TrendingDown, AlertTriangle, IndianRupee } from 'lucide-react';
import api from '../../configs/api';
import { LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { formatCurrency } from '../../lib/utils';

export default function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    api.get(`/api/locations/${id}/stock`)
      .then(r => setData(r.data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && data) {
      gsap.fromTo(headerRef.current, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
      gsap.fromTo(tableRef.current, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: 0.15, ease: 'power2.out' });
    }
  }, [loading, data]);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const { location, products, total_products, total_stock_value } = data;
  const lowCount = products.filter(p => p.is_low_stock).length;
  const outCount = products.filter(p => p.is_out_of_stock).length;

  return (
    <div>
      <Breadcrumb
        extra={[
          { label: 'Locations', path: '/settings/locations' },
          { label: location.name, isLast: true },
        ]}
      />

      {/* Header */}
      <div ref={headerRef} className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <MapPin size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{location.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{location.short_code}</span>
              <span className="mx-2">·</span>
              {location.warehouse_name}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
              <Package size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Products</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{total_products}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <IndianRupee size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Stock Value</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(total_stock_value)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <TrendingDown size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Low Stock</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{lowCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Out of Stock</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{outCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div ref={tableRef}>
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Package size={36} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">No products at this location</p>
            <p className="text-sm text-slate-400 mt-1">Receive goods or transfer stock to populate this location.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">UOM</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost Price</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Free to Use</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr
                    key={p.product_id}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors
                      ${p.is_out_of_stock ? 'bg-red-50/40 dark:bg-red-900/5' : p.is_low_stock ? 'bg-amber-50/40 dark:bg-amber-900/5' : 'bg-white dark:bg-slate-900'}`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-white">{p.product_name}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        {p.sku}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{p.category || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs capitalize">{p.unit_of_measure}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(p.cost_price)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800 dark:text-white">{p.on_hand}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">{p.free_to_use}</td>
                    <td className="px-5 py-3.5 text-center">
                      {p.is_out_of_stock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <AlertTriangle size={10} /> Out of Stock
                        </span>
                      ) : p.is_low_stock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <TrendingDown size={10} /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
