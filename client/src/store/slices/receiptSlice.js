import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../configs/api';

export const fetchReceipts = createAsyncThunk('receipts/fetchAll', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/api/receipts/', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const fetchReceipt = createAsyncThunk('receipts/fetchOne', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/receipts/${id}`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const createReceipt = createAsyncThunk('receipts/create', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/api/receipts/', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const updateReceipt = createAsyncThunk('receipts/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/api/receipts/${id}`, data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const confirmReceipt = createAsyncThunk('receipts/confirm', async (id, { rejectWithValue }) => {
  try {
    const res = await api.post(`/api/receipts/${id}/confirm`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const validateReceipt = createAsyncThunk('receipts/validate', async (id, { rejectWithValue }) => {
  try {
    const res = await api.post(`/api/receipts/${id}/validate`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const cancelReceipt = createAsyncThunk('receipts/cancel', async (id, { rejectWithValue }) => {
  try {
    const res = await api.post(`/api/receipts/${id}/cancel`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

const receiptSlice = createSlice({
  name: 'receipts',
  initialState: { list: [], current: null, loading: false, error: null },
  reducers: { clearCurrent(state) { state.current = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReceipts.pending, (state) => { state.loading = true; })
      .addCase(fetchReceipts.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchReceipts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchReceipt.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(createReceipt.fulfilled, (state, action) => { state.list.unshift(action.payload); state.current = action.payload; })
      .addCase(updateReceipt.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(r => r.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(confirmReceipt.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(r => r.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(validateReceipt.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(r => r.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(cancelReceipt.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(r => r.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { clearCurrent } = receiptSlice.actions;
export default receiptSlice.reducer;
