import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { gsap } from 'gsap';
import { Plus, X } from 'lucide-react';
import { fetchLocations, fetchWarehouses } from '../../store/slices/warehouseSlice';
import { Btn, PageHeader, SelectField, InputField, LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDateTime } from '../../lib/utils';
import api from '../../configs/api';

export default function AdjustmentsPage() {
  const dispatch = useDispatch();
  const { locations, warehouses } = useSelector(s => s.warehouse);
  const { user } = useSelector(s => s.auth);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ warehouse_id: '', location_id: '', notes: '' });
  const [lines, setLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchLocations());
    fetchAdjustments();
    api.get('/api/products/').then(r => setProducts(r.data));
  }, [dispatch]);

  useEffect(() => {
    if (formRef.current) {
      gsap.fromTo(formRef.current, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
    }
  }, []);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/adjustments/');
      setAdjustments(res.data);
    } finally { setLoading(false); }
  };

  const filteredLocations = locations.filter(l => !form.warehouse_id || l.warehouse_id === parseInt(form.warehouse_id));

  const addLine = () => setLines(ls => [...ls, { product_id: '', quantity: 0 }]);
  const removeLine = (i) => setLines(ls => ls.filter((_, idx) => idx !== i));
  const updateLine = (i, key, val) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: val } : l));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.location_id) { setError('Please select a location'); return; }
    if (lines.length === 0) { setError('Add at least one product'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/adjustments/', { ...form, lines });
      setSuccess('Adjustment created and stock updated!');
      setLines([]);
      setForm(f => ({ ...f, notes: '' }));
      fetchAdjustments();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create adjustment');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Stock Adjustments" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div ref={formRef} className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm h-fit">
          <h2 className="font-bold text-slate-800 dark:text-white mb-5 text-base">New Adjustment</h2>

          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 mb-4">{error}</p>}
          {success && <p className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-2.5 mb-4">{success}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <SelectField label="Warehouse" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value, location_id: '' }))}>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </SelectField>
            <SelectField label="Location" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
              <option value="">Select location</option>
              {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </SelectField>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Products</label>
                <button type="button" onClick={addLine} className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                  <Plus size={12} /> Add
                </button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 mb-2 items-start">
                  <select
                    value={line.product_id}
                    onChange={e => updateLine(i, 'product_id', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>)}
                  </select>
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="Qty"
                    min="0"
                    className="w-20 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button type="button" onClick={() => removeLine(i)} className="mt-2 text-red-400 hover:text-red-600 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">No products added. Click "Add" to begin.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Reason for adjustment..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <Btn type="submit" disabled={saving} className="w-full justify-center">
              {saving ? 'Applying...' : 'Apply Adjustment'}
            </Btn>
          </form>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4 text-base">Adjustment History</h2>
          {loading ? <LoadingSpinner size="sm" /> : (
            <div className="flex flex-col gap-3">
              {adjustments.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">No adjustments yet.</p>
              ) : adjustments.map(adj => (
                <div key={adj.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{adj.reference}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(adj.validated_at)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {adj.lines?.map(l => (
                      <div key={l.id} className="flex justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{l.display || l.product_name}</span>
                        <span className="font-semibold text-slate-500">×{l.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {adj.notes && <p className="text-xs text-slate-400 mt-2 italic">{adj.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
