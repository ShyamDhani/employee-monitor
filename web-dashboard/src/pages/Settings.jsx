import { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Switch, FormControlLabel, Grid, Alert, Divider, CircularProgress } from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    'monitoring.default_screenshot_interval': 30,
    'monitoring.default_activity_interval': 5,
    'monitoring.heartbeat_timeout': 90,
    'monitoring.enabled': true,
    'monitoring.location_tracking': false,
    'monitoring.camera_mic_monitoring': true,
    'monitoring.network_monitoring': true,
    'retention.activity_days': 90,
    'retention.screenshot_days': 30,
    'alerts.enabled': true,
    'alerts.off_hours_start': 22,
    'alerts.off_hours_end': 6,
    'productivity.unproductive_apps': 'com.facebook.katana,com.instagram.android,com.twitter.android,com.ss.android.ugc.trill,com.google.android.youtube',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const flat = {};
        for (const [prefix, group] of Object.entries(data.data)) {
          for (const [key, setting] of Object.entries(group)) {
            flat[key] = setting.value;
          }
        }
        setSettings((prev) => ({ ...prev, ...flat }));
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
      setError('Failed to load settings from server');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.message || 'Failed to save');
      }
    } catch (e) {
      setError('Failed to save settings to server');
    }
  };

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Settings</Typography>
        <Button startIcon={<RefreshIcon />} onClick={fetchSettings}>Reload</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Settings saved to server successfully</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Monitoring Intervals</Typography>
              <TextField fullWidth type="number" label="Screenshot Interval (seconds)" value={settings['monitoring.default_screenshot_interval']} onChange={(e) => handleChange('monitoring.default_screenshot_interval', parseInt(e.target.value))} margin="normal" size="small" />
              <TextField fullWidth type="number" label="Activity Check Interval (seconds)" value={settings['monitoring.default_activity_interval']} onChange={(e) => handleChange('monitoring.default_activity_interval', parseInt(e.target.value))} margin="normal" size="small" />
              <TextField fullWidth type="number" label="Heartbeat Timeout (seconds)" value={settings['monitoring.heartbeat_timeout']} onChange={(e) => handleChange('monitoring.heartbeat_timeout', parseInt(e.target.value))} margin="normal" size="small" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Data Retention</Typography>
              <TextField fullWidth type="number" label="Activity Data Retention (days)" value={settings['retention.activity_days']} onChange={(e) => handleChange('retention.activity_days', parseInt(e.target.value))} margin="normal" size="small" />
              <TextField fullWidth type="number" label="Screenshot Retention (days)" value={settings['retention.screenshot_days']} onChange={(e) => handleChange('retention.screenshot_days', parseInt(e.target.value))} margin="normal" size="small" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Monitoring Features</Typography>
              <FormControlLabel control={<Switch checked={settings['monitoring.enabled']} onChange={(e) => handleChange('monitoring.enabled', e.target.checked)} />} label="Enable Monitoring" />
              <FormControlLabel control={<Switch checked={settings['monitoring.network_monitoring']} onChange={(e) => handleChange('monitoring.network_monitoring', e.target.checked)} />} label="Network Monitoring" />
              <FormControlLabel control={<Switch checked={settings['monitoring.location_tracking']} onChange={(e) => handleChange('monitoring.location_tracking', e.target.checked)} />} label="Location Tracking" />
              <FormControlLabel control={<Switch checked={settings['monitoring.camera_mic_monitoring']} onChange={(e) => handleChange('monitoring.camera_mic_monitoring', e.target.checked)} />} label="Camera/Microphone Monitoring" />
            </CardContent>
          </Card>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Off-Hours Alert</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField type="number" label="Start Hour (24h)" value={settings['alerts.off_hours_start']} onChange={(e) => handleChange('alerts.off_hours_start', parseInt(e.target.value))} margin="normal" size="small" inputProps={{ min: 0, max: 23 }} />
                <TextField type="number" label="End Hour (24h)" value={settings['alerts.off_hours_end']} onChange={(e) => handleChange('alerts.off_hours_end', parseInt(e.target.value))} margin="normal" size="small" inputProps={{ min: 0, max: 23 }} />
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Unproductive Apps (comma separated)</Typography>
              <TextField fullWidth multiline rows={3} value={settings['productivity.unproductive_apps']} onChange={(e) => handleChange('productivity.unproductive_apps', e.target.value)} margin="normal" size="small" placeholder="com.facebook.katana,com.instagram.android" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>Save Settings</Button>
      </Box>
    </Box>
  );
}
