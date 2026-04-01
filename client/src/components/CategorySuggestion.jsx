import React, { useEffect, useState, useRef } from 'react';
import api from '../configs/api';

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-teal-500' : pct >= 40 ? 'bg-amber-500' : 'bg-zinc-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${color} transition-all duration-500`} />
      </div>
      <span className="text-xs text-zinc-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function CategorySuggestion({ name, sku, onSelect, currentCategory }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [dismissed, setDismissed]     = useState(false);
  const [accepted, setAccepted]       = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setDismissed(false);
    setAccepted(null);

    if (!name || name.length < 3) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.post('/api/ai/suggest-category', { name, sku: sku || '' })
        .then(r => setSuggestions(r.data.suggestions || []))
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [name, sku]);

  if (dismissed || !name || name.length < 3) return null;
  if (!loading && suggestions.length === 0) return null;

  const top = suggestions[0];

  // If top suggestion matches current selection, don't show
  if (top && currentCategory && top.category === currentCategory) return null;

  return (
    <div className="mt-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-500/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">🤖 AI category suggestion</span>
          {loading && <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {accepted ? (
        <p className="text-xs text-teal-700 dark:text-teal-400 font-medium">✓ Category set to <b>{accepted}</b></p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={s.category}
              className={`flex items-center gap-3 ${i === 0 ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{s.category}</span>
                  {i === 0 && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">Best match</span>}
                </div>
                <ConfidenceBar value={s.confidence} />
              </div>
              <button
                onClick={() => {
                  setAccepted(s.category);
                  onSelect?.(s.category);
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                  i === 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300'
                }`}>
                Use this
              </button>
            </div>
          ))}
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Based on Naive Bayes classifier trained on your product catalogue
          </p>
        </div>
      )}
    </div>
  );
}