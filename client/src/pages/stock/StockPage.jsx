import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { gsap } from 'gsap';
import { TrendingDown, AlertTriangle, Edit3, Check, X, FileSpreadsheet, Package, ZapIcon, Search } from 'lucide-react';
import { fetchStock } from '../../store/slices/stockSlice';
import { fetchLocations, fetchWarehouses } from '../../store/slices/warehouseSlice';
import { LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { useNavigate } from 'react-router-dom';
import { downloadExcel } from '../../lib/export';
import { formatCurrency } from '../../lib/utils';
import api from '../../configs/api';

function EditableQty({ item, locationId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.on_hand);

  const save = async () => {
    await api.post('/api/stock/update', {
      product_id: item.product_id,
      location_id: locationId ? parseInt(locationId) : 1,
      quantity: parseFloat(val),
    });
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
          className="w-20 text-right px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
          min="0"
          step="0.01"
        />
        <button 
          onClick={save} 
          className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
        >
          <Check size={12} />
        </button>
        <button 
          onClick={() => setEditing(false)} 
          className="w-6 h-6 rounded bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end group">
      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.on_hand}</span>
      <button
        onClick={(e) => { e.stopPropagation(); setVal(item.on_hand); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all"
      >
        <Edit3 size={11} />
      </button>
    </div>
  );
}

export default function StockPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading } = useSelector(s => s.stock);
  const { locations, warehouses } = useSelector(s => s.warehouse);
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const tableRef = useRef(null);

  const handleExport = () => {
    const headers = ['Product', 'SKU', 'Category', 'Unit', 'Cost Price', 'On Hand', 'Free to Use', 'Total Value', 'Status'];
    const rows = list.map(i => [
      i.product_name, i.sku, i.category || '', i.unit_of_measure,
      i.cost_price, i.on_hand, i.free_to_use, i.total_value || 0,
      i.is_out_of_stock ? 'Out of Stock' : i.is_low_stock ? 'Low Stock' : 'In Stock',
    ]);
    downloadExcel('stock_report', headers, rows, 'Stock');
  };

  const reload = () => dispatch(fetchStock({
    search,
    location_id: locationId || undefined,
    warehouse_id: warehouseId || undefined,
  }));

  useEffect(() => {
    reload();
    dispatch(fetchLocations());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  useEffect(() => { reload(); }, [search, locationId, warehouseId]);

  useEffect(() => {
    if (!loading && tableRef.current) {
      gsap.fromTo(tableRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }, [loading]);

  const filteredLocations = warehouseId
    ? locations.filter(l => l.warehouse_id === parseInt(warehouseId))
    : locations;

  const lowCount = list.filter(i => i.is_low_stock).length;
  const outCount = list.filter(i => i.is_out_of_stock).length;
  const totalValue = list.reduce((sum, i) => sum + (i.total_value || 0), 0);

  return (
    <div className="space-y-6">
      <Breadcrumb />
      
      {/* Header - matching Dashboard style */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white mb-1">Stock</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Manage and track your inventory levels across all locations</p>
        </div>
        
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          <FileSpreadsheet size={16} /> Export
        </button>
      </div>

      {/* Filters - matching ProjectDetail tabs style */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <select
          value={warehouseId}
          onChange={e => { setWarehouseId(e.target.value); setLocationId(''); }}
          className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Warehouses</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        
        <select
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Locations</option>
          {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Stats cards - matching ProjectDetail info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between p-4 py-3 rounded">
          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Total Products</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{list.length}</div>
          </div>
          <Package className="size-4 text-blue-600 dark:text-blue-400" />
        </div>
        
        <div className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between p-4 py-3 rounded">
          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Low Stock Items</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{lowCount}</div>
          </div>
          <TrendingDown className="size-4 text-amber-600 dark:text-amber-400" />
        </div>
        
        <div className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between p-4 py-3 rounded">
          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{outCount}</div>
          </div>
          <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
        </div>
      </div>

      {/* Alert banners - matching TasksSummary style */}
      {(lowCount > 0 || outCount > 0 || totalValue > 0) && (
        <div className="flex gap-3 flex-wrap items-center">
          {outCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-400">
              <AlertTriangle size={15} />
              <span><strong>{outCount}</strong> product{outCount !== 1 ? 's' : ''} out of stock</span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 rounded-lg text-sm text-amber-700 dark:text-amber-400">
              <TrendingDown size={15} />
              <span><strong>{lowCount}</strong> product{lowCount !== 1 ? 's' : ''} low on stock</span>
            </div>
          )}
          {totalValue > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-900/50 rounded-lg text-sm text-blue-700 dark:text-blue-400 ml-auto">
              <ZapIcon size={15} />
              <span><strong>Total Stock Value:</strong> {formatCurrency(totalValue)}</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Product</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Category</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Per Unit Cost</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">On Hand</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Free to Use</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Total Value</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-zinc-400">
                    No products found
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr
                    key={item.product_id}
                    className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors cursor-pointer
                      ${item.is_out_of_stock 
                        ? 'bg-red-50/50 dark:bg-red-500/5 hover:bg-red-100/50 dark:hover:bg-red-500/10' 
                        : item.is_low_stock 
                          ? 'bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-100/50 dark:hover:bg-amber-500/10' 
                          : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    onClick={() => navigate(`/products/${item.product_id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">{item.sku}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">{item.category || '—'}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(item.cost_price)}</td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <EditableQty item={item} locationId={locationId} onSave={reload} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-zinc-600 dark:text-zinc-400">{item.free_to_use}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(item.total_value)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {item.is_out_of_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                          <AlertTriangle size={10} /> Out of Stock
                        </span>
                      ) : item.is_low_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                          <TrendingDown size={10} /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
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