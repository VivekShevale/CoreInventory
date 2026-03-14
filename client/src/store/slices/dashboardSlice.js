import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../configs/api';

export const fetchDashboardStats = createAsyncThunk('dashboard/stats', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/api/dashboard/stats');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to fetch stats');
  }
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: { stats: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (state) => { state.loading = true; })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
