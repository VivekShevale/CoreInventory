import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { gsap } from 'gsap';
import { Plus, Printer, X, CheckCheck, ChevronRight, ArrowLeft } from 'lucide-react';
import { fetchReceipt, createReceipt, updateReceipt, confirmReceipt, validateReceipt, cancelReceipt } from '../../store/slices/receiptSlice';
import { fetchWarehouses, fetchLocations } from '../../store/slices/warehouseSlice';
import { Btn, InputField, SelectField, LoadingSpinner } from '../../components/ui';
import ProductPicker from '../../components/ProductPicker';
import Breadcrumb from '../../components/Breadcrumb';
import { formatDate, formatDateTime } from '../../lib/utils';

const STATUS_STEPS = ['draft', 'ready', 'done'];

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current, loading } = useSelector(s => s.receipts);
  const { warehouses, locations } = useSelector(s => s.warehouse);
  const { user } = useSelector(s => s.auth);
  const printRef = useRef(null);
  const headerRef = useRef(null);

  const [form, setForm] = useState({
    contact: '', scheduled_date: '', notes: '',
    warehouse_id: '', to_location_id: '',
  });
  const [lines, setLines] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const receipt = isNew ? null : current;

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchLocations());
    if (!isNew) dispatch(fetchReceipt(id));
  }, [id, isNew, dispatch]);

  useEffect(() => {
    if (receipt && !isNew) {
      setForm({
        contact: receipt.contact || '',
        scheduled_date: receipt.scheduled_date ? receipt.scheduled_date.split('T')[0] : '',
        notes: receipt.notes || '',
        warehouse_id: receipt.warehouse_id || '',
        to_location_id: receipt.to_location_id || '',
      });
      setLines(receipt.lines?.map(l => ({
        product_id: l.product_id,
        product_name: l.product_name,
        product_sku: l.product_sku,
        quantity: l.quantity,
        on_hand: l.on_hand,
      })) || []);
    }
  }, [receipt, isNew]);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(headerRef.current, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
    }
  }, []);

  const filteredLocations = locations.filter(l => !form.warehouse_id || l.warehouse_id === parseInt(form.warehouse_id));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload = { ...form, lines, responsible_id: user?.id };
      if (isNew) {
        const res = await dispatch(createReceipt(payload));
        if (!res.error) navigate(`/receipts/${res.payload.id}`);
      } else {
        await dispatch(updateReceipt({ id: receipt.id, data: payload }));
      }
    } catch (e) { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    setSaving(true);
    await dispatch(confirmReceipt(receipt.id));
    setSaving(false);
  };

  const handleValidate = async () => {
    setSaving(true);
    const res = await dispatch(validateReceipt(receipt.id));
    if (res.error) setError(res.payload);
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this receipt?')) return;
    await dispatch(cancelReceipt(receipt.id));
  };

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const status = receipt?.status || 'draft';
  const isDone = status === 'done';
  const isCanceled = status === 'canceled';

  if (loading && !isNew) return <LoadingSpinner />;

  return (
    <div>
      <Breadcrumb extra={[{ label: isNew ? 'New Receipt' : (receipt?.reference || `#${id}`), isLast: true }]} />

      {/* Action bar */}
      <div ref={headerRef} className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate('/receipts')} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex-1">
          {isNew ? 'New Receipt' : receipt?.reference}
        </h1>
        {!isCanceled && (
          <div className="flex items-center gap-2 flex-wrap">
            {isNew && (
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Btn>
            )}
            {!isNew && !isDone && (
              <>
                <Btn variant="secondary" onClick={handleSave} disabled={saving} size="sm">Save</Btn>
                {status === 'draft' && (
                  <Btn variant="secondary" onClick={handleConfirm} disabled={saving} size="sm">
                    <CheckCheck size={14} /> Confirm
                  </Btn>
                )}
                {(status === 'ready' || status === 'draft') && (
                  <Btn onClick={handleValidate} disabled={saving} variant="emerald" size="sm">
                    <CheckCheck size={14} /> Validate
                  </Btn>
                )}
                <Btn variant="danger" onClick={handleCancel} disabled={saving} size="sm">
                  <X size={14} /> Cancel
                </Btn>
              </>
            )}
            {isDone && (
              <Btn variant="secondary" onClick={handlePrint} size="sm">
                <Printer size={14} /> Print
              </Btn>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 mb-4">{error}</p>}

      {/* Status steps */}
      {!isNew && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {STATUS_STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all
                ${status === s ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900' :
                  STATUS_STEPS.indexOf(status) > i ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
              >
                {s === 'draft' ? 'Draft' : s === 'ready' ? 'Ready' : 'Done'}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
          {isCanceled && (
            <div className="px-4 py-2 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              Canceled
            </div>
          )}
        </div>
      )}

      {/* Printable content */}
      <div ref={printRef}>
        {/* Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {!isNew && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Reference</p>
                <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{receipt?.reference}</p>
              </div>
            )}
            <InputField
              label="Received From (Vendor/Supplier)"
              placeholder="e.g. Azure Interiors"
              value={form.contact}
              onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
              disabled={isDone || isCanceled}
            />
            <InputField
              label="Scheduled Date"
              type="date"
              value={form.scheduled_date}
              onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
              disabled={isDone || isCanceled}
            />
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Responsible</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium py-2.5">
                {user?.full_name || user?.login_id}
              </p>
            </div>
            <SelectField
              label="Warehouse"
              value={form.warehouse_id}
              onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value, to_location_id: '' }))}
              disabled={isDone || isCanceled}
            >
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </SelectField>
            <SelectField
              label="Destination Location"
              value={form.to_location_id}
              onChange={e => setForm(f => ({ ...f, to_location_id: e.target.value }))}
              disabled={isDone || isCanceled}
            >
              <option value="">Select location</option>
              {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.short_code})</option>)}
            </SelectField>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                disabled={isDone || isCanceled}
                rows={2}
                placeholder="Optional notes..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Products</h3>
            {!isDone && !isCanceled && (
              <Btn variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus size={14} /> Add Product
              </Btn>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                {!isDone && !isCanceled && <th className="px-6 py-3 w-12" />}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-sm">No products added yet</td></tr>
              ) : (
                lines.map((line, i) => (
                  <tr key={line.product_id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 mr-1.5">[{line.product_sku}]</span>
                      <span className="font-medium text-slate-800 dark:text-white">{line.product_name}</span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {isDone || isCanceled ? (
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{line.quantity}</span>
                      ) : (
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={e => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, quantity: parseFloat(e.target.value) || 0 } : l))}
                          className="w-24 text-right px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isNew && isDone && receipt?.validated_at && (
          <p className="text-xs text-slate-400 mt-3 text-right">Validated on {formatDateTime(receipt.validated_at)}</p>
        )}
      </div>

      <ProductPicker open={pickerOpen} onClose={() => setPickerOpen(false)} lines={lines} onChange={setLines} />
    </div>
  );
}
