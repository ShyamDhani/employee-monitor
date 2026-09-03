import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, logout, setLoading, setError } from '../store/authSlice';
import { authAPI } from '../services/api';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const login = useCallback(async (email, password) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await authAPI.login(email, password);
      dispatch(setCredentials(response.data));
      return true;
    } catch (err) {
      dispatch(setError(err.response?.data?.message || 'Login failed'));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const register = useCallback(async (email, password, name) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await authAPI.register(email, password, name);
      dispatch(setCredentials(response.data));
      return true;
    } catch (err) {
      dispatch(setError(err.response?.data?.message || 'Registration failed'));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const logoutUser = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  const checkAuth = useCallback(async () => {
    if (!token) return;
    try {
      const response = await authAPI.getMe();
      dispatch(setCredentials({ user: response.data.user, token }));
    } catch (err) {
      dispatch(logout());
    }
  }, [token, dispatch]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout: logoutUser,
  };
};

export default useAuth;
