import React, { useState } from 'react';
import { Search, Filter, LayoutGrid, List, X } from 'lucide-react';
import { useSelector } from 'react-redux';

const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

export default function FilterBar({ onSearch, onFilter, view, onViewChange, filters, setFilters }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const { warehouses } = useSelector(s => s.warehouse);

  const activeCount = Object.values(filters || {}).filter(Boolean).length;

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative">
        {searchOpen ? (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search reference, contact..."
              className="w-52 text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
              onChange={e => onSearch(e.target.value)}
            />
            <button onClick={() => { setSearchOpen(false); onSearch(''); }}>
              <X size={14} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all"
          >
            <Search size={16} />
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => setFilterOpen(o => !o)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all relative
            ${activeCount > 0
              ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}
        >
          <Filter size={16} />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full text-white text-xs flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {filterOpen && (
          <div className="absolute right-0 top-11 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filters</span>
              <button
                onClick={() => { setFilters({}); }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear all
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilters(f => ({ ...f, status: f.status === s ? '' : s }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all
                      ${filters?.status === s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {warehouses.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Warehouse</label>
                <select
                  value={filters?.warehouse_id || ''}
                  onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setFilterOpen(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Apply Filters
            </button>
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => onViewChange('list')}
          className={`w-9 h-9 flex items-center justify-center transition-colors
            ${view === 'list'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
        >
          <List size={16} />
        </button>
        <button
          onClick={() => onViewChange('kanban')}
          className={`w-9 h-9 flex items-center justify-center transition-colors
            ${view === 'kanban'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
}
