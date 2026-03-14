import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setTheme } from './store/slices/themeSlice';
import { fetchMe } from './store/slices/authSlice';

// Layout
import AppLayout from './layout/AppLayout';
import AuthGuard from './components/AuthGuard';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// App pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ReceiptsPage from './pages/receipts/ReceiptsPage';
import ReceiptDetailPage from './pages/receipts/ReceiptDetailPage';
import DeliveryPage from './pages/delivery/DeliveryPage';
import DeliveryDetailPage from './pages/delivery/DeliveryDetailPage';
import StockPage from './pages/stock/StockPage';
import MoveHistoryPage from './pages/movehistory/MoveHistoryPage';
import WarehousePage from './pages/settings/WarehousePage';
import LocationsPage from './pages/settings/LocationsPage';
import LocationDetailPage from './pages/settings/LocationDetailPage';
import WarehouseDetailPage from './pages/settings/WarehouseDetailPage';
import AdjustmentsPage from './pages/adjustments/AdjustmentsPage';
import ProfilePage from './pages/profile/ProfilePage';
import ProductsPage from './pages/products/ProductsPage';
import ProductDetailPage from './pages/products/ProductDetailPage';
import TransferPage from './pages/transfers/TransferPage';
import TransferDetailPage from './pages/transfers/TransferDetailPage';

function ProtectedRoute({ children }) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const { mode } = useSelector(s => s.theme);
  const { token } = useSelector(s => s.auth);

  // Apply saved theme on mount
  useEffect(() => {
    dispatch(setTheme(mode));
  }, []);

  // Re-fetch user on reload if token exists
  useEffect(() => {
    if (token) dispatch(fetchMe());
  }, []);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/receipts" element={<ProtectedRoute><ReceiptsPage /></ProtectedRoute>} />
      <Route path="/receipts/:id" element={<ProtectedRoute><ReceiptDetailPage /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute><DeliveryPage /></ProtectedRoute>} />
      <Route path="/delivery/:id" element={<ProtectedRoute><DeliveryDetailPage /></ProtectedRoute>} />
      <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
      <Route path="/move-history" element={<ProtectedRoute><MoveHistoryPage /></ProtectedRoute>} />
      <Route path="/adjustments" element={<ProtectedRoute><AdjustmentsPage /></ProtectedRoute>} />
      <Route path="/settings/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
      <Route path="/settings/warehouse/:id" element={<ProtectedRoute><WarehouseDetailPage /></ProtectedRoute>} />
      <Route path="/settings/locations/:id" element={<ProtectedRoute><LocationDetailPage /></ProtectedRoute>} />
      <Route path="/settings/locations" element={<ProtectedRoute><LocationsPage /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
      <Route path="/products/:id" element={<ProtectedRoute><ProductDetailPage /></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><TransferPage /></ProtectedRoute>} />
      <Route path="/transfers/:id" element={<ProtectedRoute><TransferDetailPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
