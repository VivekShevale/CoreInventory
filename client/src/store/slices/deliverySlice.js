import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../configs/api';

export const fetchDeliveries = createAsyncThunk('delivery/fetchAll', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/api/delivery/', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const fetchDelivery = createAsyncThunk('delivery/fetchOne', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/delivery/${id}`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const createDelivery = createAsyncThunk('delivery/create', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/api/delivery/', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const updateDelivery = createAsyncThunk('delivery/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/api/delivery/${id}`, data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const validateDelivery = createAsyncThunk('delivery/validate', async (id, { rejectWithValue }) => {
  try {
    const res = await api.post(`/api/delivery/${id}/validate`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const cancelDelivery = createAsyncThunk('delivery/cancel', async (id, { rejectWithValue }) => {
  try {
    const res = await api.post(`/api/delivery/${id}/cancel`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

const deliverySlice = createSlice({
  name: 'delivery',
  initialState: { list: [], current: null, loading: false, error: null },
  reducers: { clearCurrent(state) { state.current = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeliveries.pending, (state) => { state.loading = true; })
      .addCase(fetchDeliveries.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchDeliveries.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchDelivery.fulfilled, (state, action) => { state.current = action.payload; })
      .addCase(createDelivery.fulfilled, (state, action) => { state.list.unshift(action.payload); state.current = action.payload; })
      .addCase(updateDelivery.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(d => d.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(validateDelivery.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(d => d.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(cancelDelivery.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex(d => d.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { clearCurrent } = deliverySlice.actions;
export default deliverySlice.reducer;
