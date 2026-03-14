import React, { useState, useEffect } from 'react';
import api from '../configs/api';
import { Modal, Btn, SearchBar } from './ui';
import { Plus, Minus, Trash2, AlertTriangle } from 'lucide-react';

export default function ProductPicker({ open, onClose, lines, onChange, locationId = null }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = { search };
    if (locationId) {
      // Fetch only products available at this location
      params.location_id = locationId;
      params.in_stock_only = 'true';
    }
    api.get('/api/products/', { params })
      .then(r => setProducts(r.data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [open, search, locationId]);

  const lineMap = Object.fromEntries(lines.map(l => [l.product_id, l.quantity]));

  const addProduct = (product) => {
    if (lineMap[product.id]) return;
    const locationStock = product.location_stock ?? product.on_hand;
    onChange([...lines, {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      quantity: 1,
      on_hand: locationStock,
    }]);
  };

  const removeProduct = (product_id) => {
    onChange(lines.filter(l => l.product_id !== product_id));
  };

  const updateQty = (product_id, qty) => {
    onChange(lines.map(l => l.product_id === product_id ? { ...l, quantity: Math.max(0.01, qty) } : l));
  };

  return (
    <Modal open={open} onClose={onClose} title={locationId ? 'Add Products (from selected location)' : 'Add Products'} size="lg">
      <div className="flex flex-col gap-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products by name or SKU..." />

        {locationId && (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
            <AlertTriangle size={13} />
            Showing only products available at the selected source location.
          </div>
        )}

        {/* Selected lines */}
        {lines.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Selected Products</p>
            <div className="flex flex-col gap-2">
              {lines.map(line => {
                const overQty = line.on_hand !== undefined && line.quantity > line.on_hand;
                return (
                  <div key={line.product_id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${overQty ? 'bg-red-50 dark:bg-red-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                        [{line.product_sku}] {line.product_name}
                      </p>
                      {line.on_hand !== undefined && (
                        <p className={`text-xs mt-0.5 ${overQty ? 'text-red-500' : 'text-slate-400'}`}>
                          {overQty ? `⚠ Only ${line.on_hand} available` : `Available: ${line.on_hand}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(line.product_id, line.quantity - 1)} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors">
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={e => updateQty(line.product_id, parseFloat(e.target.value) || 0)}
                        className={`w-16 text-center text-sm font-semibold border rounded-lg py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 ${overQty ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                      />
                      <button onClick={() => updateQty(line.product_id, line.quantity + 1)} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => removeProduct(line.product_id)} className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors ml-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Product list */}
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {locationId ? 'Products at this location' : 'All Products'}
          </p>
          {loading ? (
            <div className="text-center py-6 text-slate-400 text-sm">Loading...</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {products.map(product => {
                const already = !!lineMap[product.id];
                const locationStock = product.location_stock ?? product.on_hand;
                return (
                  <div
                    key={product.id}
                    onClick={() => !already && addProduct(product)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                      ${already
                        ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10 opacity-60 cursor-default'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer'
                      }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs mr-1">[{product.sku}]</span>
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {locationId ? `At location: ${locationStock}` : `On hand: ${product.on_hand}`}
                        {product.unit_of_measure && ` ${product.unit_of_measure}`}
                      </p>
                    </div>
                    {!already && (
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Plus size={13} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                  </div>
                );
              })}
              {products.length === 0 && !loading && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400">
                    {locationId ? 'No products with stock at this location.' : 'No products found.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </Modal>
  );
}
