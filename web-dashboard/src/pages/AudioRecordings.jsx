import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, IconButton, Button, TextField,
  MenuItem, Chip, Alert, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Slider, Tooltip
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, Delete, Refresh, Mic, Download, AccessTime
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_URL || '';

const formatDuration = (ms) => {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  return mb > 1 ? `${mb.toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
};

export default function AudioRecordings() {
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [playingId, setPlayingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const audioRef = useRef(null);
  const progressInterval = useRef(null);

  useEffect(() => {
    loadAudios();
    loadEmployees();
    const interval = setInterval(loadAudios, 10000);
    return () => {
      clearInterval(interval);
      if (audioRef.current) audioRef.current.pause();
      clearInterval(progressInterval.current);
    };
  }, [selectedEmployee]);

  async function loadAudios() {
    try {
      const params = selectedEmployee !== 'all' ? `?employee_id=${selectedEmployee}` : '';
      const res = await fetch(`${API_BASE}/api/audio${params}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAudios(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch audios:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEmployees(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch employees:', e);
    }
  }

  const playAudio = async (audio) => {
    if (playingId === audio._id) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
        clearInterval(progressInterval.current);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      clearInterval(progressInterval.current);
    }

    try {
      const res = await fetch(`${API_BASE}/api/audio/${audio._id}/stream`);
      if (!res.ok) throw new Error('Failed to fetch audio');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audioEl = new Audio(url);

      audioEl.onloadedmetadata = () => setDuration(audioEl.duration * 1000);
      audioEl.ontimeupdate = () => setProgress(audioEl.currentTime * 1000);
      audioEl.onended = () => {
        setPlayingId(null);
        setProgress(0);
        clearInterval(progressInterval.current);
        URL.revokeObjectURL(url);
      };

      audioRef.current = audioEl;
      setPlayingId(audio._id);
      setProgress(0);
      audioEl.play();
    } catch (e) {
      console.error('Failed to play audio:', e);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingId(null);
      setProgress(0);
      clearInterval(progressInterval.current);
    }
  };

  const seekAudio = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value / 1000;
      setProgress(value);
    }
  };

  const downloadAudio = async (audio) => {
    try {
      const res = await fetch(`${API_BASE}/api/audio/${audio._id}/stream`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_${audio.employeeId}_${new Date(audio.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download audio:', e);
    }
  };

  const deleteAudio = async (id) => {
    try {
      await fetch(`${API_BASE}/api/audio/${id}`, { method: 'DELETE' });
      setAudios((prev) => prev.filter((a) => a._id !== id));
      setDeleteConfirm(null);
      if (playingId === id) stopAudio();
    } catch (e) {
      console.error('Failed to delete audio:', e);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          <Mic sx={{ mr: 1, verticalAlign: 'middle' }} />
          Audio Recordings ({audios.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            select size="small" value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Employees</MenuItem>
            {employees.map((emp) => (
              <MenuItem key={emp.employeeId} value={emp.employeeId}>
                {emp.name || emp.employeeId}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => { setLoading(true); loadAudios(); }}>
            Refresh
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : audios.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <Mic sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No recordings yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Click the mic icon on an employee in Live Monitor to start a recording
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {audios.map((audio) => (
            <Grid item xs={12} sm={6} md={4} key={audio._id}>
              <Card sx={{
                border: playingId === audio._id ? '2px solid #06b6d4' : '1px solid #27272a',
                transition: 'all 0.2s',
                '&:hover': { boxShadow: 3 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography fontWeight="bold" fontSize="14" color="text.primary">
                        {audio.employeeId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(audio.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      icon={<AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />}
                      label={formatDuration(audio.durationMs)}
                      variant="outlined"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
                    <IconButton size="small" onClick={() => playAudio(audio)}
                      color={playingId === audio._id ? 'primary' : 'default'}>
                      {playingId === audio._id ? <Pause /> : <PlayArrow />}
                    </IconButton>
                    {playingId === audio._id && (
                      <IconButton size="small" onClick={stopAudio}><Stop /></IconButton>
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Slider size="small"
                        value={playingId === audio._id ? progress : 0}
                        max={duration || 1}
                        onChange={(e, v) => seekAudio(v)}
                        disabled={playingId !== audio._id}
                        sx={{ py: 0 }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(audio.fileSize)}
                    </Typography>
                    <Box>
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => downloadAudio(audio)}>
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteConfirm(audio)} color="error">
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Recording</DialogTitle>
        <DialogContent>
          <Typography>
            Delete recording from {deleteConfirm?.employeeId} on{' '}
            {deleteConfirm ? new Date(deleteConfirm.timestamp).toLocaleString() : ''}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteAudio(deleteConfirm._id)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
