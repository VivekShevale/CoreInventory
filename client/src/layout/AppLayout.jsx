import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { gsap } from 'gsap';
import {
  LayoutDashboard, PackageCheck, Truck, History, Settings,
  ChevronDown, ChevronRight, Sun, Moon, User, LogOut,
  Warehouse, MapPin, Package, Layers, Menu, X, Bell, Box, SlidersHorizontal, BarChart3, ArrowLeftRight
} from 'lucide-react';
import { toggleTheme } from '../store/slices/themeSlice';
import StockAlertBell from '../components/StockAlertBell';
import { logout } from '../store/slices/authSlice';

const NAV = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    label: 'Products',
    icon: Box,
    path: '/products',
  },
  {
    label: 'Operations',
    icon: Layers,
    children: [
      { label: 'Receipts', path: '/receipts', icon: PackageCheck },
      { label: 'Delivery', path: '/delivery', icon: Truck },
      { label: 'Transfers', path: '/transfers', icon: ArrowLeftRight },
      { label: 'Adjustments', path: '/adjustments', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Stock',
    icon: BarChart3,
    path: '/stock',
  },
  {
    label: 'Move History',
    icon: History,
    path: '/move-history',
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Warehouse', path: '/settings/warehouse', icon: Warehouse },
      { label: 'Locations', path: '/settings/locations', icon: MapPin },
    ],
  },
];

export default function AppLayout({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector(s => s.auth);
  const { mode } = useSelector(s => s.theme);
  const [open, setOpen] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  useEffect(() => {
    gsap.fromTo(mainRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }, [location.pathname]);

  // Close sidebar when clicking outside (mobile)
  useEffect(() => {
    function handleClickOutside(event) {
      if (window.innerWidth < 640 && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (label) => setOpen(o => ({ ...o, [label]: !o[label] }));
  const isActive = (path) => location.pathname === path;
  const isGroupActive = (children) => children?.some(c => location.pathname.startsWith(c.path));

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Status color mapping (from ProjectDetail)
  const getStatusColor = (status) => {
    const colors = {
      PLANNING: "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200",
      ACTIVE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-900",
      ON_HOLD: "bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-900",
      COMPLETED: "bg-blue-200 text-blue-900 dark:bg-blue-500 dark:text-blue-900",
      CANCELLED: "bg-red-200 text-red-900 dark:bg-red-500 dark:text-red-900",
    };
    return colors[status] || "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200";
  };

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 overflow-hidden">
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col flex-shrink-0 z-30 max-sm:absolute max-sm:${sidebarOpen ? 'left-0' : '-left-full'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Package size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-base text-zinc-900 dark:text-white">
              Core<span className="text-blue-600 dark:text-blue-400">Inventory</span>
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="ml-auto text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden no-scrollbar">
          {NAV.map((item) => {
            const Icon = item.icon;
            if (item.children) {
              const active = isGroupActive(item.children);
              return (
                <div key={item.label} className="px-2">
                  <button
                    onClick={() => toggle(item.label)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-all
                      ${active
                        ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-200'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {open[item.label] || active
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />
                        }
                      </>
                    )}
                  </button>
                  {sidebarOpen && (open[item.label] || active) && (
                    <div className="ml-4 mt-1 pl-3 space-y-0.5">
                      {item.children.map(child => {
                        const CIcon = child.icon;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm transition-all
                              ${isActive(child.path)
                                ? 'bg-zinc-100 dark:bg-zinc-800/80 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                              }`}
                          >
                            <CIcon size={15} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={item.path} className="px-2">
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-all
                    ${isActive(item.path)
                      ? 'bg-zinc-100 dark:bg-zinc-800/80 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 relative">
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : <User size={15} className="text-blue-600 dark:text-blue-400" />
              }
            </div>
            {sidebarOpen && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate text-zinc-900 dark:text-white">
                  {user?.full_name || user?.login_id}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user?.login_id}</p>
              </div>
            )}
          </button>

          {profileOpen && (
            <div className="absolute bottom-16 left-2 right-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
              <Link
                to="/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-all"
              >
                <User size={15} /> My Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1" />
          <button
            onClick={() => dispatch(toggleTheme())}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <StockAlertBell />
          <Link
            to="/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20 flex items-center justify-center overflow-hidden">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : <User size={13} className="text-blue-600 dark:text-blue-400" />
              }
            </div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {user?.full_name || user?.login_id}
            </span>
          </Link>
        </header>

        {/* Page content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}