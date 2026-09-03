import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  Divider, Link, InputAdornment, IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, MonitorHeart } from '@mui/icons-material';
import { setCredentials, setLoading, setError, clearError } from '../store/authSlice';
import { authAPI } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(setLoading(true));
    dispatch(clearError());
    try {
      let response;
      if (isRegister) {
        response = await authAPI.register(email, password, name);
      } else {
        response = await authAPI.login(email, password);
      }
      dispatch(setCredentials(response.data));
      navigate('/');
    } catch (err) {
      dispatch(setError(err.response?.data?.message || 'Authentication failed'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)' }}>
      <Card sx={{ width: '100%', maxWidth: 420, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <MonitorHeart sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold">Employee Monitor</Typography>
            <Typography variant="body2" color="text.secondary">
              {isRegister ? 'Create your account' : 'Sign in to dashboard'}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Button fullWidth variant="outlined" onClick={handleGoogleLogin} sx={{ mb: 2, textTransform: 'none' }}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 20, marginRight: 12 }} />
            Continue with Google
          </Button>

          <Divider sx={{ my: 2 }}>OR</Divider>

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
            )}
            <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ mb: 2 }}>
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <Typography variant="body2" textAlign="center">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <Link component="button" variant="body2" onClick={() => { setIsRegister(!isRegister); dispatch(clearError()); }}>
              {isRegister ? 'Sign In' : 'Create Account'}
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
