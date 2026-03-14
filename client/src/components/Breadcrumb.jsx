import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const CRUMB_LABELS = {
  dashboard: 'Dashboard',
  products: 'Products',
  receipts: 'Receipts',
  delivery: 'Delivery',
  stock: 'Stock',
  'move-history': 'Move History',
  transfers: 'Transfers',
  settings: 'Settings',
  warehouse: 'Warehouse',
  locations: 'Locations',
  profile: 'My Profile',
  new: 'New',
  adjustments: 'Adjustments',
};

export default function Breadcrumb({ extra = [] }) {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);

  const crumbs = parts.map((part, i) => ({
    label: CRUMB_LABELS[part] || (isNaN(part) ? part : `#${part}`),
    path: '/' + parts.slice(0, i + 1).join('/'),
    isLast: i === parts.length - 1 && extra.length === 0,
  }));

  const allCrumbs = [...crumbs, ...extra.map((e, i) => ({ ...e, isLast: i === extra.length - 1 }))];

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-5">
      <Link to="/dashboard" className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
        <Home size={14} />
      </Link>
      {allCrumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />
          {crumb.isLast ? (
            <span className="text-slate-700 dark:text-slate-200 font-medium">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
