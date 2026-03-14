import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import themeReducer from './slices/themeSlice';
import receiptReducer from './slices/receiptSlice';
import deliveryReducer from './slices/deliverySlice';
import stockReducer from './slices/stockSlice';
import dashboardReducer from './slices/dashboardSlice';
import warehouseReducer from './slices/warehouseSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    receipts: receiptReducer,
    delivery: deliveryReducer,
    stock: stockReducer,
    dashboard: dashboardReducer,
    warehouse: warehouseReducer,
  },
});

export default store;
