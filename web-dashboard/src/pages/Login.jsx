import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  Divider, Link, InputAdornment, IconButton, Stack, Chip, Avatar, useMediaQuery, useTheme
} from '@mui/material';
import {
  Visibility, VisibilityOff, MonitorHeart, ShieldMoon as ShieldIcon,
  Videocam as CameraIcon, Insights as InsightsIcon, CheckCircle as CheckIcon,
  East as ArrowIcon
} from '@mui/icons-material';
import { setCredentials, setLoading, setError, clearError } from '../store/authSlice';
import { authAPI } from '../services/api';

const highlights = [
  { icon: <CameraIcon fontSize="small" />, text: 'Live screenshots, audio and screen recordings' },
  { icon: <InsightsIcon fontSize="small" />, text: 'Productivity analytics, timelines and reports' },
  { icon: <ShieldIcon fontSize="small" />, text: 'Real-time policy alerts and geofencing' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#0a0d14',
        backgroundImage:
          'radial-gradient(900px 500px at 10% 0%, rgba(6,182,212,0.14) 0%, transparent 60%), radial-gradient(800px 500px at 100% 100%, rgba(167,139,250,0.12) 0%, transparent 55%)',
      }}
    >
      {isDesktop && (
        <Box
          sx={{
            flex: '0 0 46%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 6,
            borderRight: '1px solid rgba(148,163,184,0.12)',
            background:
              'linear-gradient(160deg, rgba(6,182,212,0.10) 0%, rgba(10,13,20,0.2) 55%, rgba(167,139,250,0.08) 100%)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.75}>
            <Avatar
              sx={{
                width: 46, height: 46, borderRadius: 2.5,
                background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
                boxShadow: '0 10px 30px rgba(6,182,212,0.35)',
              }}
            >
              <MonitorHeart sx={{ color: '#04141a' }} />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>EmployeeMonitor</Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                Workforce monitoring suite
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ my: 6 }}>
            <Chip
              size="small"
              label="Secure admin access"
              color="primary"
              icon={<ShieldIcon />}
              sx={{ mb: 2.5 }}
            />
            <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: '-0.03em', lineHeight: 1.15, maxWidth: 460 }}>
              See what your team is working on.
            </Typography>
            <Typography variant="body1" sx={{ color: '#94a3b8', mt: 2, maxWidth: 460 }}>
              Monitor activity, screenshots, location and app usage from a single, real-time dashboard.
            </Typography>

            <Stack spacing={1.5} sx={{ mt: 4 }}>
              {highlights.map((h) => (
                <Stack key={h.text} direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 34, height: 34, borderRadius: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#22d3ee', bgcolor: 'rgba(6,182,212,0.12)',
                      border: '1px solid rgba(6,182,212,0.28)',
                    }}
                  >
                    {h.icon}
                  </Box>
                  <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 500 }}>{h.text}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Typography variant="caption" sx={{ color: '#64748b' }}>
            © {new Date().getFullYear()} EmployeeMonitor · All activity data is encrypted in transit
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4 },
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 0, sm: 1 },
            background: 'rgba(18,22,31,0.9)',
            boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 }, '&:last-child': { pb: { xs: 3, sm: 4 } } }}>
            <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Avatar
                sx={{
                  width: 40, height: 40, borderRadius: 2,
                  background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
                }}
              >
                <MonitorHeart sx={{ color: '#04141a', fontSize: 22 }} />
              </Avatar>
              <Typography variant="h6" fontWeight={800}>EmployeeMonitor</Typography>
            </Box>

            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
              {isRegister ? 'Create your account' : 'Welcome back'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              {isRegister ? 'Set up a new admin login for the dashboard' : 'Sign in to open the monitoring dashboard'}
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

            <Button
              fullWidth
              variant="outlined"
              onClick={handleGoogleLogin}
              sx={{
                mb: 2,
                py: 1.15,
                borderColor: 'rgba(148,163,184,0.28)',
                color: '#e2e8f0',
                '&:hover': { borderColor: 'rgba(148,163,184,0.5)', bgcolor: 'rgba(148,163,184,0.08)' },
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, marginRight: 10 }} />
              Continue with Google
            </Button>

            <Divider sx={{ my: 2.5, '&::before, &::after': { borderColor: 'rgba(148,163,184,0.2)' } }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>OR</Typography>
            </Divider>

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <TextField
                  fullWidth
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}
              <TextField
                fullWidth
                label="Email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                endIcon={<ArrowIcon />}
                sx={{ py: 1.3, fontSize: '0.98rem' }}
              >
                {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 3, justifyContent: 'center' }}>
              <CheckIcon fontSize="small" sx={{ color: '#34d399' }} />
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Role-based access · sessions are protected
              </Typography>
            </Stack>

            <Typography variant="body2" textAlign="center" sx={{ mt: 2.5 }}>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                component="button"
                variant="body2"
                underline="hover"
                fontWeight={700}
                onClick={() => { setIsRegister(!isRegister); dispatch(clearError()); }}
              >
                {isRegister ? 'Sign In' : 'Create Account'}
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
