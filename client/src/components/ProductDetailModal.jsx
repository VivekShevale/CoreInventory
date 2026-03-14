import React, { useEffect, useState } from 'react';
import { Package, MapPin, Warehouse, TrendingDown, AlertTriangle, X, Tag, Ruler, IndianRupee, BarChart3 } from 'lucide-react';
import api from '../configs/api';
import { formatCurrency } from '../lib/utils';

function DistributionBar({ distribution, total }) {
  if (!distribution.length || !total) return null;
  const colors = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-violet-500', 'bg-cyan-500', 'bg-rose-500',
  ];
  return (
    <div className="mt-3">
      <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
        {distribution.map((d, i) => (
          <div
            key={d.location_id}
            className={`${colors[i % colors.length]} transition-all`}
            style={{ width: `${(d.quantity / total) * 100}%` }}
            title={`${d.location_name}: ${d.quantity}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {distribution.map((d, i) => (
          <div key={d.location_id} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
            {d.location_name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductDetailModal({ productId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    api.get(`/api/products/${productId}/stock-distribution`)
      .then(r => setData(r.data))
      .catch(() => onClose())
      .finally(() => setLoading(false));
  }, [productId]);

  if (!productId) return null;

  const p = data?.product;
  const distribution = data?.distribution || [];
  const totalStock = data?.total_stock || 0;
  const totalValue = data?.total_value || 0;
  const isOut = totalStock === 0;
  const isLow = !isOut && p && totalStock <= p.reorder_point && p.reorder_point > 0;

  // Group distribution by warehouse
  const byWarehouse = distribution.reduce((acc, d) => {
    const key = d.warehouse_id;
    if (!acc[key]) acc[key] = { name: d.warehouse_name, code: d.warehouse_code, locations: [] };
    acc[key].locations.push(d);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {p?.image_url
                ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                : <Package size={18} className="text-indigo-600 dark:text-indigo-400" />
              }
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                {loading ? 'Loading...' : p?.name}
              </h2>
              {p && (
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">[{p.sku}]</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status banner */}
              {isOut && (
                <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">This product is out of stock</p>
                </div>
              )}
              {isLow && (
                <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                  <TrendingDown size={15} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Low stock — {totalStock} units remaining (reorder point: {p.reorder_point})
                  </p>
                </div>
              )}

              {/* Product info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Tag size={12} className="text-slate-400" />
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Category</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.category_name || '—'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Ruler size={12} className="text-slate-400" />
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Unit</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white capitalize">{p.unit_of_measure}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <IndianRupee size={12} className="text-slate-400" />
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Cost Price</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{formatCurrency(p.cost_price)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown size={12} className="text-slate-400" />
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Reorder At</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.reorder_point}</p>
                </div>
              </div>

              {/* Stock summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl p-4 border ${isOut ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : isLow ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'}`}>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Total On Hand</p>
                  <p className={`text-2xl font-bold ${isOut ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {totalStock}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{p.unit_of_measure}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Free to Use</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{p.free_to_use}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Uncommitted</p>
                </div>
                <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Total Value</p>
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(totalValue)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">At cost price</p>
                </div>
              </div>

              {/* Stock distribution */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={15} className="text-slate-500 dark:text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Stock Distribution by Location</h3>
                </div>

                {distribution.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-sm text-slate-400">No stock at any location</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Visual bar */}
                    <DistributionBar distribution={distribution} total={totalStock} />

                    {/* Warehouse groups */}
                    {Object.values(byWarehouse).map(wh => (
                      <div key={wh.code} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800">
                          <Warehouse size={13} className="text-slate-500 dark:text-slate-400" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{wh.name}</span>
                          <span className="text-xs font-mono text-slate-400">({wh.code})</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Location</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Qty</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Value</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wh.locations.map(loc => (
                              <tr key={loc.location_id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{loc.location_name}</span>
                                    <span className="text-xs font-mono text-slate-400">({loc.location_code})</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-white">
                                  {loc.quantity}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 text-xs">
                                  {formatCurrency(loc.value)}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="w-12 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                      <div
                                        className="bg-indigo-500 h-1.5 rounded-full"
                                        style={{ width: `${totalStock ? (loc.quantity / totalStock) * 100 : 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-400 w-8 text-right">
                                      {totalStock ? Math.round((loc.quantity / totalStock) * 100) : 0}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
