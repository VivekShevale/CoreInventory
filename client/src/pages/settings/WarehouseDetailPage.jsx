import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ArrowLeft, Warehouse, MapPin, ChevronRight, Plus, Trash2 } from 'lucide-react';
import api from '../../configs/api';
import { Btn, Modal, InputField, LoadingSpinner } from '../../components/ui';
import Breadcrumb from '../../components/Breadcrumb';
import { useDispatch } from 'react-redux';
import { createLocation, deleteLocation } from '../../store/slices/warehouseSlice';

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [warehouse, setWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', short_code: '' });
  const [saving, setSaving] = useState(false);
  const headerRef = useRef(null);
  const gridRef = useRef(null);

  const fetchWarehouse = () => {
    setLoading(true);
    api.get(`/api/warehouses/${id}`)
      .then(r => setWarehouse(r.data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWarehouse(); }, [id]);

  useEffect(() => {
    if (!loading && warehouse) {
      gsap.fromTo(headerRef.current, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
      if (gridRef.current?.children.length) {
        gsap.fromTo(gridRef.current.children,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.07, ease: 'power2.out', delay: 0.15 }
        );
      }
    }
  }, [loading, warehouse]);

  const handleAddLocation = async (e) => {
    e.preventDefault();
    setSaving(true);
    await dispatch(createLocation({
      name: form.name,
      short_code: form.short_code.toUpperCase(),
      warehouse_id: parseInt(id),
    }));
    setSaving(false);
    setModalOpen(false);
    setForm({ name: '', short_code: '' });
    fetchWarehouse();
  };

  const handleDeleteLocation = async (lid) => {
    if (!confirm('Delete this location? This cannot be undone.')) return;
    await dispatch(deleteLocation(lid));
    fetchWarehouse();
  };

  if (loading) return <LoadingSpinner />;
  if (!warehouse) return null;

  return (
    <div>
      <Breadcrumb
        extra={[
          { label: 'Warehouse', path: '/settings/warehouse' },
          { label: warehouse.name, isLast: true },
        ]}
      />

      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/settings/warehouse')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Warehouse size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{warehouse.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  {warehouse.short_code}
                </span>
                <span className="text-xs text-slate-400">
                  {warehouse.locations?.length || 0} location{warehouse.locations?.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Btn onClick={() => setModalOpen(true)}>
          <Plus size={15} /> Add Location
        </Btn>
      </div>

      {/* Locations Grid */}
      {(!warehouse.locations || warehouse.locations.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <MapPin size={36} className="text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-500 dark:text-slate-400">No locations yet</p>
          <p className="text-sm text-slate-400 mt-1">Add locations to this warehouse to start tracking stock.</p>
          <Btn className="mt-5" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add Location
          </Btn>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouse.locations.map(loc => (
            <div
              key={loc.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <MapPin size={17} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteLocation(loc.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Location info */}
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">{loc.name}</h3>
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                {loc.short_code}
              </span>

              {/* Stock summary */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Products</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">
                    {loc.product_count ?? 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Total Units</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">
                    {loc.total_stock ?? 0}
                  </p>
                </div>
              </div>

              {/* View details button */}
              <button
                onClick={() => navigate(`/settings/locations/${loc.id}`)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 dark:hover:bg-indigo-900/20 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-all"
              >
                View Stock <ChevronRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Location Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Location" size="sm">
        <form onSubmit={handleAddLocation} className="flex flex-col gap-4">
          <InputField
            label="Location Name"
            placeholder="e.g. Stock Room A"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <InputField
            label="Short Code"
            placeholder="e.g. STK-A"
            value={form.short_code}
            onChange={e => setForm(f => ({ ...f, short_code: e.target.value }))}
            required
            maxLength={20}
          />
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
            <Btn variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add Location'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
