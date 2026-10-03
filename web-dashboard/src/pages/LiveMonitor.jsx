import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Grid, Card, CardContent, Typography, Avatar, Chip, IconButton,
  Button, TextField, MenuItem, Alert, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, Divider, LinearProgress, Badge
} from '@mui/material';
import {
  Refresh as RefreshIcon, CameraAlt as CameraIcon,
  Person as PersonIcon, Circle as CircleIcon,
  Videocam as VideoIcon, Mic as MicIcon, Stop as StopIcon,
  LocationOn as LocationIcon, ScreenShare as ScreenIcon,
  Wifi as WifiIcon, WifiOff as WifiOffIcon, Groups as GroupsIcon,
  PersonOff as PersonOffIcon, Schedule as ScheduleIcon
} from '@mui/icons-material';
import { setEmployees, setSelectedEmployee, setActivities, setStats } from '../store/dashboardSlice';
import { employeeAPI, activityAPI, reportAPI } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';
import LiveScreenshots from '../components/Monitoring/LiveScreenshots';
import PageHeader from '../components/PageHeader';

const API_BASE = import.meta.env.VITE_API_URL || '';

const formatDuration = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

export default function LiveMonitor() {
  const dispatch = useDispatch();
  const { employees, selectedEmployee, activities, onlineEmployees } = useSelector((state) => state.dashboard);
  const { isConnected, requestScreenshot, sendCommand } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [audioDuration, setAudioDuration] = useState(10);
  const [audioTargetEmployee, setAudioTargetEmployee] = useState(null);
  const [screenRecordDialogOpen, setScreenRecordDialogOpen] = useState(false);
  const [screenRecordDuration, setScreenRecordDuration] = useState(30);
  const [screenRecordTargetEmployee, setScreenRecordTargetEmployee] = useState(null);

  useEffect(() => {
    fetchEmployees();
    fetchActivities();
    const interval = setInterval(() => {
      fetchEmployees();
      fetchActivities();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      dispatch(setEmployees(response.data.data));
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await activityAPI.getAll({ limit: 50 });
      dispatch(setActivities(response.data.data));
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchActivities()]);
    setLoading(false);
  };

  const handleRequestScreenshot = (employeeId) => {
    requestScreenshot(employeeId);
  };

  const handleCaptureCamera = (employeeId) => {
    sendCommand(employeeId, 'capture_camera');
  };

  const handleRecordAudio = (employeeId) => {
    const target = employeeId || audioTargetEmployee?.employeeId || selectedEmployee?.employeeId;
    if (!target) return;
    sendCommand(target, 'record_audio', { duration: audioDuration });
    setAudioDialogOpen(false);
  };

  const handleStartScreenRecord = (employeeId) => {
    const target = employeeId || screenRecordTargetEmployee?.employeeId || selectedEmployee?.employeeId;
    if (!target) return;
    sendCommand(target, 'screen_record_start', { duration: screenRecordDuration });
    setScreenRecordDialogOpen(false);
  };

  const handleTrackLocation = (employeeId) => {
    sendCommand(employeeId, 'track_location');
  };

  const getOnlineStatus = (employee) => {
    if (employee.isOnline) return true;
    if (employee.lastSeen) {
      const diff = Date.now() - new Date(employee.lastSeen).getTime();
      return diff < 120000;
    }
    return false;
  };

  const filteredEmployees = employees.filter(emp => {
    if (filter === 'online') return getOnlineStatus(emp);
    if (filter === 'offline') return !getOnlineStatus(emp);
    return true;
  });

  return (
    <Box>
      <PageHeader
        icon={<ScreenIcon />}
        title="Live Monitor"
        subtitle="Watch devices, push commands and stream captures in real time"
        actions={
          <>
            <TextField select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 130 }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="online">Online</MenuItem>
              <MenuItem value="offline">Offline</MenuItem>
            </TextField>
            <IconButton onClick={handleRefresh} disabled={loading} sx={{ border: '1px solid rgba(148,163,184,0.22)' }}>
              <RefreshIcon />
            </IconButton>
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total employees', value: employees.length, icon: <GroupsIcon fontSize="small" />, tint: 'rgba(6,182,212,0.16)', color: '#22d3ee' },
          { label: 'Online now', value: employees.filter(e => getOnlineStatus(e)).length, icon: <WifiIcon fontSize="small" />, tint: 'rgba(52,211,153,0.16)', color: '#34d399' },
          { label: 'Offline', value: employees.filter(e => !getOnlineStatus(e)).length, icon: <PersonOffIcon fontSize="small" />, tint: 'rgba(148,163,184,0.16)', color: '#94a3b8' },
          { label: 'Server link', value: isConnected ? 'Live' : 'Down', icon: isConnected ? <WifiIcon fontSize="small" /> : <WifiOffIcon fontSize="small" />, tint: isConnected ? 'rgba(167,139,250,0.16)' : 'rgba(248,113,113,0.16)', color: isConnected ? '#a78bfa' : '#f87171' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card sx={{ '&:hover': { borderColor: 'rgba(6,182,212,0.35)' } }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: s.tint, color: s.color, border: `1px solid ${s.color}33`,
                  }}>
                    {s.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={{ lineHeight: 1.1, color: s.color }}>{s.value}</Typography>
                    <Typography variant="caption" noWrap sx={{ color: '#94a3b8', fontWeight: 600 }}>
                      {s.label}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <LiveScreenshots liveEmployees={onlineEmployees} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                <Box>
                  <Typography variant="h6">Employees</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Select a person to push live commands
                  </Typography>
                </Box>
                <Chip size="small" color="primary" label={`${filteredEmployees.length} of ${employees.length}`} />
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ maxHeight: 620, overflow: 'auto' }}>
                {filteredEmployees.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <GroupsIcon sx={{ fontSize: 40, mb: 1, opacity: 0.6 }} />
                    <Typography variant="body2">No employees match this filter</Typography>
                  </Box>
                )}
                {filteredEmployees.map((employee) => {
                  const online = getOnlineStatus(employee);
                  const active = selectedEmployee?.employeeId === employee.employeeId;
                  return (
                  <Box
                    key={employee.employeeId}
                    onClick={() => dispatch(setSelectedEmployee(employee))}
                    sx={{
                      display: 'flex', alignItems: 'center', p: 1.5, mb: 1, borderRadius: 2.5,
                      cursor: 'pointer',
                      border: active ? '1px solid rgba(6,182,212,0.55)' : '1px solid rgba(148,163,184,0.12)',
                      background: active
                        ? 'linear-gradient(90deg, rgba(6,182,212,0.14) 0%, rgba(6,182,212,0.03) 100%)'
                        : 'rgba(148,163,184,0.03)',
                      opacity: online ? 1 : 0.72,
                      transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease',
                      '&:hover': {
                        borderColor: 'rgba(6,182,212,0.4)',
                        transform: 'translateX(3px)',
                        opacity: 1,
                      },
                    }}
                  >
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      variant="dot"
                      sx={{ mr: 1.75, '& .MuiBadge-badge': { backgroundColor: online ? '#34d399' : '#64748b', boxShadow: '0 0 0 2px #12161f' } }}
                    >
                      <Avatar sx={{
                        width: 42, height: 42,
                        bgcolor: online ? 'rgba(52,211,153,0.18)' : 'rgba(148,163,184,0.14)',
                        color: online ? '#6ee7b7' : '#94a3b8',
                        backgroundImage: 'none',
                        fontWeight: 700,
                      }}>
                        {(employee.name?.charAt(0) || 'E').toUpperCase()}
                      </Avatar>
                    </Badge>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={650} noWrap>{employee.name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {employee.employeeId} · {employee.department || 'General'}
                        {employee.group ? ` · ${employee.group}` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        size="small"
                        label={getOnlineStatus(employee) ? 'Online' : 'Offline'}
                        color={getOnlineStatus(employee) ? 'success' : 'default'}
                      />
                      {getOnlineStatus(employee) && (
                        <>
                          <Tooltip title="Screenshot">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRequestScreenshot(employee.employeeId); }}>
                              <CameraIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Camera Capture">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCaptureCamera(employee.employeeId); }}>
                              <VideoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Record Audio">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAudioTargetEmployee(employee); dispatch(setSelectedEmployee(employee)); setAudioDialogOpen(true); }}>
                              <MicIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Screen Record">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setScreenRecordTargetEmployee(employee); dispatch(setSelectedEmployee(employee)); setScreenRecordDialogOpen(true); }}>
                              <ScreenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Track Location">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleTrackLocation(employee.employeeId); }}>
                              <LocationIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3, background: 'linear-gradient(160deg, rgba(6,182,212,0.10) 0%, rgba(18,22,31,0.9) 60%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Typography variant="h6" noWrap>Connection Status</Typography>
                <CircleIcon sx={{ color: isConnected ? '#34d399' : '#f87171', fontSize: 12 }} />
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Chip
                  size="small"
                  color={isConnected ? 'success' : 'error'}
                  label={isConnected ? 'Connected' : 'Disconnected'}
                  icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {isConnected
                  ? 'Streaming updates from the monitoring server'
                  : 'Reconnecting to the monitoring server'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary">Devices online</Typography>
                <Typography variant="caption" fontWeight={700}>
                  {employees.filter(e => getOnlineStatus(e)).length} / {employees.length}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={employees.length ? (employees.filter(e => getOnlineStatus(e)).length / employees.length) * 100 : 0}
                color={isConnected ? 'primary' : 'error'}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </CardContent>
          </Card>

          {selectedEmployee && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Selected Employee</Typography>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Avatar sx={{
                    width: 72, height: 72, mx: 'auto', mb: 1, fontSize: 28, fontWeight: 700,
                    boxShadow: '0 10px 30px rgba(6,182,212,0.28)',
                  }}>
                    {(selectedEmployee.name?.charAt(0) || 'E').toUpperCase()}
                  </Avatar>
                  <Typography fontWeight={700}>{selectedEmployee.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedEmployee.employeeId}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 1.25 }}>
                    <Chip
                      size="small"
                      label={getOnlineStatus(selectedEmployee) ? 'Online' : 'Offline'}
                      color={getOnlineStatus(selectedEmployee) ? 'success' : 'default'}
                    />
                    <Chip size="small" label={selectedEmployee.department || 'General'} variant="outlined" />
                    <Chip size="small" label={selectedEmployee.group || 'Default'} variant="outlined" />
                  </Box>
                </Box>
                <Divider sx={{ mb: 1.5 }} />
                {getOnlineStatus(selectedEmployee) ? (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="outlined" startIcon={<CameraIcon />} onClick={() => handleRequestScreenshot(selectedEmployee.employeeId)}>Screenshot</Button>
                    <Button size="small" variant="outlined" startIcon={<VideoIcon />} onClick={() => handleCaptureCamera(selectedEmployee.employeeId)}>Camera</Button>
                    <Button size="small" variant="outlined" startIcon={<MicIcon />} onClick={() => { setAudioTargetEmployee(selectedEmployee); setAudioDialogOpen(true); }}>Audio</Button>
                    <Button size="small" variant="outlined" startIcon={<ScreenIcon />} onClick={() => { setScreenRecordTargetEmployee(selectedEmployee); setScreenRecordDialogOpen(true); }}>Record</Button>
                    <Button size="small" variant="outlined" startIcon={<LocationIcon />} onClick={() => handleTrackLocation(selectedEmployee.employeeId)}>Location</Button>
                  </Stack>
                ) : (
                  <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                    Device is offline — commands become available once it reconnects.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="h6">Recent Activity</Typography>
                <Chip size="small" label={`${activities.length}`} color="primary" variant="outlined" />
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                {activities.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                    <ScheduleIcon sx={{ fontSize: 34, mb: 1, opacity: 0.6 }} />
                    <Typography variant="body2">No activity reported yet</Typography>
                  </Box>
                )}
                {activities.slice(0, 10).map((activity, index) => (
                  <Stack
                    key={index}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                      py: 1.15,
                      borderBottom: index < Math.min(activities.length, 10) - 1 ? '1px solid rgba(148,163,184,0.10)' : 'none',
                    }}
                  >
                    <Box sx={{
                      width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'rgba(6,182,212,0.12)', color: '#22d3ee',
                    }}>
                      <ScheduleIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {activity.appName || activity.appPackage}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {activity.employeeId} · {formatDuration(activity.durationMs || 0)}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={audioDialogOpen} onClose={() => setAudioDialogOpen(false)}>
        <DialogTitle>Record Audio {audioTargetEmployee ? `(${audioTargetEmployee.name || audioTargetEmployee.employeeId})` : ''}</DialogTitle>
        <DialogContent>
          <TextField
            label="Duration (seconds)"
            type="number"
            fullWidth
            value={audioDuration}
            onChange={(e) => setAudioDuration(parseInt(e.target.value) || 10)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAudioDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => handleRecordAudio()}>Start Recording</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={screenRecordDialogOpen} onClose={() => setScreenRecordDialogOpen(false)}>
        <DialogTitle>Screen Recording {screenRecordTargetEmployee ? `(${screenRecordTargetEmployee.name || screenRecordTargetEmployee.employeeId})` : ''}</DialogTitle>
        <DialogContent>
          <TextField
            label="Duration (seconds)"
            type="number"
            fullWidth
            value={screenRecordDuration}
            onChange={(e) => setScreenRecordDuration(parseInt(e.target.value) || 30)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScreenRecordDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => handleStartScreenRecord()}>Start Recording</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
