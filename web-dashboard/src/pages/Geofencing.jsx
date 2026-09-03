import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, IconButton,
  Alert, CircularProgress, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  LocationOn, MyLocation, Add, Delete, Edit, Refresh,
  Warning, CheckCircle, GpsFixed
} from '@mui/icons-material';
import EmployeeGoogleMap from '../components/GoogleMap';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function Geofencing() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geofences, setGeofences] = useState(() => {
    const saved = localStorage.getItem('geofences');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Office', lat: 28.6139, lng: 77.2090, radius: 1, active: true },
    ];
  });
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFence, setEditingFence] = useState(null);
  const [fenceForm, setFenceForm] = useState({ name: '', lat: '', lng: '', radius: 1 });
  const [geofenceResults, setGeofenceResults] = useState([]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/location/latest`);
      const data = await res.json();
      if (data.success) setLocations(data.data);
    } catch (e) {
      console.error('Failed to fetch locations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setEmployees(data.data);
    } catch (e) {
      console.error('Failed to fetch employees:', e);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchEmployees();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, [fetchLocations, fetchEmployees]);

  useEffect(() => {
    localStorage.setItem('geofences', JSON.stringify(geofences));
  }, [geofences]);

  const checkGeofences = () => {
    const results = locations.map((loc) => {
      const violations = geofences.filter((fence) => {
        if (!fence.active) return false;
        const R = 6371;
        const dLat = (fence.lat - loc.latitude) * Math.PI / 180;
        const dLon = (fence.lng - loc.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(loc.latitude * Math.PI / 180) * Math.cos(fence.lat * Math.PI / 180) *
          Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        return dist > fence.radius;
      });
      return {
        employeeId: loc.employeeId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        inside: violations.length === 0,
        violations: violations.map((v) => v.name),
        timestamp: loc.timestamp
      };
    });
    setGeofenceResults(results);
  };

  const handleAddFence = () => {
    setEditingFence(null);
    setFenceForm({ name: '', lat: '', lng: '', radius: 1 });
    setDialogOpen(true);
  };

  const handleEditFence = (fence) => {
    setEditingFence(fence);
    setFenceForm({ name: fence.name, lat: fence.lat.toString(), lng: fence.lng.toString(), radius: fence.radius });
    setDialogOpen(true);
  };

  const handleSaveFence = () => {
    if (!fenceForm.name || !fenceForm.lat || !fenceForm.lng) return;
    const newFence = {
      id: editingFence ? editingFence.id : Date.now(),
      name: fenceForm.name,
      lat: parseFloat(fenceForm.lat),
      lng: parseFloat(fenceForm.lng),
      radius: parseFloat(fenceForm.radius),
      active: true
    };
    if (editingFence) {
      setGeofences((prev) => prev.map((f) => f.id === editingFence.id ? newFence : f));
    } else {
      setGeofences((prev) => [...prev, newFence]);
    }
    setDialogOpen(false);
  };

  const handleDeleteFence = (id) => {
    setGeofences((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleFence = (id) => {
    setGeofences((prev) => prev.map((f) => f.id === id ? { ...f, active: !f.active } : f));
  };

  const filteredLocations = selectedEmployee === 'all'
    ? locations
    : locations.filter((l) => l.employeeId === selectedEmployee);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Geofencing & Location Tracking</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchLocations}>Refresh</Button>
          <Button variant="contained" startIcon={<GpsFixed />} onClick={checkGeofences}>Check Geofences</Button>
          <Button variant="contained" startIcon={<Add />} onClick={handleAddFence}>Add Geofence</Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 0, height: 500, overflow: 'hidden', borderRadius: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : (
              <EmployeeGoogleMap
                locations={filteredLocations}
                geofences={geofences}
                selectedEmployee={selectedEmployee}
                height={500}
              />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Employee</InputLabel>
              <Select value={selectedEmployee} label="Employee" onChange={(e) => setSelectedEmployee(e.target.value)}>
                <MenuItem value="all">All Employees</MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp.employeeId} value={emp.employeeId}>{emp.name || emp.employeeId}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Typography variant="h6" gutterBottom>Geofences ({geofences.length})</Typography>
          {geofences.map((fence) => (
            <Card key={fence.id} sx={{ mb: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">{fence.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      R: {fence.radius}km | {fence.lat.toFixed(4)}, {fence.lng.toFixed(4)}
                    </Typography>
                  </Box>
                  <Box>
                    <Chip size="small" label={fence.active ? 'Active' : 'Inactive'} color={fence.active ? 'success' : 'default'} onClick={() => toggleFence(fence.id)} />
                    <IconButton size="small" onClick={() => handleEditFence(fence)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDeleteFence(fence.id)}><Delete fontSize="small" /></IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}

          {geofenceResults.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Check Results</Typography>
              {geofenceResults.map((r) => (
                <Alert key={r.employeeId} severity={r.inside ? 'success' : 'warning'} sx={{ mb: 0.5 }}>
                  <strong>{r.employeeId}</strong>: {r.inside ? 'Inside all zones' : `Outside: ${r.violations.join(', ')}`}
                </Alert>
              ))}
            </Box>
          )}

          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Location Feed</Typography>
            {filteredLocations.slice(0, 5).map((loc) => (
              <Box key={loc.employeeId} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid #f0f0f0' }}>
                <Typography variant="body2" fontWeight="bold">{loc.employeeId}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(loc.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFence ? 'Edit Geofence' : 'Add Geofence'}</DialogTitle>
        <DialogContent>
          <TextField label="Name" fullWidth margin="normal" value={fenceForm.name} onChange={(e) => setFenceForm({ ...fenceForm, name: e.target.value })} />
          <TextField label="Latitude" fullWidth margin="normal" type="number" value={fenceForm.lat} onChange={(e) => setFenceForm({ ...fenceForm, lat: e.target.value })} />
          <TextField label="Longitude" fullWidth margin="normal" type="number" value={fenceForm.lng} onChange={(e) => setFenceForm({ ...fenceForm, lng: e.target.value })} />
          <TextField label="Radius (km)" fullWidth margin="normal" type="number" value={fenceForm.radius} onChange={(e) => setFenceForm({ ...fenceForm, radius: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFence}>{editingFence ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
