import React, { useEffect, useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import api from '../../configs/api';
import Breadcrumb from '../../components/Breadcrumb';
import { LoadingSpinner } from '../../components/ui';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const TREND_COLOR = { rising: 'text-red-500', falling: 'text-teal-500', stable: 'text-zinc-400' };
const TREND_ICON  = { rising: '↑ Rising',      falling: '↓ Falling',     stable: '→ Stable' };

function ConfidenceBadge({ confidence }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400'
              : pct >= 40 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {pct}% confidence
    </span>
  );
}

function ProductCard({ item, selected, onClick }) {
  const urgency = item.on_hand < item.total_forecast
    ? 'border-red-300 dark:border-red-800'
    : 'border-zinc-200 dark:border-zinc-800';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : urgency + ' bg-white dark:bg-zinc-900 hover:border-blue-300'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">{item.name}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{item.sku}</p>
        </div>
        <ConfidenceBadge confidence={item.confidence} />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className="text-zinc-500">On hand: <b className="text-zinc-700 dark:text-zinc-300">{item.on_hand} {item.unit}</b></span>
        <span className={`font-medium ${TREND_COLOR[item.trend]}`}>{TREND_ICON[item.trend]}</span>
      </div>
      {item.on_hand < item.total_forecast && (
        <div className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
          ⚠ Forecast exceeds stock by {Math.round(item.total_forecast - item.on_hand)} units
        </div>
      )}
    </button>
  );
}

export default function ForecastPage() {
  const [allForecasts, setAllForecasts] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [horizon, setHorizon]           = useState(30);
  const [loading, setLoading]           = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = useCallback(() => {
    setLoading(true);
    api.get(`/api/ai/forecast?horizon=${horizon}`)
      .then(r => {
        setAllForecasts(r.data.forecasts || []);
        if (r.data.forecasts?.length && !selected) {
          setSelected(r.data.forecasts[0]);
        }
      })
      .finally(() => setLoading(false));
  }, [horizon]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadDetail = (productId) => {
    setDetailLoading(true);
    api.get(`/api/ai/forecast/${productId}?horizon=${horizon}`)
      .then(r => setSelected(r.data))
      .finally(() => setDetailLoading(false));
  };

  const chartData = selected ? {
    labels: [
      ...selected.history.map(h => h.date.slice(5)),   // MM-DD
      ...selected.forecast.map(f => f.date.slice(5)),
    ],
    datasets: [
      {
        type: 'bar',
        label: 'Actual',
        data: [...selected.history.map(h => h.actual), ...Array(selected.forecast.length).fill(null)],
        backgroundColor: '#2563EB',
        borderRadius: 2,
      },
      {
        type: 'bar',
        label: 'Forecast',
        data: [...Array(selected.history.length).fill(null), ...selected.forecast.map(f => f.value)],
        backgroundColor: 'rgba(16,185,129,0.7)',
        borderRadius: 2,
      },
      {
        type: 'line',
        label: 'Upper band',
        data: [...Array(selected.history.length).fill(null), ...selected.forecast.map(f => f.upper)],
        borderColor: 'rgba(16,185,129,0.3)',
        borderDash: [4,3],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
      {
        type: 'line',
        label: 'Lower band',
        data: [...Array(selected.history.length).fill(null), ...selected.forecast.map(f => f.lower)],
        borderColor: 'rgba(16,185,129,0.3)',
        borderDash: [4,3],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
    ],
  } : null;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">🔮 Demand Forecast</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            AI-powered demand predictions using Holt's double exponential smoothing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Horizon:</label>
          {[7, 14, 30, 60].map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${horizon === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'}`}>
              {h}d
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Product list */}
          <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
              {allForecasts.length} products — sorted by urgency
            </p>
            {allForecasts.map(item => (
              <ProductCard
                key={item.product_id}
                item={item}
                selected={selected?.product_id === item.product_id}
                onClick={() => loadDetail(item.product_id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2 space-y-4">
            {detailLoading && (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            )}

            {selected && !detailLoading && (
              <>
                {/* Header */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{selected.name}</h2>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{selected.sku} · {selected.unit}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ConfidenceBadge confidence={selected.confidence} />
                      <span className={`text-xs font-semibold ${TREND_COLOR[selected.trend]}`}>
                        {TREND_ICON[selected.trend]}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'On hand',         value: `${selected.on_hand} ${selected.unit}` },
                      { label: 'Free to use',      value: `${selected.free} ${selected.unit}` },
                      { label: `${horizon}d forecast`, value: `${selected.total_forecast} ${selected.unit}` },
                      { label: 'Daily avg demand', value: `${selected.daily_avg} ${selected.unit}` },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</p>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Stockout warning */}
                  {selected.free < selected.total_forecast && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-700 dark:text-red-400">
                      ⚠️ <b>Stockout risk:</b> Forecast demand ({selected.total_forecast} {selected.unit}) exceeds free stock ({selected.free} {selected.unit}).
                      Estimated stockout in <b>{selected.daily_avg > 0 ? Math.round(selected.free / selected.daily_avg) : '?'} days</b>.
                      Consider ordering {Math.round(selected.total_forecast - selected.free)} more units.
                    </div>
                  )}
                </div>

                {/* Chart */}
                {chartData && (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5"><span style={{width:9,height:9,borderRadius:2,background:'#2563EB',display:'inline-block'}}/> Actual</span>
                      <span className="flex items-center gap-1.5"><span style={{width:9,height:9,borderRadius:2,background:'rgba(16,185,129,0.7)',display:'inline-block'}}/> Forecast</span>
                      <span className="flex items-center gap-1.5"><span style={{width:16,height:1,borderTop:'2px dashed rgba(16,185,129,0.4)',display:'inline-block'}}/> Confidence band</span>
                    </div>
                    <div style={{ position: 'relative', height: 240 }}>
                      <Bar data={chartData} options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
                        scales: {
                          x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 14 } },
                          y: { grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 11 } } },
                        },
                      }} />
                    </div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 text-center">
                      Grey = history · Green = {horizon}-day forecast · Dashed = 90% confidence band ·
                      Model params: α={selected.params?.alpha}, β={selected.params?.beta}
                    </p>
                  </div>
                )}

                {/* Forecast table */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Daily forecast breakdown</h3>
                  </div>
                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                          {['Date','Forecast','Lower bound','Upper bound'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-zinc-500 dark:text-zinc-400 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {selected.forecast.map(f => (
                          <tr key={f.date} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{f.date}</td>
                            <td className="px-4 py-2 font-semibold text-teal-700 dark:text-teal-400">{f.value} {selected.unit}</td>
                            <td className="px-4 py-2 text-zinc-400">{f.lower}</td>
                            <td className="px-4 py-2 text-zinc-400">{f.upper}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}