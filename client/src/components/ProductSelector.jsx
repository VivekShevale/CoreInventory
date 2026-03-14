import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X } from 'lucide-react';
import api from '../configs/api';

export default function ProductSelector({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/products/', { params: { search: query } });
        setResults(res.data.slice(0, 8));
        setOpen(true);
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
        <Search size={14} className="text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search product by name or SKU..."
          className="flex-1 text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p);
                setQuery('');
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">[{p.sku}]</span> {p.name}
                </p>
                <p className="text-xs text-slate-400">{p.unit_of_measure} • On hand: {p.on_hand}</p>
              </div>
              <Plus size={14} className="text-slate-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
