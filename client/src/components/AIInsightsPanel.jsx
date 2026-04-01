import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../configs/api';

const PRIORITY_STYLE = {
  critical: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  high:     'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  medium:   'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
};

const TREND_ICON = { rising: '↑', falling: '↓', stable: '→' };

function InsightCard({ icon, label, value, sub, color = 'blue', to }) {
  const colors = {
    blue:   'from-blue-500 to-blue-600',
    red:    'from-red-500 to-red-600',
    amber:  'from-amber-500 to-amber-600',
    teal:   'from-teal-500 to-teal-600',
  };
  const content = (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-xl flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block no-underline">{content}</Link> : content;
}

export default function AIInsightsPanel() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    api.get('/api/ai/insights')
      .then(r => setInsights(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="text-sm text-zinc-400 dark:text-zinc-500 p-4 text-center">
        AI insights unavailable
      </div>
    );
  }

  const { forecast_risks, anomaly_summary, reorder_count, critical_reorders } = insights;

  return (
    <div className="space-y-5">

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InsightCard icon="⚡" label="Reorder alerts"    value={reorder_count}              sub="products need ordering"        color="amber" to="/ai/reorder" />
        <InsightCard icon="🔮" label="Stockout risks"    value={forecast_risks.length}       sub="< 21 days of stock"            color="red"   to="/ai/forecast" />
        <InsightCard icon="🚨" label="Anomalies"         value={anomaly_summary.total}        sub={`${anomaly_summary.high} high severity`} color="red" to="/ai/anomalies" />
        <InsightCard icon="✅" label="All good"          value={`${10 - Math.min(10, reorder_count)}/10`} sub="products on track" color="teal" />
      </div>

      {/* ── Stockout forecast risks ── */}
      {forecast_risks.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">🔮 Predicted stockouts</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Products forecast to run out within 21 days</p>
            </div>
            <Link to="/ai/forecast" className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Full forecast →
            </Link>
          </div>
          <div className="space-y-2">
            {forecast_risks.map(r => (
              <div key={r.product_id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.days_left <= 7 ? 'bg-red-500' : r.days_left <= 14 ? 'bg-amber-500' : 'bg-yellow-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">{r.name}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {r.free_stock} {r.unit} left · {r.daily_avg}/day
                    <span className={`ml-1 ${r.trend === 'rising' ? 'text-red-500' : r.trend === 'falling' ? 'text-teal-500' : 'text-zinc-400'}`}>
                      {TREND_ICON[r.trend]}
                    </span>
                  </p>
                </div>
                <div className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${r.days_left <= 7 ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                  {r.days_left}d left
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Critical reorders ── */}
      {critical_reorders.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">⚡ Critical reorder alerts</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">AI recommends ordering immediately</p>
            </div>
            <Link to="/ai/reorder" className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium">
              Auto-generate orders →
            </Link>
          </div>
          <div className="space-y-2">
            {critical_reorders.map(r => (
              <div key={r.product_id} className="flex items-center gap-3 p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-500/5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{r.name} <span className="font-normal text-zinc-400">{r.sku}</span></p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{r.explanation}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400">{r.recommended_qty} {r.unit}</p>
                  <p className="text-xs text-zinc-400">≈ ₹{r.cost_estimate?.toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Anomaly summary ── */}
      {anomaly_summary.total > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-xl flex-shrink-0">🚨</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{anomaly_summary.total} anomalies detected</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{anomaly_summary.high} high severity · {anomaly_summary.medium} medium · last {anomaly_summary.checked_days} days</p>
          </div>
          <Link to="/ai/anomalies" className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0">
            Review →
          </Link>
        </div>
      )}

    </div>
  );
}