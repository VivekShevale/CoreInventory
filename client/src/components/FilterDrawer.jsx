import React from 'react';
import { X } from 'lucide-react';
import { Btn, SelectField } from './ui';

export default function FilterDrawer({ open, onClose, filters, onChange, warehouses = [] }) {
  if (!open) return null;

  const update = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Filters</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <SelectField
            label="Status"
            value={filters.status || ''}
            onChange={e => update('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="waiting">Waiting</option>
            <option value="ready">Ready</option>
            <option value="done">Done</option>
            <option value="canceled">Canceled</option>
          </SelectField>

          <SelectField
            label="Warehouse"
            value={filters.warehouse_id || ''}
            onChange={e => update('warehouse_id', e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </SelectField>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">From Date</label>
            <input
              type="date"
              value={filters.date_from || ''}
              onChange={e => update('date_from', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">To Date</label>
            <input
              type="date"
              value={filters.date_to || ''}
              onChange={e => update('date_to', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => { onChange({}); onClose(); }}>Clear</Btn>
          <Btn className="flex-1" onClick={onClose}>Apply</Btn>
        </div>
      </div>
    </div>
  );
}
