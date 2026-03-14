import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2, MapPin, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchLocations, createLocation, deleteLocation, fetchWarehouses } from '../../store/slices/warehouseSlice';
import { Btn, InputField, SelectField, LoadingSpinner, PageHeader, Modal } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';

export default function LocationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { locations, warehouses, loading } = useSelector(s => s.warehouse);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', short_code: '', warehouse_id: '' });
  const [saving, setSaving] = useState(false);
  const [filterWH, setFilterWH] = useState('');

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchLocations());
  }, [dispatch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await dispatch(createLocation({ ...form, short_code: form.short_code.toUpperCase() }));
    setSaving(false);
    setModalOpen(false);
    setForm({ name: '', short_code: '', warehouse_id: '' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this location?')) return;
    await dispatch(deleteLocation(id));
  };

  const filtered = filterWH ? locations.filter(l => l.warehouse_id === parseInt(filterWH)) : locations;

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Locations">
        <SelectField value={filterWH} onChange={e => setFilterWH(e.target.value)} className="w-44">
          <option value="">All Warehouses</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </SelectField>
        <Btn onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Location
        </Btn>
      </PageHeader>

      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Short Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Warehouse</th>
                <th className="px-5 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                    No locations found
                  </td>
                </tr>
              ) : filtered.map(loc => (
                <tr key={loc.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <MapPin size={13} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="font-medium text-slate-800 dark:text-white">{loc.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                      {loc.short_code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                    {loc.warehouse_name}
                    <span className="ml-2 text-xs font-mono text-slate-400">({loc.warehouse_code})</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => navigate(`/settings/locations/${loc.id}`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                      >
                        View Stock <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Location" size="sm">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <InputField label="Location Name" placeholder="e.g. Storage Room A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <InputField label="Short Code" placeholder="e.g. STR-A" value={form.short_code} onChange={e => setForm(f => ({ ...f, short_code: e.target.value }))} required maxLength={20} />
          <SelectField label="Warehouse" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))} required>
            <option value="">Select warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.short_code})</option>)}
          </SelectField>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
            <Btn variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Location'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
