import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../configs/api';
import Breadcrumb from '../../components/Breadcrumb';
import { LoadingSpinner } from '../../components/ui';

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400', bar: 'bg-red-500' },
  high:     { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400', bar: 'bg-amber-500' },
  medium:   { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400', bar: 'bg-blue-500' },
};

function FactorBar({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-zinc-400 dark:text-zinc-500 text-right shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div style={{ width: `${Math.round(value * 100)}%` }} className="h-full bg-blue-500 rounded-full" />
      </div>
      <span className="w-8 text-zinc-400">{Math.round(value * 100)}%</span>
    </div>
  );
}

function ReorderCard({ rec, onApprove, approved }) {
  const [expanded, setExpanded] = useState(false);
  const s = PRIORITY_STYLE[rec.priority] || PRIORITY_STYLE.medium;

  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden transition-all ${approved ? 'border-teal-300 dark:border-teal-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Urgency bar */}
          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: s.bar.replace('bg-','').includes('red') ? '#ef4444' : s.bar.includes('amber') ? '#f59e0b' : '#3b82f6' }}>
            <div className={`w-1 h-full rounded-full ${s.bar}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{rec.name}</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{rec.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${s.badge}`}>
                  {rec.priority.toUpperCase()}
                </span>
                <span className="text-xs text-zinc-400">Score: {Math.round(rec.urgency_score * 100)}%</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{rec.explanation}</p>

            {/* Key numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Recommend',   value: `${rec.recommended_qty} ${rec.unit}`, highlight: true },
                { label: 'EOQ',         value: `${rec.eoq} ${rec.unit}` },
                { label: 'Safety stock', value: `${rec.safety_stock} ${rec.unit}` },
                { label: 'Cost est.',   value: `₹${(rec.cost_estimate || 0).toLocaleString('en-IN')}` },
              ].map(f => (
                <div key={f.label} className={`rounded-lg p-2.5 ${f.highlight ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-zinc-50 dark:bg-zinc-800/50'}`}>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{f.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${f.highlight ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{f.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setExpanded(e => !e)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline">
                {expanded ? 'Hide' : 'Show'} AI reasoning
              </button>
              <span className="text-zinc-200 dark:text-zinc-700">·</span>
              <span className="text-xs text-zinc-400">Lead time: {rec.lead_time_days} days</span>
            </div>

            {expanded && (
              <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-1.5">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Urgency factors (AI reasoning)</p>
                <FactorBar label="Days left"   value={rec.factors.factor_days} />
                <FactorBar label="Forecast gap" value={rec.factors.factor_forecast} />
                <FactorBar label="Reorder breach" value={rec.factors.factor_reorder} />
                <FactorBar label="Demand trend" value={rec.factors.factor_trend} />
                <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-400 space-y-0.5">
                  <p>Free stock: {rec.factors.free_stock} · 30d forecast: {rec.factors.forecast_30d}</p>
                  <p>Days of stock: {rec.factors.days_of_stock} · Trend: {rec.factors.trend}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <Link to={`/receipts/new?product=${rec.product_id}&qty=${rec.recommended_qty}`}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
          Create receipt manually →
        </Link>
        {approved ? (
          <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">✓ Draft receipt created</span>
        ) : (
          rec.priority === 'critical' && (
            <button onClick={() => onApprove(rec.product_id)}
              className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
              Auto-create draft
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function ReorderAgentPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [approved, setApproved] = useState(new Set());
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    api.get('/api/ai/reorder/recommendations')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const autoCreateAll = async () => {
    setCreating(true);
    try {
      // Get first warehouse + location (or prompt user to select)
      const locRes = await api.get('/api/settings/locations');
      const locs   = locRes.data.locations || [];
      if (!locs.length) {
        alert('Please set up at least one warehouse and location first.');
        return;
      }
      const res = await api.post('/api/ai/reorder/auto-create', {
        warehouse_id:   locs[0].warehouse_id,
        to_location_id: locs[0].id,
      });
      const refs = new Set(res.data.created.map(c => c.product));
      setApproved(prev => new Set([...prev, ...refs]));
      alert(`✓ Created ${res.data.count} draft receipt(s). Go to Receipts to review.`);
    } catch (e) {
      alert('Failed to auto-create: ' + (e.response?.data?.error || e.message));
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="space-y-4"><Breadcrumb /><LoadingSpinner /></div>
  );

  const recs   = data?.recommendations || [];
  const counts = { all: recs.length, critical: recs.filter(r => r.priority === 'critical').length, high: recs.filter(r => r.priority === 'high').length };
  const shown  = filter === 'all' ? recs : recs.filter(r => r.priority === filter);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">⚡ AI Reorder Agent</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Multi-signal urgency scoring: stock levels + demand forecast + trend + EOQ
          </p>
        </div>
        {counts.critical > 0 && (
          <button onClick={autoCreateAll} disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
            {creating ? '...' : `⚡ Auto-create ${counts.critical} critical draft${counts.critical > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total recommendations', value: counts.all,      bg: 'bg-zinc-50 dark:bg-zinc-800/50' },
          { label: 'Critical priority',      value: counts.critical, bg: 'bg-red-50 dark:bg-red-500/10',   text: 'text-red-700 dark:text-red-400' },
          { label: 'Est. total cost',        value: `₹${(data?.total_cost_estimate || 0).toLocaleString('en-IN')}`, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.text || 'text-zinc-800 dark:text-zinc-100'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all',      label: `All (${counts.all})` },
          { key: 'critical', label: `Critical (${counts.critical})` },
          { key: 'high',     label: `High (${counts.high})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === t.key ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {shown.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-medium">No reorder recommendations for this filter.</p>
          <p className="text-sm mt-1">All products are sufficiently stocked.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(rec => (
            <ReorderCard key={rec.product_id} rec={rec}
              approved={approved.has(rec.name)}
              onApprove={() => setApproved(prev => new Set([...prev, rec.name]))} />
          ))}
        </div>
      )}

      {/* Explainer */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
        <p className="font-semibold text-zinc-600 dark:text-zinc-300 mb-2">How the AI scores urgency</p>
        <p>• <b>Days remaining (35%)</b> — free stock ÷ forecasted daily demand</p>
        <p>• <b>Forecast coverage (30%)</b> — does 30-day demand exceed current stock?</p>
        <p>• <b>Reorder breach (20%)</b> — is stock already below the configured reorder point?</p>
        <p>• <b>Demand trend (15%)</b> — is daily demand rising, falling, or stable?</p>
        <p className="pt-1">Order quantities use the <b>Economic Order Quantity (EOQ)</b> formula plus safety stock based on demand variability and lead time.</p>
      </div>
    </div>
  );
}