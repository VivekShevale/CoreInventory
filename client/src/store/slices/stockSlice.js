import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../configs/api';

export const fetchStock = createAsyncThunk('stock/fetchAll', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/api/stock/', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

export const updateStock = createAsyncThunk('stock/update', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/api/stock/update', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed');
  }
});

const stockSlice = createSlice({
  name: 'stock',
  initialState: { list: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStock.pending, (state) => { state.loading = true; })
      .addCase(fetchStock.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchStock.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export default stockSlice.reducer;
