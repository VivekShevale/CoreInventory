import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, TrendingDown, X, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../configs/api';
import { gsap } from 'gsap';

export default function StockAlertBell() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/stock/alerts');
      setAlerts(res.data);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Refresh every 60 seconds
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open && panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: -8, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' }
      );
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          !e.target.closest('[data-bell-btn]')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const outOfStock = alerts.filter(a => a.alert_type === 'out_of_stock');
  const lowStock = alerts.filter(a => a.alert_type === 'low_stock');
  const total = alerts.length;

  return (
    <div className="relative">
      <button
        data-bell-btn="true"
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative"
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-800 dark:text-white">Stock Alerts</span>
              {total > 0 && (
                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold px-1.5 py-0.5 rounded-full">
                  {total}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : total === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                  <Package size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">All stock levels are healthy</p>
                <p className="text-xs text-slate-400 mt-0.5">No alerts at this time</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Out of stock */}
                {outOfStock.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1.5">
                      Out of Stock ({outOfStock.length})
                    </p>
                    {outOfStock.map(alert => (
                      <button
                        key={alert.product_id}
                        onClick={() => { navigate(`/stock`); setOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={13} className="text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{alert.product_name}</p>
                          <p className="text-xs text-red-500 font-medium">0 units — Out of stock</p>
                        </div>
                        <span className="text-xs font-mono text-slate-400 flex-shrink-0">{alert.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Low stock */}
                {lowStock.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
                      Low Stock ({lowStock.length})
                    </p>
                    {lowStock.map(alert => (
                      <button
                        key={alert.product_id}
                        onClick={() => { navigate(`/stock`); setOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <TrendingDown size={13} className="text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{alert.product_name}</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {alert.on_hand} left · reorder at {alert.reorder_point}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-slate-400 flex-shrink-0">{alert.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {total > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { navigate('/stock'); setOpen(false); }}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline w-full text-center"
              >
                View all in Stock page →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
