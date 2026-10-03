import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Card, CardContent, Typography, Chip, IconButton, Button, Grid,
  TextField, MenuItem, Badge, Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Divider, Alert as MuiAlert, CircularProgress
} from '@mui/material';
import {
  Warning as WarningIcon, Error as ErrorIcon, Info as InfoIcon,
  CheckCircle as CheckIcon, Refresh as RefreshIcon, Delete as DeleteIcon,
  Visibility as ViewIcon, NotificationsActive as AlertActiveIcon,
  MarkEmailRead as MarkReadIcon
} from '@mui/icons-material';
import { alertAPI } from '../services/api';
import { displayAppName } from '../utils/appNames';
import PageHeader from '../components/PageHeader';

const API_BASE = import.meta.env.VITE_API_URL || '';

const severityConfig = {
  low: { color: 'info', icon: <InfoIcon />, bg: 'rgba(33, 150, 243, 0.15)' },
  medium: { color: 'warning', icon: <WarningIcon />, bg: 'rgba(255, 152, 0, 0.15)' },
  high: { color: 'error', icon: <ErrorIcon />, bg: 'rgba(244, 67, 54, 0.15)' },
  critical: { color: 'error', icon: <ErrorIcon />, bg: 'rgba(244, 67, 54, 0.3)' },
};

const typeLabels = {
  unauthorized_app: 'Unauthorized App',
  unusual_activity: 'Unusual Activity',
  policy_violation: 'Policy Violation',
  off_hours_usage: 'Off-Hours Usage',
  excessive_break: 'Excessive Break',
  suspicious_behavior: 'Suspicious Behavior',
  device_offline: 'Device Offline',
  custom: 'Custom',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, unread: 0 });
  const [filter, setFilter] = useState({ type: '', severity: '', employee_id: '' });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { employees } = useSelector((state) => state.dashboard);

  useEffect(() => {
    fetchAlerts();
    fetchStats();
    const interval = setInterval(() => {
      fetchAlerts();
      fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (filter.type) params.type = filter.type;
      if (filter.severity) params.severity = filter.severity;
      if (filter.employee_id) params.employee_id = filter.employee_id;
      const response = await alertAPI.getAll(params);
      setAlerts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await alertAPI.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await alertAPI.markAsRead(id);
      setAlerts(alerts.map(a => a._id === id ? { ...a, isRead: true } : a));
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await alertAPI.markAllAsRead();
      setAlerts(alerts.map(a => ({ ...a, isRead: true })));
      setStats(prev => ({ ...prev, unread: 0 }));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await alertAPI.acknowledge(id);
      setAlerts(alerts.map(a => a._id === id ? { ...a, isAcknowledged: true } : a));
    } catch (error) {
      console.error('Failed to acknowledge:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertAPI.delete(id);
      setAlerts(alerts.filter(a => a._id !== id));
      setDetailOpen(false);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const openDetail = (alert) => {
    setSelectedAlert(alert);
    setDetailOpen(true);
    if (!alert.isRead) handleMarkAsRead(alert._id);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box>
      <PageHeader
        icon={<AlertActiveIcon />}
        title="Alerts"
        subtitle="Policy violations and flagged activity across the team"
        actions={
          <>
            <Badge badgeContent={stats.unread} color="error" max={99}>
              <Chip size="small" label={`${stats.unread} unread`} color="error" variant="outlined" />
            </Badge>
            <Button startIcon={<MarkReadIcon />} onClick={handleMarkAllAsRead} disabled={stats.unread === 0}>
              Mark All Read
            </Button>
            <IconButton onClick={() => { fetchAlerts(); fetchStats(); }} sx={{ border: '1px solid rgba(148,163,184,0.22)' }}>
              <RefreshIcon />
            </IconButton>
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'rgba(255, 152, 0, 0.12)' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="bold" color="warning.main">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">Total Alerts</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'rgba(244, 67, 54, 0.12)' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="bold" color="error.main">{stats.unread}</Typography>
              <Typography variant="body2" color="text.secondary">Unread Alerts</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'rgba(76, 175, 80, 0.12)' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" fontWeight="bold" color="success.main">{stats.total - stats.unread}</Typography>
              <Typography variant="body2" color="text.secondary">Read / Acknowledged</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select size="small" label="Type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} sx={{ minWidth: 180 }}>
              <MenuItem value="">All Types</MenuItem>
              {Object.entries(typeLabels).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Severity" value={filter.severity} onChange={(e) => setFilter({ ...filter, severity: e.target.value })} sx={{ minWidth: 150 }}>
              <MenuItem value="">All Severities</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </TextField>
            <TextField select size="small" label="Employee" value={filter.employee_id} onChange={(e) => setFilter({ ...filter, employee_id: e.target.value })} sx={{ minWidth: 180 }}>
              <MenuItem value="">All Employees</MenuItem>
              {employees.map((emp) => (
                <MenuItem key={emp.employeeId} value={emp.employeeId}>{emp.name}</MenuItem>
              ))}
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No alerts found</Typography>
            <Typography variant="body2" color="text.secondary">All clear! No policy violations detected.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {alerts.map((alert) => {
            const sev = severityConfig[alert.severity] || severityConfig.medium;
            return (
              <Card
                key={alert._id}
                sx={{
                  mb: 2, cursor: 'pointer',
                  borderLeft: `4px solid ${alert.severity === 'critical' ? '#f44336' : alert.severity === 'high' ? '#f44336' : alert.severity === 'medium' ? '#ff9800' : '#2196f3'}`,
                  bgcolor: alert.isRead ? 'background.paper' : `${sev.bg}10`,
                  '&:hover': { boxShadow: 3 }
                }}
                onClick={() => openDetail(alert)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Avatar sx={{ bgcolor: sev.bg, color: `${sev.color}.main` }}>
                      {sev.icon}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight={alert.isRead ? 'normal' : 'bold'}>
                          {alert.title}
                        </Typography>
                        {!alert.isRead && <Chip label="New" size="small" color="error" />}
                        {alert.isAcknowledged && <Chip label="Acknowledged" size="small" color="success" variant="outlined" />}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {alert.message}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label={typeLabels[alert.type] || alert.type} size="small" variant="outlined" />
                        <Chip label={alert.severity.toUpperCase()} size="small" color={sev.color} />
                        <Chip label={alert.employeeId} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(alert.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(alert); }}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      {!alert.isAcknowledged && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert._id); }}>
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(alert._id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {severityConfig[selectedAlert.severity]?.icon}
                <Typography variant="h6">{selectedAlert.title}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={selectedAlert.data?.screenshotUrl ? 6 : 12}>
                  <MuiAlert severity={selectedAlert.severity === 'critical' || selectedAlert.severity === 'high' ? 'error' : selectedAlert.severity === 'medium' ? 'warning' : 'info'} sx={{ mb: 2 }}>
                    {selectedAlert.message}
                  </MuiAlert>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box><Typography variant="caption" color="text.secondary">Employee:</Typography> <Typography variant="body2" component="span" fontWeight="bold">{selectedAlert.employeeId}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Type:</Typography> <Typography variant="body2" component="span">{typeLabels[selectedAlert.type] || selectedAlert.type}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Severity:</Typography> <Chip label={selectedAlert.severity.toUpperCase()} size="small" color={severityConfig[selectedAlert.severity]?.color} sx={{ ml: 1 }} /></Box>
                    <Box><Typography variant="caption" color="text.secondary">App:</Typography> <Typography variant="body2" component="span">{selectedAlert.data?.appName || selectedAlert.data?.appPackage || 'N/A'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Package:</Typography> <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{selectedAlert.data?.appPackage || 'N/A'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Time:</Typography> <Typography variant="body2" component="span">{new Date(selectedAlert.createdAt).toLocaleString()}</Typography></Box>
                  </Box>
                </Grid>
                {selectedAlert.data?.screenshotUrl && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>Screenshot Evidence</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                      <img
                        src={`${API_BASE || ''}${selectedAlert.data.screenshotUrl}`}
                        alt="Screenshot evidence"
                        style={{ width: '100%', display: 'block' }}
                      />
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              {!selectedAlert.isAcknowledged && (
                <Button startIcon={<CheckIcon />} onClick={() => { handleAcknowledge(selectedAlert._id); setDetailOpen(false); }}>
                  Acknowledge
                </Button>
              )}
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(selectedAlert._id)}>
                Delete
              </Button>
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
