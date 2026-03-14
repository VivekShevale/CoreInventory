import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { gsap } from 'gsap';
import { TrendingDown, AlertTriangle, Edit3, Check, X } from 'lucide-react';
import { fetchStock, updateStock } from '../../store/slices/stockSlice';
import { fetchLocations } from '../../store/slices/warehouseSlice';
import { SearchBar, LoadingSpinner, PageHeader, SelectField } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { formatCurrency } from '../../lib/utils';
import api from '../../configs/api';

function EditableQty({ item, locationId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.on_hand);

  const save = async () => {
    await api.post('/api/stock/update', { product_id: item.product_id, location_id: locationId || 1, quantity: parseFloat(val) });
    onSave();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="w-20 text-right px-2 py-1 text-sm border border-indigo-300 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none"
          autoFocus
          min="0"
        />
        <button onClick={save} className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center transition-colors">
          <Check size={12} />
        </button>
        <button onClick={() => setEditing(false)} className="w-6 h-6 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end group">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{item.on_hand}</span>
      <button
        onClick={() => { setVal(item.on_hand); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all"
      >
        <Edit3 size={11} />
      </button>
    </div>
  );
}

export default function StockPage() {
  const dispatch = useDispatch();
  const { list, loading } = useSelector(s => s.stock);
  const { locations } = useSelector(s => s.warehouse);
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const tableRef = useRef(null);

  const reload = () => dispatch(fetchStock({ search, location_id: locationId || undefined }));

  useEffect(() => {
    reload();
    dispatch(fetchLocations());
  }, [dispatch]);

  useEffect(() => { reload(); }, [search, locationId]);

  useEffect(() => {
    if (!loading && tableRef.current) {
      gsap.fromTo(tableRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }, [loading]);

  const lowCount = list.filter(i => i.is_low_stock).length;
  const outCount = list.filter(i => i.is_out_of_stock).length;

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Stock">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <SelectField
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
          className="w-44"
        >
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </SelectField>
      </PageHeader>

      {/* Alert banners */}
      {(lowCount > 0 || outCount > 0) && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {outCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              <AlertTriangle size={15} className="text-red-500" />
              <strong>{outCount}</strong> product{outCount !== 1 ? 's' : ''} out of stock
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
              <TrendingDown size={15} className="text-amber-500" />
              <strong>{lowCount}</strong> product{lowCount !== 1 ? 's' : ''} low on stock
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Per Unit Cost</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Free to Use</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No products found</td></tr>
              ) : (
                list.map((item) => (
                  <tr
                    key={item.product_id}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors
                      ${item.is_out_of_stock ? 'bg-red-50/50 dark:bg-red-900/5' : item.is_low_stock ? 'bg-amber-50/50 dark:bg-amber-900/5' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{item.product_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{item.category || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(item.cost_price)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <EditableQty item={item} locationId={locationId} onSave={reload} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-600 dark:text-slate-300">{item.free_to_use}</td>
                    <td className="px-5 py-3.5 text-center">
                      {item.is_out_of_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <AlertTriangle size={10} /> Out of Stock
                        </span>
                      ) : item.is_low_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <TrendingDown size={10} /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
