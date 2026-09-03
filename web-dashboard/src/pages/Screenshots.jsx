import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Grid,
  Pagination, IconButton, Dialog, DialogContent, Tabs, Tab,
  Chip, Badge, ImageList, ImageListItem, ImageListItemBar
} from '@mui/material';
import { ZoomIn as ZoomInIcon, Close as CloseIcon, Apps as AppsIcon, ViewModule as GridIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { screenshotAPI, employeeAPI } from '../services/api';

export default function Screenshots() {
  const [screenshots, setScreenshots] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [appGroups, setAppGroups] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedApp, setSelectedApp] = useState('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(0);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchScreenshots();
    fetchAppGroups();
  }, [selectedEmployee, selectedDate, page, selectedApp]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchAppGroups = async () => {
    try {
      const params = {};
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + 1);
      params.start_date = start.toISOString();
      params.end_date = end.toISOString();
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee;
      const response = await screenshotAPI.getByApp(params);
      setAppGroups(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch app groups:', error);
    }
  };

  const fetchScreenshots = async () => {
    setLoading(true);
    try {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + 1);
      const params = { start_date: start.toISOString(), end_date: end.toISOString(), page, limit: 50 };
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee;
      if (selectedApp !== 'all') params.app_package = selectedApp;
      const response = await screenshotAPI.getAll(params);
      setScreenshots(response.data.data || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Failed to fetch screenshots:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Screenshots</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField type="date" size="small" value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }} />
        <TextField select size="small" value={selectedEmployee}
          onChange={(e) => { setSelectedEmployee(e.target.value); setSelectedApp('all'); setPage(1); }} sx={{ minWidth: 200 }}>
          <MenuItem value="all">All Employees</MenuItem>
          {employees.map((emp) => (
            <MenuItem key={emp.employeeId} value={emp.employeeId}>{emp.name}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" value={selectedApp}
          onChange={(e) => { setSelectedApp(e.target.value); setPage(1); }} sx={{ minWidth: 200 }}>
          <MenuItem value="all">All Apps</MenuItem>
          {appGroups.map((app) => (
            <MenuItem key={app.appPackage} value={app.appPackage}>
              {app.appPackage} ({app.count})
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Tabs value={viewMode} onChange={(_, v) => setViewMode(v)} sx={{ mb: 2 }}>
        <Tab icon={<GridIcon />} label="All Screenshots" />
        <Tab icon={<AppsIcon />} label="Grouped by App" />
      </Tabs>

      {viewMode === 0 && (
        <>
          <ImageList cols={4} gap={12}>
            {screenshots.map((screenshot) => (
              <ImageListItem key={screenshot._id} sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                onClick={() => setSelectedImage(screenshot)}>
                <img
                  src={screenshot.imageUrl}
                  alt={`Screenshot`}
                  loading="lazy"
                  style={{ borderRadius: 4, height: 200, objectFit: 'cover' }}
                />
                <ImageListItemBar
                  title={screenshot.appPackage || 'Unknown'}
                  subtitle={`${screenshot.employeeId} - ${format(new Date(screenshot.timestamp), 'HH:mm:ss')}`}
                />
              </ImageListItem>
            ))}
          </ImageList>
          {screenshots.length === 0 && !loading && (
            <Card><CardContent><Typography textAlign="center" py={4} color="text.secondary">
              No screenshots found for this date
            </Typography></CardContent></Card>
          )}
        </>
      )}

      {viewMode === 1 && (
        <Box>
          {appGroups.length === 0 && (
            <Card><CardContent><Typography textAlign="center" py={4} color="text.secondary">
              No app data found for this date
            </Typography></CardContent></Card>
          )}
          {appGroups.map((app) => (
            <Card key={app.appPackage} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">{app.appPackage}</Typography>
                  <Chip label={`${app.count} screenshots`} size="small" color="primary" />
                  <Typography variant="caption" color="text.secondary">
                    Last used: {format(new Date(app.lastUsed), 'MMM dd, HH:mm:ss')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                  {screenshots
                    .filter((s) => s.appPackage === app.appPackage)
                    .slice(0, 6)
                    .map((screenshot) => (
                      <Box key={screenshot._id} onClick={() => setSelectedImage(screenshot)}
                        sx={{ minWidth: 200, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
                        <img src={screenshot.imageUrl} alt="Screenshot"
                          style={{ width: 200, height: 120, objectFit: 'cover', borderRadius: 4 }} />
                        <Typography variant="caption" color="text.secondary" display="block">
                          {format(new Date(screenshot.timestamp), 'HH:mm:ss')}
                        </Typography>
                      </Box>
                    ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {viewMode === 0 && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} />
        </Box>
      )}

      <Dialog open={!!selectedImage} onClose={() => setSelectedImage(null)} maxWidth="lg" fullWidth>
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton onClick={() => setSelectedImage(null)}
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } }}>
            <CloseIcon sx={{ color: 'white' }} />
          </IconButton>
          {selectedImage && (
            <Box>
              <img src={selectedImage.imageUrl} alt="Screenshot" style={{ width: '100%', height: 'auto' }} />
              <Box sx={{ p: 2, position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <Typography color="white" fontWeight="bold">{selectedImage.appPackage || 'Unknown app'}</Typography>
                <Typography color="white" variant="caption">
                  {selectedImage.employeeId} | {format(new Date(selectedImage.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
