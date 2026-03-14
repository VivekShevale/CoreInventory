import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Warehouse, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../../store/slices/warehouseSlice';
import { Btn, InputField, LoadingSpinner, PageHeader, Modal } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';

function WarehouseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', short_code: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <InputField label="Warehouse Name" placeholder="e.g. Main Warehouse" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      <InputField label="Short Code" placeholder="e.g. WH" value={form.short_code} onChange={e => setForm(f => ({ ...f, short_code: e.target.value.toUpperCase() }))} required maxLength={10} />
      <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
        <Btn variant="secondary" type="button" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit" disabled={loading}>{loading ? 'Saving...' : (initial ? 'Update' : 'Create')}</Btn>
      </div>
    </form>
  );
}

export default function WarehousePage() {
  const dispatch = useDispatch();
  const { warehouses, loading } = useSelector(s => s.warehouse);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { dispatch(fetchWarehouses()); }, [dispatch]);

  const handleCreate = async (data) => {
    await dispatch(createWarehouse(data));
    setModalOpen(false);
  };

  const handleUpdate = async (data) => {
    await dispatch(updateWarehouse({ id: editing.id, data }));
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this warehouse? This cannot be undone.')) return;
    await dispatch(deleteWarehouse(id));
  };

  return (
    <div>
      <Breadcrumb />
      <PageHeader title="Warehouse">
        <Btn onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Warehouse
        </Btn>
      </PageHeader>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-400">
              <Warehouse size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No warehouses yet</p>
              <p className="text-sm mt-1">Create your first warehouse to get started</p>
            </div>
          ) : warehouses.map(wh => (
            <div key={wh.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Warehouse size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(wh)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center transition-all">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white">{wh.name}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">{wh.short_code}</span>
                <span className="text-xs text-slate-400">{wh.location_count} location{wh.location_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Warehouse" size="sm">
        <WarehouseForm onSave={handleCreate} onCancel={() => setModalOpen(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Warehouse" size="sm">
        {editing && <WarehouseForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
