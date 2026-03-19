// src/components/TourOverlay.jsx
// --------------------------------
// Full-screen tour overlay shown to new users on first login.
//
// Props:
//   onFinish  — called when user clicks Finish or Skip
//
// Usage in your App.jsx / Dashboard.jsx:
//   import TourOverlay from './components/TourOverlay';
//   import { useTour } from '../hooks/useTour';
//
//   const { showTour, completeTour } = useTour(currentUser);
//   ...
//   {showTour && <TourOverlay onFinish={completeTour} />}

import React, { useState, useEffect, useCallback } from 'react';

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'welcome',
    label: 'Welcome',
    title: 'Welcome to CoreInventory 👋',
    desc: "You're all set up. This quick tour walks you through every section so you're running in minutes — no manual needed.",
    type: 'splash',
    chips: ['Dashboard', 'Receipts', 'Deliveries', 'Stock', 'Move History', 'Settings'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: 'Dashboard — your command center',
    desc: 'The landing page gives a real-time snapshot of all inventory activity. Spot bottlenecks before they become problems.',
    type: 'screen',
    screen: 'dashboard',
    tips: [
      { color: 'blue',  icon: '📦', text: 'Receipt block — pending, late, and total incoming orders' },
      { color: 'blue',  icon: '🚚', text: 'Delivery block — items to dispatch, waiting, and late shipments' },
      { color: 'amber', icon: '⚠️', text: "'Late' = scheduled date before today — needs immediate action" },
      { color: 'amber', icon: '⏳', text: "'Waiting' = stock not yet available for that delivery" },
    ],
  },
  {
    id: 'receipts',
    label: 'Receipts',
    title: 'Receipts — incoming stock',
    desc: 'Use Receipts whenever goods arrive from a vendor. Validating a receipt automatically increases stock at the destination.',
    type: 'screen',
    screen: 'receipts',
    tips: [
      { color: 'blue',  icon: '➕', text: "Click 'New' to create a receipt — reference WH/IN/001 is auto-generated" },
      { color: 'blue',  icon: '🔍', text: 'Search by reference or contact; filter by status, warehouse, or category' },
      { color: 'green', icon: '⚡', text: 'Validate → stock increases automatically at the destination location' },
      { color: 'green', icon: '🖨️', text: "Print the receipt once it reaches 'Done' status" },
    ],
  },
  {
    id: 'deliveries',
    label: 'Deliveries',
    title: 'Deliveries — outgoing stock',
    desc: 'Delivery orders reduce stock when goods leave for customers. Lines turn red when a product is out of stock.',
    type: 'screen',
    screen: 'deliveries',
    tips: [
      { color: 'red',   icon: '🔴', text: 'Red lines = insufficient stock — delivery enters Waiting status automatically' },
      { color: 'blue',  icon: '📋', text: 'Flow: Draft → Waiting → Ready → Done (or Cancelled)' },
      { color: 'green', icon: '✅', text: 'Validating a delivery deducts quantities from the source location' },
      { color: 'blue',  icon: '📍', text: 'Reference format: WH/OUT/001 — warehouse / type / auto-increment ID' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    title: 'Stock — live inventory',
    desc: 'See on-hand quantities, per-unit costs, and free-to-use stock. Free-to-use = total minus reserved for pending deliveries.',
    type: 'screen',
    screen: 'stock',
    tips: [
      { color: 'amber', icon: '🟡', text: "'On Hand' = physical total; 'Free to Use' = on hand minus reserved" },
      { color: 'blue',  icon: '🔍', text: 'Search any product by name or SKU instantly' },
      { color: 'red',   icon: '⚠️', text: 'Products below their reorder point are flagged for replenishment' },
      { color: 'green', icon: '✏️', text: 'Update stock directly via an inventory adjustment from any row' },
    ],
  },
  {
    id: 'moves',
    label: 'Move History',
    title: 'Move History — full stock ledger',
    desc: 'Every movement — receipt, delivery, transfer, or adjustment — is logged here. One reference can have multiple rows.',
    type: 'screen',
    screen: 'moves',
    tips: [
      { color: 'green', icon: '🟢', text: 'Green rows = inbound moves (receipts, transfers in)' },
      { color: 'red',   icon: '🔴', text: 'Red rows = outbound moves (deliveries, adjustments)' },
      { color: 'blue',  icon: '🔗', text: 'One reference shows multiple rows if it had multiple products' },
      { color: 'blue',  icon: '📅', text: 'Filter by date, contact, product, or location to audit any move' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    title: 'Settings — warehouses & locations',
    desc: 'Set up your physical spaces first. Create warehouses, then add locations inside them.',
    type: 'screen',
    screen: 'settings',
    tips: [
      { color: 'blue',  icon: '🏭', text: 'Warehouse — top-level space (e.g. Main Warehouse, code: WH)' },
      { color: 'blue',  icon: '📍', text: 'Location — zone inside a warehouse (e.g. Stock Zone A = WH/STKA)' },
      { color: 'green', icon: '💡', text: 'Short codes keep references compact across all operations' },
      { color: 'amber', icon: '🔑', text: 'Add at least one warehouse + location before creating operations' },
    ],
  },
  {
    id: 'done',
    label: 'All done!',
    title: "You're all set! 🎉",
    desc: 'Start by adding your warehouse, then create a receipt to bring your first products in. Come back to this tour any time from your profile menu.',
    type: 'done',
  },
];

// ─── Tiny mock screens ────────────────────────────────────────────────────────
const Badge = ({ type }) => {
  const map = {
    ready:   { bg: '#D1FAE5', color: '#065F46', label: 'Ready' },
    draft:   { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
    waiting: { bg: '#FEF3C7', color: '#92400E', label: 'Waiting' },
    done:    { bg: '#DBEAFE', color: '#1E40AF', label: 'Done' },
  };
  const s = map[type] || map.draft;
  return (
    <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 10, background: s.bg, color: s.color, fontWeight: 500 }}>
      {s.label}
    </span>
  );
};

const FakeRow = ({ cols, highlight, danger }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px',
    borderRadius: 4, fontSize: 9,
    background: danger ? '#FEF2F2' : highlight ? '#EFF6FF' : 'var(--bg-secondary, #f5f5f4)',
    border: danger ? '0.5px solid #FECACA' : highlight ? '0.5px solid #BFDBFE' : 'none',
    color: 'var(--text-secondary, #6b7280)',
  }}>
    {cols}
  </div>
);

const FakeCol = ({ children, red }) => (
  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: red ? '#DC2626' : undefined }}>
    {children}
  </div>
);

const MockHeader = ({ title, url }) => (
  <>
    <div style={{ height: 26, background: 'var(--bg-secondary, #f5f5f4)', borderBottom: '0.5px solid var(--border, #e5e4e0)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
      {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />)}
      <div style={{ flex: 1, background: '#fff', border: '0.5px solid var(--border,#e5e4e0)', borderRadius: 3, height: 13, margin: '0 6px', fontSize: 8, color: '#aaa', display: 'flex', alignItems: 'center', padding: '0 5px' }}>
        {url}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: '0.5px solid var(--border,#e5e4e0)' }}>
      <button style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, background: '#2563EB', color: '#fff', border: 'none', cursor: 'default' }}>+ New</button>
      <span style={{ flex: 1, fontSize: 10, fontWeight: 600 }}>{title}</span>
      {['🔍','⚡','⊞'].map(i => (
        <span key={i} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'var(--bg-secondary,#f5f5f4)', border: '0.5px solid var(--border,#e5e4e0)' }}>{i}</span>
      ))}
    </div>
  </>
);

const MockNav = ({ active }) => {
  const items = ['Dashboard','Operations','Stock','Move History','Settings'];
  return (
    <div style={{ display: 'flex', background: 'var(--bg-secondary,#f5f5f4)', borderBottom: '0.5px solid var(--border,#e5e4e0)', padding: '0 6px', height: 28, overflow: 'hidden' }}>
      {items.map(i => (
        <div key={i} style={{
          padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center', fontSize: 9,
          color: i === active ? '#2563EB' : '#6b7280', fontWeight: i === active ? 600 : 400,
          borderBottom: i === active ? '2px solid #2563EB' : 'none',
        }}>{i}</div>
      ))}
    </div>
  );
};

const MockScreenShell = ({ children }) => (
  <div style={{ border: '0.5px solid var(--border,#e5e4e0)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
    {children}
  </div>
);

const COL_HDR = { background: 'var(--bg-secondary,#f5f5f4)', fontSize: 8, color: '#9ca3af', fontWeight: 500 };

const screens = {
  dashboard: () => (
    <MockScreenShell>
      <MockNav active="Dashboard" />
      <div style={{ display: 'flex', gap: 6, padding: 8 }}>
        {[
          { num: 4, lbl: 'To Receive', color: '#2563EB', extra: '1 late' },
          { num: 6, lbl: 'Receipts',   color: '#16A34A', extra: null },
          { num: 4, lbl: 'To Deliver', color: '#D97706', extra: '1 late · 2 waiting' },
          { num: 6, lbl: 'Deliveries', color: '#16A34A', extra: null },
        ].map(k => (
          <div key={k.lbl} style={{ flex: 1, background: 'var(--bg-secondary,#f5f5f4)', borderRadius: 6, padding: '7px 8px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.num}</div>
            <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 1 }}>{k.lbl}</div>
            {k.extra && <div style={{ fontSize: 7.5, color: '#DC2626', marginTop: 2 }}>{k.extra}</div>}
          </div>
        ))}
      </div>
    </MockScreenShell>
  ),

  receipts: () => (
    <MockScreenShell>
      <MockHeader title="Receipts" url="localhost:3000/receipts" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px' }}>
        <FakeRow cols={<><FakeCol>Reference</FakeCol><FakeCol>From</FakeCol><FakeCol>To</FakeCol><FakeCol>Contact</FakeCol><FakeCol>Status</FakeCol></>} highlight={false} />
        <FakeRow highlight cols={<><FakeCol>WH/IN/003</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>WH/STKB</FakeCol><FakeCol>TechZone</FakeCol><Badge type="ready" /></>} />
        <FakeRow cols={<><FakeCol>WH/IN/004</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol>PaperMart</FakeCol><Badge type="draft" /></>} />
        <FakeRow cols={<><FakeCol>WH/IN/005</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>WH/STKB</FakeCol><FakeCol>FurnCraft</FakeCol><Badge type="waiting" /></>} />
        <FakeRow cols={<><FakeCol>WH/IN/001</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol>Azure Int.</FakeCol><Badge type="done" /></>} />
      </div>
    </MockScreenShell>
  ),

  deliveries: () => (
    <MockScreenShell>
      <MockHeader title="Deliveries" url="localhost:3000/deliveries" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px' }}>
        <FakeRow cols={<><FakeCol>Reference</FakeCol><FakeCol>From</FakeCol><FakeCol>To</FakeCol><FakeCol>Contact</FakeCol><FakeCol>Status</FakeCol></>} />
        <FakeRow highlight cols={<><FakeCol>WH/OUT/002</FakeCol><FakeCol>WH/STKB</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>Innovate</FakeCol><Badge type="ready" /></>} />
        <FakeRow danger  cols={<><FakeCol red>WH/OUT/003</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>BlueSky</FakeCol><Badge type="waiting" /></>} />
        <FakeRow cols={<><FakeCol>WH/OUT/004</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>Greenfield</FakeCol><Badge type="draft" /></>} />
        <FakeRow cols={<><FakeCol>WH/OUT/001</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>Sundar</FakeCol><Badge type="done" /></>} />
      </div>
    </MockScreenShell>
  ),

  stock: () => (
    <MockScreenShell>
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderBottom: '0.5px solid var(--border,#e5e4e0)' }}>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 600 }}>Stock</span>
        <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-secondary,#f5f5f4)', border: '0.5px solid var(--border,#e5e4e0)' }}>🔍 Search</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px' }}>
        <FakeRow cols={<><FakeCol>Product</FakeCol><FakeCol>Cost/unit</FakeCol><FakeCol>On Hand</FakeCol><FakeCol>Free to Use</FakeCol></>} />
        <FakeRow cols={<><FakeCol>Office Desk</FakeCol><FakeCol>₹4,500</FakeCol><FakeCol>40</FakeCol><FakeCol>35</FakeCol></>} />
        <FakeRow cols={<><FakeCol>Ergonomic Chair</FakeCol><FakeCol>₹3,200</FakeCol><FakeCol>30</FakeCol><FakeCol>22</FakeCol></>} />
        <FakeRow danger cols={<><FakeCol>Steel Rod</FakeCol><FakeCol>₹85</FakeCol><FakeCol red>45 ⚠️</FakeCol><FakeCol>45</FakeCol></>} />
        <FakeRow cols={<><FakeCol>LED Monitor</FakeCol><FakeCol>₹9,800</FakeCol><FakeCol>10</FakeCol><FakeCol>7</FakeCol></>} />
      </div>
    </MockScreenShell>
  ),

  moves: () => (
    <MockScreenShell>
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderBottom: '0.5px solid var(--border,#e5e4e0)' }}>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 600 }}>Move History</span>
        {['🔍','⚡'].map(i => <span key={i} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: 'var(--bg-secondary,#f5f5f4)', border: '0.5px solid var(--border,#e5e4e0)', marginLeft: 4 }}>{i}</span>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px' }}>
        <FakeRow cols={<><FakeCol>Reference</FakeCol><FakeCol>Date</FakeCol><FakeCol>From</FakeCol><FakeCol>To</FakeCol><FakeCol>Qty</FakeCol></>} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 4, fontSize: 9, background: '#F0FDF4', border: '0.5px solid #BBF7D0' }}>
          <FakeCol red={false}><span style={{color:'#166534'}}>WH/IN/002</span></FakeCol><FakeCol>Mar 13</FakeCol><FakeCol>Vendor</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol><span style={{color:'#16A34A',fontWeight:600}}>+150</span></FakeCol>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 4, fontSize: 9, background: '#FEF2F2', border: '0.5px solid #FECACA' }}>
          <FakeCol><span style={{color:'#991B1B'}}>WH/OUT/001</span></FakeCol><FakeCol>Mar 11</FakeCol><FakeCol>WH/STKA</FakeCol><FakeCol>Vendor</FakeCol><FakeCol><span style={{color:'#DC2626',fontWeight:600}}>-5</span></FakeCol>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 4, fontSize: 9, background: '#FEF2F2', border: '0.5px solid #FECACA' }}>
          <FakeCol><span style={{color:'#991B1B'}}>WH/ADJ/002</span></FakeCol><FakeCol>Mar 17</FakeCol><FakeCol>WH/STKB</FakeCol><FakeCol>—</FakeCol><FakeCol><span style={{color:'#DC2626',fontWeight:600}}>-2</span></FakeCol>
        </div>
      </div>
    </MockScreenShell>
  ),

  settings: () => (
    <MockScreenShell>
      <div style={{ display: 'flex', background: 'var(--bg-secondary,#f5f5f4)', borderBottom: '0.5px solid var(--border,#e5e4e0)', padding: '0 6px', height: 28 }}>
        {['Warehouse','Location'].map((t, i) => (
          <div key={t} style={{ padding: '0 10px', height: '100%', display: 'flex', alignItems: 'center', fontSize: 9, color: i === 0 ? '#2563EB' : '#6b7280', borderBottom: i === 0 ? '2px solid #2563EB' : 'none', fontWeight: i === 0 ? 600 : 400 }}>{t}</div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px' }}>
        <FakeRow cols={<><FakeCol>Name</FakeCol><FakeCol>Short Code</FakeCol><FakeCol>Locations</FakeCol></>} />
        <FakeRow highlight cols={<><FakeCol>Main Warehouse</FakeCol><FakeCol style={{fontFamily:'monospace'}}>WH</FakeCol><FakeCol>4 locations</FakeCol></>} />
        <FakeRow cols={<><FakeCol>Production Unit</FakeCol><FakeCol style={{fontFamily:'monospace'}}>PU</FakeCol><FakeCol>2 locations</FakeCol></>} />
      </div>
      <div style={{ padding: '4px 8px', fontSize: 8, color: '#9ca3af', fontWeight: 500 }}>Locations inside WH</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px 8px' }}>
        <FakeRow cols={<><FakeCol>Stock Zone A</FakeCol><FakeCol style={{fontFamily:'monospace'}}>WH/STKA</FakeCol></>} />
        <FakeRow cols={<><FakeCol>Dispatch Bay</FakeCol><FakeCol style={{fontFamily:'monospace'}}>WH/DSPB</FakeCol></>} />
      </div>
    </MockScreenShell>
  ),
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
    animation: 'fadeIn .2s ease',
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 820,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,.2)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px 0',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 32, height: 32, borderRadius: 8,
    background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  appName: { fontSize: 14, fontWeight: 700, color: '#111' },
  skipBtn: {
    fontSize: 12, color: '#9ca3af', background: 'none', border: 'none',
    cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
  sidebar: {
    width: 192, minWidth: 192,
    background: '#f9fafb',
    borderRight: '0.5px solid #e5e7eb',
    display: 'flex', flexDirection: 'column',
    padding: '10px 0',
    overflowY: 'auto',
  },
  sideHead: {
    padding: '6px 16px 10px',
    fontSize: 10, fontWeight: 600, color: '#9ca3af',
    letterSpacing: '.08em', textTransform: 'uppercase',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  content: { flex: 1, padding: '16px 20px', overflowY: 'auto' },
  footer: {
    padding: '12px 20px',
    borderTop: '0.5px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  pills: { display: 'flex', gap: 4 },
  footerBtns: { display: 'flex', gap: 8 },
  btnSecondary: {
    fontSize: 13, fontWeight: 500, padding: '7px 16px',
    borderRadius: 8, cursor: 'pointer',
    border: '0.5px solid #d1d5db', background: '#fff', color: '#374151',
  },
  btnPrimary: {
    fontSize: 13, fontWeight: 500, padding: '7px 18px',
    borderRadius: 8, cursor: 'pointer',
    border: 'none', background: '#2563EB', color: '#fff',
  },
  tipRow: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#6b7280' },
  tipIcon: {
    width: 20, height: 20, borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, flexShrink: 0, marginTop: 1,
  },
};

const TIP_COLORS = {
  blue:  { bg: '#EFF6FF', color: '#1D4ED8' },
  green: { bg: '#F0FDF4', color: '#16A34A' },
  amber: { bg: '#FFFBEB', color: '#D97706' },
  red:   { bg: '#FEF2F2', color: '#DC2626' },
};

// Sidebar items only for middle steps (not splash/done)
const SIDEBAR_STEPS = STEPS.filter(s => s.type === 'screen');

// ─── Component ────────────────────────────────────────────────────────────────
export default function TourOverlay({ onFinish }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animKey, setAnimKey] = useState(0);

  const step = STEPS[current];
  const isFirst = current === 0;
  const isLast = current === STEPS.length - 1;
  const isMid = step.type === 'screen';

  const goTo = useCallback((idx) => {
    setDirection(idx > current ? 1 : -1);
    setAnimKey(k => k + 1);
    setCurrent(idx);
  }, [current]);

  const navigate = (dir) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, current + dir));
    goTo(next);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onFinish(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFinish]);

  // Block body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const sidebarIndex = SIDEBAR_STEPS.findIndex(s => s.id === step.id);

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onFinish(); }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(${direction > 0 ? '20px' : '-20px'}) } to { opacity: 1; transform: translateX(0) } }
        .tour-step-anim { animation: slideIn .22s ease; }
        .tour-sidebar-item:hover { background: #f3f4f6 !important; }
        .tour-btn-sec:hover { background: #f9fafb !important; }
        .tour-btn-pri:hover { background: #1D4ED8 !important; }
        .tour-skip:hover { color: #6b7280 !important; }
      `}</style>

      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.logoRow}>
            <div style={S.logoBox}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <span style={S.appName}>CoreInventory Tour</span>
            <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 10px', borderRadius: 20, fontWeight: 500, marginLeft: 6 }}>
              {current + 1} / {STEPS.length}
            </span>
          </div>
          <button className="tour-skip" style={S.skipBtn} onClick={onFinish}>Skip tour ✕</button>
        </div>

        <div style={S.body}>
          {/* Sidebar — only visible for screen steps */}
          <div style={{ ...S.sidebar, opacity: isMid ? 1 : 0, transition: 'opacity .2s', pointerEvents: isMid ? 'auto' : 'none' }}>
            <div style={S.sideHead}>Sections</div>
            {SIDEBAR_STEPS.map((s, i) => {
              const stepIdx = STEPS.findIndex(st => st.id === s.id);
              const isActive = s.id === step.id;
              const isDone = stepIdx < current;
              return (
                <div
                  key={s.id}
                  className="tour-sidebar-item"
                  onClick={() => goTo(stepIdx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 16px', cursor: 'pointer',
                    background: isActive ? '#fff' : 'transparent',
                    borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
                    fontSize: 13,
                    color: isActive ? '#111' : '#6b7280',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'background .12s',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: isActive || isDone ? '#2563EB' : '#e5e7eb',
                    color: isActive || isDone ? '#fff' : '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isDone ? 11 : 11, fontWeight: 600,
                  }}>
                    {isDone ? '✓' : isActive
                      ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'none' }} />
                      : i + 1
                    }
                  </div>
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div style={S.main}>
            <div style={S.content}>
              <div key={animKey} className="tour-step-anim">
                {step.type === 'splash' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, paddingTop: 16 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 18, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                      </svg>
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>{step.title}</h2>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, maxWidth: 380, margin: 0 }}>{step.desc}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                      {step.chips.map(c => (
                        <span key={c} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: '#f3f4f6', border: '0.5px solid #e5e7eb', color: '#374151' }}>{c}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 8 }}>→ Click Next to begin, or jump to any section from the sidebar</p>
                  </div>
                )}

                {step.type === 'screen' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{step.title}</h3>
                      <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
                    </div>
                    {screens[step.screen] && screens[step.screen]()}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {step.tips.map((t, i) => {
                        const tc = TIP_COLORS[t.color] || TIP_COLORS.blue;
                        return (
                          <div key={i} style={S.tipRow}>
                            <div style={{ ...S.tipIcon, background: tc.bg, color: tc.color }}>{t.icon}</div>
                            <span>{t.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step.type === 'done' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, paddingTop: 16 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✓</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 20 }}>🎉 📦 🎉</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>{step.title}</h2>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, maxWidth: 360, margin: 0 }}>{step.desc}</p>
                    <button
                      style={{ ...S.btnPrimary, marginTop: 8, padding: '10px 24px', fontSize: 14 }}
                      className="tour-btn-pri"
                      onClick={onFinish}
                    >
                      Go to Dashboard →
                    </button>
                    <p style={{ fontSize: 11.5, color: '#9ca3af' }}>You can replay this tour from your profile menu anytime</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={S.footer}>
              <div style={S.pills}>
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => goTo(i)}
                    style={{
                      height: 4, borderRadius: 2, cursor: 'pointer', transition: 'all .2s',
                      width: i === current ? 28 : 16,
                      background: i === current ? '#2563EB' : i < current ? 'rgba(37,99,235,.35)' : '#e5e7eb',
                    }}
                  />
                ))}
              </div>
              <div style={S.footerBtns}>
                {!isFirst && (
                  <button className="tour-btn-sec" style={S.btnSecondary} onClick={() => navigate(-1)}>
                    ← Back
                  </button>
                )}
                {!isLast && (
                  <button className="tour-btn-pri" style={S.btnPrimary} onClick={() => navigate(1)}>
                    {current === STEPS.length - 2 ? 'Finish tour →' : 'Next →'}
                  </button>
                )}
                {isLast && (
                  <button className="tour-btn-pri" style={S.btnPrimary} onClick={onFinish}>
                    Go to Dashboard →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}