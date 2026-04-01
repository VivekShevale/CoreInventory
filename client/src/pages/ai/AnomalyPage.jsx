import React, { useEffect, useState } from 'react';
import api from '../../configs/api';
import Breadcrumb from '../../components/Breadcrumb';
import { LoadingSpinner } from '../../components/ui';

const SEV = {
  high:   'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-900/50',
  medium: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
};
const SEV_BADGE = {
  high:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
};

function AnomalyCard({ anomaly, type }) {
  const s = SEV[anomaly.severity] || SEV.medium;
  const b = SEV_BADGE[anomaly.severity] || SEV_BADGE.medium;

  return (
    <div className={`border rounded-xl p-4 ${s}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold">{anomaly.message}</p>
          {anomaly.reference && <p className="text-xs mt-0.5 opacity-70">Ref: {anomaly.reference}</p>}
          {anomaly.name      && <p className="text-xs mt-0.5 opacity-70">{anomaly.name} · {anomaly.sku}</p>}
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${b}`}>
          {anomaly.severity?.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs opacity-75 mt-2">
        {anomaly.date     && <span>Date: {anomaly.date}</span>}
        {anomaly.quantity && <span>Quantity: {anomaly.quantity}</span>}
        {anomaly.expected && <span>Typical: {anomaly.expected}</span>}
        {anomaly.actual   !== undefined && <span>Actual: {anomaly.actual}</span>}
        {anomaly.expected !== undefined && type === 'shrinkage' && <span>Expected: {anomaly.expected}</span>}
        {anomaly.pct      !== undefined && <span>Shrinkage: {anomaly.pct}%</span>}
      </div>
    </div>
  );
}

export default function AnomalyPage() {
  const [data, setData]   = useState(null);
  const [days, setDays]   = useState(60);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState('all');

  const load = (d) => {
    setLoading(true);
    api.get(`/api/ai/anomalies?days=${d}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(days); }, [days]);

  if (loading && !data) return <div className="space-y-4"><Breadcrumb /><LoadingSpinner /></div>;

  const qty  = data?.quantity_anomalies  || [];
  const vel  = data?.velocity_anomalies  || [];
  const shr  = data?.shrinkage_anomalies || [];
  const all  = [
    ...qty.map(a => ({ ...a, _type: 'quantity' })),
    ...vel.map(a => ({ ...a, _type: 'velocity' })),
    ...shr.map(a => ({ ...a, _type: 'shrinkage' })),
  ].sort((a, b) => (b.severity === 'high') - (a.severity === 'high'));

  const shown = tab === 'all' ? all
    : tab === 'quantity' ? qty.map(a => ({ ...a, _type: 'quantity' }))
    : tab === 'velocity' ? vel.map(a => ({ ...a, _type: 'velocity' }))
    : shr.map(a => ({ ...a, _type: 'shrinkage' }));

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">🚨 Anomaly Detection</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            EWMA control charts + MAD Z-score + shrinkage ledger reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Period:</label>
          {[14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => { setDays(d); }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${days === d ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total anomalies', value: summary.total || 0,  bg: 'bg-zinc-50 dark:bg-zinc-800/50' },
          { label: 'High severity',   value: summary.high  || 0,  bg: 'bg-red-50 dark:bg-red-500/10',    text: 'text-red-700 dark:text-red-400' },
          { label: 'Medium severity', value: summary.medium || 0, bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
          { label: 'Days analysed',   value: summary.checked_days || days, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.text || 'text-zinc-800 dark:text-zinc-100'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all',       label: `All (${all.length})` },
          { key: 'quantity',  label: `Qty spikes (${qty.length})` },
          { key: 'velocity',  label: `Velocity (${vel.length})` },
          { key: 'shrinkage', label: `Shrinkage (${shr.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${tab === t.key ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? <LoadingSpinner /> : shown.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-medium">No {tab === 'all' ? '' : tab} anomalies in the last {days} days.</p>
          <p className="text-sm mt-1">All stock movements appear normal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a, i) => <AnomalyCard key={i} anomaly={a} type={a._type} />)}
        </div>
      )}

      {/* How it works */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
        <p className="font-semibold text-zinc-600 dark:text-zinc-300 mb-2">Detection methods</p>
        <p>• <b>Quantity spikes</b> — Median Absolute Deviation (MAD) Z-score flags individual moves &gt;3.5σ from the median</p>
        <p>• <b>Velocity anomalies</b> — EWMA control chart detects days where total throughput is k standard deviations above the rolling average</p>
        <p>• <b>Shrinkage</b> — Ledger reconciliation: compares cumulative in/out records against actual on-hand stock; flags &gt;5% or &gt;1 unit discrepancy</p>
      </div>
    </div>
  );
}