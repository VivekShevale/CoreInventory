export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount || 0);
};

export const statusColor = (status) => {
  const map = {
    draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    canceled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  };
  return map[status] || map.draft;
};

export const isLate = (scheduledDate) => {
  if (!scheduledDate) return false;
  return new Date(scheduledDate) < new Date();
};

export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
