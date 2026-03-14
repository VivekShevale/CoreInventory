import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { gsap } from 'gsap';
import { ArrowLeft, CheckCheck, X, Plus, ChevronRight, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import api from '../../configs/api';
import { fetchWarehouses, fetchLocations } from '../../store/slices/warehouseSlice';
import { Btn, InputField, SelectField, LoadingSpinner } from '../../components/ui';
import ProductPicker from '../../components/ProductPicker';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDateTime } from '../../lib/utils';

const STATUS_STEPS = ['draft', 'waiting', 'ready', 'done'];

export default function TransferDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { warehouses, locations } = useSelector(s => s.warehouse);
  const { user } = useSelector(s => s.auth);
  const headerRef = useRef(null);

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [form, setForm] = useState({
    from_warehouse_id: '',
    from_location_id: '',
    to_warehouse_id: '',
    to_location_id: '',
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchLocations());
    if (!isNew) {
      api.get(`/api/transfers/${id}`)
        .then(r => {
          setTransfer(r.data);
          const d = r.data;
          setForm({
            from_warehouse_id: d.warehouse_id || '',
            from_location_id: d.from_location_id || '',
            to_warehouse_id: '',
            to_location_id: d.to_location_id || '',
            scheduled_date: d.scheduled_date ? d.scheduled_date.split('T')[0] : '',
            notes: d.notes || '',
          });
          setLines(d.lines?.map(l => ({
            product_id: l.product_id,
            product_name: l.product_name,
            product_sku: l.product_sku,
            quantity: l.quantity,
            on_hand: l.on_hand,
          })) || []);
        })
        .catch(() => navigate('/transfers'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(headerRef.current, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
    }
  }, []);

  const fromLocations = locations.filter(l =>
    !form.from_warehouse_id || l.warehouse_id === parseInt(form.from_warehouse_id)
  );
  const toLocations = locations.filter(l =>
    (!form.to_warehouse_id || l.warehouse_id === parseInt(form.to_warehouse_id)) &&
    l.id !== parseInt(form.from_location_id || 0)
  );

  const status = transfer?.status || 'draft';
  const isDone = status === 'done';
  const isCanceled = status === 'canceled';

  const getPayload = () => ({
    from_location_id: form.from_location_id || null,
    to_location_id: form.to_location_id || null,
    warehouse_id: form.from_warehouse_id || null,
    scheduled_date: form.scheduled_date || null,
    notes: form.notes,
    lines,
  });

  const handleSave = async () => {
    if (!form.from_location_id || !form.to_location_id) {
      setError('Please select both source and destination locations');
      return;
    }
    if (form.from_location_id === form.to_location_id) {
      setError('Source and destination locations cannot be the same');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one product');
      return;
    }
    setSaving(true); setError('');
    try {
      if (isNew) {
        const res = await api.post('/api/transfers/', getPayload());
        navigate(`/transfers/${res.data.id}`);
      } else {
        const res = await api.put(`/api/transfers/${id}`, getPayload());
        setTransfer(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleValidate = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.post(`/api/transfers/${id}/validate`);
      setTransfer(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Validation failed');
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this transfer?')) return;
    try {
      const res = await api.post(`/api/transfers/${id}/cancel`);
      setTransfer(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Cancel failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <Breadcrumb extra={[
        { label: 'Transfers', path: '/transfers' },
        { label: isNew ? 'New Transfer' : (transfer?.reference || `#${id}`), isLast: true }
      ]} />

      {/* Action bar */}
      <div ref={headerRef} className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate('/transfers')} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <ArrowLeftRight size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            {isNew ? 'New Internal Transfer' : transfer?.reference}
          </h1>
        </div>

        {!isCanceled && (
          <div className="flex items-center gap-2 flex-wrap">
            {!isDone && (
              <>
                <Btn variant="secondary" onClick={handleSave} disabled={saving} size="sm">
                  {saving ? 'Saving...' : 'Save'}
                </Btn>
                {status === 'ready' && (
                  <Btn
                    onClick={handleValidate}
                    disabled={saving}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    size="sm"
                  >
                    <CheckCheck size={14} /> Validate
                  </Btn>
                )}
                {status === 'waiting' && (
                  <Btn disabled className="bg-amber-100 text-amber-600 cursor-not-allowed" size="sm">
                    <AlertTriangle size={14} /> Waiting for Stock
                  </Btn>
                )}
                {!isNew && (
                  <Btn variant="danger" onClick={handleCancel} disabled={saving} size="sm">
                    <X size={14} /> Cancel
                  </Btn>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Status steps */}
      {!isNew && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {STATUS_STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all
                ${status === s ? 'bg-violet-600 text-white shadow-sm' :
                  STATUS_STEPS.indexOf(status) > i ? 'bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < STATUS_STEPS.length - 1 && <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />}
            </React.Fragment>
          ))}
          {isCanceled && <div className="px-4 py-2 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/20 text-red-600">Canceled</div>}
        </div>
      )}

      {/* From / To visual */}
      <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-36">
          <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">From</p>
          <p className="font-bold text-slate-800 dark:text-white text-sm">
            {form.from_location_id
              ? locations.find(l => l.id === parseInt(form.from_location_id))?.name || '—'
              : 'Select source location'}
          </p>
          <p className="text-xs text-slate-400">
            {form.from_warehouse_id
              ? warehouses.find(w => w.id === parseInt(form.from_warehouse_id))?.name || ''
              : ''}
          </p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-200 dark:bg-violet-800 flex-shrink-0">
          <ArrowLeftRight size={18} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-36 text-right">
          <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">To</p>
          <p className="font-bold text-slate-800 dark:text-white text-sm">
            {form.to_location_id
              ? locations.find(l => l.id === parseInt(form.to_location_id))?.name || '—'
              : 'Select destination location'}
          </p>
          <p className="text-xs text-slate-400">
            {form.to_warehouse_id
              ? warehouses.find(w => w.id === parseInt(form.to_warehouse_id))?.name || ''
              : ''}
          </p>
        </div>
      </div>

      {/* Form fields */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Source */}
          <div className="md:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Source Location</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="From Warehouse"
                value={form.from_warehouse_id}
                onChange={e => setForm(f => ({ ...f, from_warehouse_id: e.target.value, from_location_id: '' }))}
                disabled={isDone || isCanceled}
              >
                <option value="">Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </SelectField>
              <SelectField
                label="From Location"
                value={form.from_location_id}
                onChange={e => setForm(f => ({ ...f, from_location_id: e.target.value }))}
                disabled={isDone || isCanceled}
              >
                <option value="">Select location</option>
                {fromLocations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.short_code})</option>)}
              </SelectField>
            </div>
          </div>

          {/* Destination */}
          <div className="md:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Destination Location</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="To Warehouse"
                value={form.to_warehouse_id}
                onChange={e => setForm(f => ({ ...f, to_warehouse_id: e.target.value, to_location_id: '' }))}
                disabled={isDone || isCanceled}
              >
                <option value="">Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </SelectField>
              <SelectField
                label="To Location"
                value={form.to_location_id}
                onChange={e => setForm(f => ({ ...f, to_location_id: e.target.value }))}
                disabled={isDone || isCanceled}
              >
                <option value="">Select location</option>
                {toLocations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.short_code})</option>)}
              </SelectField>
            </div>
          </div>

          <InputField
            label="Scheduled Date"
            type="date"
            value={form.scheduled_date}
            onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
            disabled={isDone || isCanceled}
          />
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Responsible</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium py-2.5">{user?.full_name || user?.login_id}</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              disabled={isDone || isCanceled}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Products to Transfer</h3>
          {!isDone && !isCanceled && (
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={!form.from_location_id}
              title={!form.from_location_id ? 'Select source location first' : ''}
            >
              <Plus size={14} /> Add Product
            </Btn>
          )}
        </div>

        {!form.from_location_id && !isDone && (
          <div className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10">
            Select a source location to add products.
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              {!isDone && <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Available</th>}
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Transfer Qty</th>
              {!isDone && !isCanceled && <th className="px-6 py-3 w-12" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">No products added yet</td></tr>
            ) : lines.map((line, i) => {
              const insufficient = !isDone && line.on_hand !== undefined && line.on_hand < line.quantity;
              return (
                <tr key={line.product_id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${insufficient ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      {insufficient && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                      <span className="font-mono text-xs text-violet-600 dark:text-violet-400 mr-1">[{line.product_sku}]</span>
                      <span className={`font-medium ${insufficient ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                        {line.product_name}
                      </span>
                    </div>
                    {insufficient && <p className="text-xs text-red-500 mt-0.5 ml-5">Insufficient at source</p>}
                  </td>
                  {!isDone && (
                    <td className="px-6 py-3.5 text-right text-sm text-slate-500 dark:text-slate-400">
                      {line.on_hand ?? '—'}
                    </td>
                  )}
                  <td className="px-6 py-3.5 text-right">
                    {isDone || isCanceled ? (
                      <span className="font-bold text-slate-800 dark:text-white">{line.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={e => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, quantity: parseFloat(e.target.value) || 0 } : l))}
                        className="w-24 text-right px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                        min="0"
                      />
                    )}
                  </td>
                  {!isDone && !isCanceled && (
                    <td className="px-6 py-3.5 text-center">
                      <button onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 transition-colors">
                        <X size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {isDone && transfer?.validated_at && (
          <p className="text-xs text-slate-400 px-6 py-3 text-right border-t border-slate-100 dark:border-slate-800">
            Validated on {formatDateTime(transfer.validated_at)}
          </p>
        )}
      </div>

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        lines={lines}
        onChange={setLines}
        locationId={form.from_location_id || null}
      />
    </div>
  );
}
