import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMe } from '../store/slices/authSlice';
import { LoadingSpinner } from './ui';

export default function AuthGuard({ children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, user, loading } = useSelector(s => s.auth);

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else if (!user) {
      dispatch(fetchMe());
    }
  }, [token, user, dispatch, navigate]);

  if (!token) return null;
  if (!user) return <LoadingSpinner />;
  return children;
}
