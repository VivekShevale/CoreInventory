import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../configs/api';

export const fetchWarehouses = createAsyncThunk('warehouse/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/api/warehouses/');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const createWarehouse = createAsyncThunk('warehouse/create', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/api/warehouses/', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const updateWarehouse = createAsyncThunk('warehouse/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/api/warehouses/${id}`, data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const deleteWarehouse = createAsyncThunk('warehouse/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/api/warehouses/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const fetchLocations = createAsyncThunk('warehouse/fetchLocations', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/api/locations/', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const createLocation = createAsyncThunk('warehouse/createLocation', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/api/locations/', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const deleteLocation = createAsyncThunk('warehouse/deleteLocation', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/api/locations/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

const warehouseSlice = createSlice({
  name: 'warehouse',
  initialState: { warehouses: [], locations: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWarehouses.fulfilled, (state, action) => { state.warehouses = action.payload; })
      .addCase(createWarehouse.fulfilled, (state, action) => { state.warehouses.push(action.payload); })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        const idx = state.warehouses.findIndex(w => w.id === action.payload.id);
        if (idx !== -1) state.warehouses[idx] = action.payload;
      })
      .addCase(deleteWarehouse.fulfilled, (state, action) => {
        state.warehouses = state.warehouses.filter(w => w.id !== action.payload);
      })
      .addCase(fetchLocations.fulfilled, (state, action) => { state.locations = action.payload; })
      .addCase(createLocation.fulfilled, (state, action) => { state.locations.push(action.payload); })
      .addCase(deleteLocation.fulfilled, (state, action) => {
        state.locations = state.locations.filter(l => l.id !== action.payload);
      });
  },
});

export default warehouseSlice.reducer;
