import { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, MenuItem, Grid, Avatar, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { employeeAPI } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({ employee_id: '', name: '', email: '', department: '', group: '' });
  const { onlineEmployees } = useWebSocket();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const response = await employeeAPI.getAll(params);
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOnline = (employeeId) => onlineEmployees.some(e => e.employeeId === employeeId);

  const handleSave = async () => {
    try {
      if (editingEmployee) {
        await employeeAPI.update(editingEmployee.employeeId, formData);
      } else {
        await employeeAPI.register(formData);
      }
      setOpenDialog(false);
      setEditingEmployee(null);
      setFormData({ employee_id: '', name: '', email: '', department: '', group: '' });
      fetchEmployees();
    } catch (error) {
      console.error('Failed to save employee:', error);
    }
  };

  const handleDelete = async (employeeId) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await employeeAPI.delete(employeeId);
        fetchEmployees();
      } catch (error) {
        console.error('Failed to delete employee:', error);
      }
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({ employee_id: employee.employeeId, name: employee.name, email: employee.email || '', department: employee.department || '', group: employee.group || '' });
    setOpenDialog(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Employees</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditingEmployee(null); setFormData({ employee_id: '', name: '', email: '', department: '', group: '' }); setOpenDialog(true); }}>
          Add Employee
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField size="small" placeholder="Search employees..." value={search} onChange={(e) => { setSearch(e.target.value); fetchEmployees(); }} sx={{ minWidth: 250 }} />
        <TextField select size="small" value={filter} onChange={(e) => { setFilter(e.target.value); fetchEmployees(); }} sx={{ minWidth: 120 }}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
          <MenuItem value="suspended">Suspended</MenuItem>
        </TextField>
      </Box>
      <Grid container spacing={3}>
        {employees.map((employee) => (
          <Grid item xs={12} sm={6} md={4} key={employee.employeeId}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: isOnline(employee.employeeId) ? 'success.main' : 'grey.500' }}>
                    {employee.name?.charAt(0) || 'E'}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography fontWeight="bold">{employee.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{employee.employeeId}</Typography>
                  </Box>
                  <Chip size="small" label={isOnline(employee.employeeId) ? 'Online' : 'Offline'} color={isOnline(employee.employeeId) ? 'success' : 'default'} />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                  {employee.email && <Typography variant="body2" color="text.secondary">{employee.email}</Typography>}
                  {employee.department && <Chip label={employee.department} size="small" variant="outlined" />}
                  {employee.group && <Chip label={employee.group} size="small" variant="outlined" />}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <IconButton size="small" onClick={() => handleEdit(employee)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(employee.employeeId)}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Employee ID" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} disabled={!!editingEmployee} margin="normal" />
          <TextField fullWidth label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} margin="normal" />
          <TextField fullWidth label="Group" value={formData.group} onChange={(e) => setFormData({ ...formData, group: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
