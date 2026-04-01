import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend
);

const C = {
  blue:   '#2563EB',
  blueLt: '#85B7EB',
  teal:   '#1D9E75',
  amber:  '#EF9F27',
  purple: '#534AB7',
  gray:   '#888780',
  red:    '#E24B4A',
  grid:   'rgba(0,0,0,0.06)',
  txt:    '#9ca3af',
};

const CAT_COLORS = [C.blue, C.teal, C.gray, C.amber, C.purple];

// ── chart option factory ──────────────────────────────────────────────────────
function baseOpts(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, ...overrides.plugins },
    scales: {
      x: { grid: { display: false }, ticks: { color: C.txt, font: { size: 11 } }, ...overrides.scalesX },
      y: { grid: { color: C.grid }, beginAtZero: true, ticks: { color: C.txt, font: { size: 11 } }, ...overrides.scalesY },
    },
    ...overrides,
  };
}

// ── tiny shared UI pieces ─────────────────────────────────────────────────────
function Panel({ title, subtitle, legend, right, children }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
          {subtitle && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {legend && (
        <div className="flex flex-wrap gap-3 mb-3">
          {legend.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function HBar({ name, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-zinc-500 dark:text-zinc-400 truncate shrink-0">{name}</span>
      <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all duration-500" />
      </div>
      <span className="w-10 text-right text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
        {value.toLocaleString('en-IN')}
      </span>
    </div>
  );
}

function AlertRow({ sku, name, detail, badgeText, severity }) {
  const sev = {
    critical: { dot: 'bg-red-500',    badge: 'bg-red-50  text-red-800  dark:bg-red-500/10 dark:text-red-400' },
    warning:  { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400' },
  }[severity] || { dot: 'bg-zinc-400', badge: 'bg-zinc-100 text-zinc-700' };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
      <span className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
          {name} <span className="font-normal text-zinc-400">{sku}</span>
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{detail}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${sev.badge}`}>{badgeText}</span>
    </div>
  );
}

function MoveRow({ ref: _ref, date, from: from_, to, qty, type }) {
  const style = {
    in:         { arrow: '↓', color: 'text-teal-600 dark:text-teal-400',   bg: 'bg-teal-50  dark:bg-teal-500/10'  },
    out:        { arrow: '↑', color: 'text-red-600  dark:text-red-400',    bg: 'bg-red-50   dark:bg-red-500/10'   },
    transfer:   { arrow: '⇄', color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50  dark:bg-blue-500/10'  },
    adjustment: { arrow: '±', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  }[type] || { arrow: '→', color: 'text-zinc-500', bg: 'bg-zinc-50' };

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${style.bg} ${style.color}`}>
        {style.arrow}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{_ref}</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{from_} → {to}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-bold ${style.color}`}>
          {type === 'out' || type === 'adjustment' ? '−' : '+'}{qty.toLocaleString('en-IN')}
        </p>
        <p className="text-xs text-zinc-400">{date}</p>
      </div>
    </div>
  );
}

// ── loading skeleton ──────────────────────────────────────────────────────────
function Skeleton({ h = 'h-48' }) {
  return (
    <div className={`${h} bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse`} />
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function DashboardCharts({ stats }) {
  // If stats not yet loaded from Redux, show skeletons instead of demo data
  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton h="h-64" />
          <Skeleton h="h-64" />
        </div>
        <Skeleton h="h-56" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton h="h-52" />
          <Skeleton h="h-52" />
          <Skeleton h="h-52" />
        </div>
      </div>
    );
  }

  const s = stats;

  // Guard: ensure required arrays exist so charts never crash on partial data
  const movements   = s.movements   || [];
  const categories  = s.categories  || [];
  const products    = s.products    || [];
  const locations   = s.locations   || [];
  const alerts      = s.alerts      || [];
  const contacts    = s.contacts    || [];
  const stockValue  = s.stockValue  || [];
  const recentMoves = s.recentMoves || [];
  const opStatus    = s.opStatus    || { draft:[0,0,0,0], waiting:[0,0,0,0], ready:[0,0,0,0], done:[0,0,0,0] };
  const kpis        = s.kpis        || {};

  const catMax     = categories.length  ? Math.max(...categories.map(c => c.qty))  : 1;
  const contactMax = contacts.length    ? Math.max(...contacts.map(c => c.vol))    : 1;
  const locMax     = locations.length   ? Math.max(...locations.map(l => l.qty))   : 1;

  const fmtRs = v => '₹' + (v >= 100000 ? (v/100000).toFixed(1)+'L' : v >= 1000 ? Math.round(v/1000)+'K' : v);

  // Chart.js datasets
  const movData = {
    labels: movements.map(m => m.date),
    datasets: [
      { label: 'In',  data: movements.map(m => m.in),  backgroundColor: C.blue, borderRadius: 3, borderSkipped: false },
      { label: 'Out', data: movements.map(m => m.out), backgroundColor: C.red,  borderRadius: 3, borderSkipped: false },
    ],
  };

  const catData = {
    labels: categories.map(c => c.name),
    datasets: [{
      data: categories.map(c => c.qty),
      backgroundColor: CAT_COLORS,
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const stockData = {
    labels: products.map(p => p.shortName),
    datasets: [
      { type: 'bar',  label: 'On hand',     data: products.map(p => p.onHand),    backgroundColor: C.blue,   borderRadius: 3 },
      { type: 'bar',  label: 'Free to use', data: products.map(p => p.freeToUse), backgroundColor: C.blueLt, borderRadius: 3 },
      { type: 'line', label: 'Reorder',     data: products.map(p => p.reorder),
        borderColor: C.red, backgroundColor: 'transparent',
        borderWidth: 1.5, borderDash: [4, 3], pointRadius: 3, pointBackgroundColor: C.red, tension: 0 },
    ],
  };

  const statusData = {
    labels: ['Receipts', 'Deliveries', 'Transfers', 'Adjustments'],
    datasets: [
      { label: 'Draft',   data: opStatus.draft,   backgroundColor: '#D3D1C7', borderRadius: 3 },
      { label: 'Waiting', data: opStatus.waiting, backgroundColor: C.amber,  borderRadius: 3 },
      { label: 'Ready',   data: opStatus.ready,   backgroundColor: C.blue,   borderRadius: 3 },
      { label: 'Done',    data: opStatus.done,    backgroundColor: C.teal,   borderRadius: 3 },
    ],
  };

  const valueData = {
    labels: stockValue.map(v => v.name),
    datasets: [{
      data: stockValue.map(v => v.value),
      backgroundColor: CAT_COLORS,
      borderRadius: 4,
    }],
  };

  return (
    <div className="space-y-4">

      {/* ── row 1: movements + category ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Panel
          title="Stock movements — last 14 days"
          subtitle="Inbound vs outbound units"
          legend={[{ color: C.blue, label: 'In (receipts / transfers)' }, { color: C.red, label: 'Out (deliveries / adjustments)' }]}
        >
          <div style={{ position: 'relative', height: 200 }}>
            <Bar data={movData} options={baseOpts({
              scalesX: { ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0, color: C.txt } },
              plugins:  { tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} units` } } },
            })} />
          </div>
        </Panel>

        <Panel title="Stock by category" subtitle="On-hand units per category">
          <div className="flex flex-col items-center gap-4">
            {categories.length > 0 ? (
              <div style={{ position: 'relative', width: 140, height: 140 }}>
                <Doughnut data={catData} options={{
                  responsive: false,
                  cutout: '68%',
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} units` } } },
                }} />
              </div>
            ) : (
              <div className="w-36 h-36 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            )}
            <div className="w-full space-y-1.5">
              {categories.map((c, i) => (
                <HBar key={c.name} name={c.name} value={c.qty} max={catMax} color={CAT_COLORS[i % CAT_COLORS.length]} />
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── row 2: all-product stock levels ── */}
      <Panel
        title="On-hand stock — all products"
        subtitle="On hand vs free to use vs reorder point"
        legend={[
          { color: C.blue,   label: 'On hand' },
          { color: C.blueLt, label: 'Free to use' },
          { color: C.red,    label: 'Reorder point (line)' },
        ]}
      >
        <div style={{ position: 'relative', height: 220 }}>
          <Bar data={stockData} options={baseOpts({
            scalesX: { ticks: { maxRotation: 35, font: { size: 10 }, color: C.txt } },
            plugins:  { tooltip: { mode: 'index' } },
          })} />
        </div>
      </Panel>

      {/* ── row 3: ops status + locations + stock value ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Panel
          title="Operations by status"
          subtitle="Stacked by operation type"
          legend={[
            { color: '#D3D1C7', label: 'Draft' },
            { color: C.amber,   label: 'Waiting' },
            { color: C.blue,    label: 'Ready' },
            { color: C.teal,    label: 'Done' },
          ]}
        >
          <div style={{ position: 'relative', height: 180 }}>
            <Bar data={statusData} options={baseOpts({
              scalesX: { stacked: true, ticks: { color: C.txt } },
              scalesY: { stacked: true, ticks: { stepSize: 1, color: C.txt } },
            })} />
          </div>
        </Panel>

        <Panel title="Stock by location" subtitle="Units stored per zone">
          <div className="space-y-2.5 mt-1">
            {locations.map(l => (
              <HBar key={l.name} name={l.name} value={l.qty} max={locMax} color={C.teal} />
            ))}
          </div>
        </Panel>

        <Panel title="Stock value by category" subtitle="Cost price × on-hand qty (₹)">
          <div style={{ position: 'relative', height: 195 }}>
            <Bar
              data={valueData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: ctx => ` ₹${Math.round(ctx.parsed.x).toLocaleString('en-IN')}` } },
                },
                scales: {
                  x: { grid: { color: C.grid }, ticks: { color: C.txt, font: { size: 10 }, callback: v => fmtRs(v) } },
                  y: { grid: { display: false }, ticks: { color: C.txt, font: { size: 11 } } },
                },
              }}
            />
          </div>
        </Panel>
      </div>

      {/* ── row 4: alerts + contacts | recent moves ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="space-y-4">
          {/* Low stock alerts */}
          <Panel
            title="Low stock alerts"
            subtitle={`${alerts.length} product${alerts.length !== 1 ? 's' : ''} need attention`}
          >
            {alerts.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">All products above reorder point</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(a => <AlertRow key={a.sku} {...a} />)}
              </div>
            )}
          </Panel>

          {/* Top contacts */}
          <Panel title="Top contacts by volume" subtitle="Units handled — last 14 days">
            {contacts.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">No moves recorded yet</p>
            ) : (
              <div className="space-y-2.5">
                {contacts.map(c => (
                  <HBar key={c.name + c.type} name={c.name} value={c.vol} max={contactMax}
                    color={c.type === 'in' ? C.blue : C.red} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Recent moves */}
        <Panel
          title="Recent stock moves"
          subtitle="Latest validated movements"
          right={
            <a href="/moves" className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Full ledger →
            </a>
          }
        >
          {recentMoves.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-8">No moves yet</p>
          ) : (
            <div>
              {recentMoves.map((m, i) => (
                <MoveRow key={i} {...m} />
              ))}
            </div>
          )}
        </Panel>
      </div>

    </div>
  );
}