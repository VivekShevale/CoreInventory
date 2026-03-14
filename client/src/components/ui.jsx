import React from 'react';
import { statusColor } from '../lib/utils';

/* ── StatusBadge ── */
export function StatusBadge({ status }) {
  const labels = { draft: 'Draft', waiting: 'Waiting', ready: 'Ready', done: 'Done', canceled: 'Canceled' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(status)}`}>
      {labels[status] || status}
    </span>
  );
}

/* ── KpiCard ── */
export function KpiCard({ title, value, icon: Icon, color = 'indigo', sub, onClick }) {
  const colors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  };
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-4 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${sizes[size]} border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── InputField ── */
export function InputField({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>}
      <input
        {...props}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 transition-colors outline-none
          ${error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900'
            : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900'
          }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/* ── SelectField ── */
export function SelectField({ label, error, children, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>}
      <select
        {...props}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white transition-colors outline-none
          ${error
            ? 'border-red-400 focus:border-red-500'
            : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900'
          }`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/* ── Btn ── */
export function Btn({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
    secondary: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Table ── */
export function Table({ columns, data, onRowClick, emptyText = 'No records found' }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 text-sm">{emptyText}</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-100 dark:border-slate-800 last:border-0 bg-white dark:bg-slate-900 transition-colors
                  ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 text-slate-700 dark:text-slate-300 ${col.className || ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── KanbanBoard ── */
export function KanbanBoard({ items, onCardClick }) {
  const COLS = [
    { key: 'draft', label: 'Draft', color: 'bg-slate-100 dark:bg-slate-800' },
    { key: 'waiting', label: 'Waiting', color: 'bg-amber-50 dark:bg-amber-900/10' },
    { key: 'ready', label: 'Ready', color: 'bg-blue-50 dark:bg-blue-900/10' },
    { key: 'done', label: 'Done', color: 'bg-emerald-50 dark:bg-emerald-900/10' },
    { key: 'canceled', label: 'Canceled', color: 'bg-red-50 dark:bg-red-900/10' },
  ];
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLS.map(col => {
        const colItems = items.filter(i => i.status === col.key);
        return (
          <div key={col.key} className={`flex-shrink-0 w-72 rounded-2xl ${col.color} p-3 border border-slate-200 dark:border-slate-700`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{col.label}</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center">{colItems.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {colItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => onCardClick?.(item)}
                  className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{item.reference}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1 truncate">{item.contact || '—'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('en-IN') : '—'}</p>
                </div>
              ))}
              {colItems.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── PageHeader ── */
export function PageHeader({ title, actions, children }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{title}</h1>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        {actions}
      </div>
    </div>
  );
}

/* ── LoadingSpinner ── */
export function LoadingSpinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${sizes[size]} border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin`} />
    </div>
  );
}

/* ── SearchBar ── */
export function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-colors w-56"
      />
    </div>
  );
}
