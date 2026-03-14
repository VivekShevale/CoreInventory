import React from 'react';
import StatusBadge from './StatusBadge';
import { formatDate } from '../lib/utils';

const COLUMNS = ['draft', 'waiting', 'ready', 'done', 'canceled'];

const COL_COLORS = {
  draft: 'border-slate-300 dark:border-slate-600',
  waiting: 'border-amber-400',
  ready: 'border-blue-400',
  done: 'border-emerald-400',
  canceled: 'border-red-400',
};

const COL_BG = {
  draft: 'bg-slate-50 dark:bg-slate-800/40',
  waiting: 'bg-amber-50/60 dark:bg-amber-900/10',
  ready: 'bg-blue-50/60 dark:bg-blue-900/10',
  done: 'bg-emerald-50/60 dark:bg-emerald-900/10',
  canceled: 'bg-red-50/40 dark:bg-red-900/10',
};

export default function KanbanBoard({ items, onCardClick }) {
  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = items.filter(i => i.status === col);
    return acc;
  }, {});

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => (
        <div key={col} className={`flex-shrink-0 w-64 rounded-xl border-t-4 ${COL_COLORS[col]} ${COL_BG[col]} p-3`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{col}</span>
            <span className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-slate-500 dark:text-slate-400 font-medium">
              {grouped[col].length}
            </span>
          </div>
          <div className="space-y-2">
            {grouped[col].length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">Empty</p>
            )}
            {grouped[col].map(item => (
              <div
                key={item.id}
                onClick={() => onCardClick && onCardClick(item)}
                className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{item.reference}</p>
                {item.contact && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate mb-1">{item.contact}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{formatDate(item.scheduled_date)}</span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
