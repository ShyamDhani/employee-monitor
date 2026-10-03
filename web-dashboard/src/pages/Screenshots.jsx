import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem,
  Pagination, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, CircularProgress, Snackbar, Alert,
  ToggleButton, ToggleButtonGroup, Tooltip, Stack, Avatar
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon, Close as CloseIcon, Apps as AppsIcon,
  ViewModule as GridIcon, DeleteOutline as DeleteIcon, Refresh as RefreshIcon,
  ImageSearch as ImageSearchIcon, CalendarToday as CalendarIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { screenshotAPI, employeeAPI } from '../services/api';
import { friendlyAppName } from '../utils/appNames';
import PageHeader from '../components/PageHeader';

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState(null);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await screenshotAPI.delete(deleteTarget._id);
      setScreenshots((prev) => prev.filter((s) => s._id !== deleteTarget._id));
      if (selectedImage?._id === deleteTarget._id) setSelectedImage(null);
      setDeleteTarget(null);
      setSnackbar({ severity: 'success', message: 'Screenshot deleted' });
      fetchAppGroups();
    } catch (error) {
      console.error('Failed to delete screenshot:', error);
      setSnackbar({ severity: 'error', message: 'Could not delete this screenshot' });
    } finally {
      setDeleting(false);
    }
  };

  const tileActions = (screenshot) => (
    <Box
      className="em-tile-actions"
      onClick={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 0.75,
        opacity: 0,
        transform: 'translateY(-6px)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
      }}
    >
      <Tooltip title="View">
        <IconButton
          size="small"
          onClick={() => setSelectedImage(screenshot)}
          sx={{
            bgcolor: 'rgba(10,13,20,0.82)',
            color: '#e2e8f0',
            border: '1px solid rgba(148,163,184,0.28)',
            '&:hover': { bgcolor: 'rgba(6,182,212,0.85)', color: '#04141a' },
          }}
        >
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete screenshot">
        <IconButton
          size="small"
          onClick={() => setDeleteTarget(screenshot)}
          sx={{
            bgcolor: 'rgba(10,13,20,0.82)',
            color: '#fca5a5',
            border: '1px solid rgba(248,113,113,0.35)',
            '&:hover': { bgcolor: '#ef4444', color: '#fff' },
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const renderTile = (screenshot) => (
    <Box
      key={screenshot._id}
      onClick={() => setSelectedImage(screenshot)}
      sx={{
        position: 'relative',
        borderRadius: 2.5,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid rgba(148,163,184,0.14)',
        backgroundColor: '#0d1117',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: 'rgba(6,182,212,0.55)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.45)',
        },
        '&:hover .em-tile-actions': { opacity: 1, transform: 'translateY(0)' },
      }}
    >
      <Box
        component="img"
        src={screenshot.imageUrl}
        alt={screenshot.appPackage || 'Screenshot'}
        loading="lazy"
        sx={{ width: '100%', height: 176, objectFit: 'cover', display: 'block' }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(10,13,20,0.35) 0%, transparent 35%, rgba(10,13,20,0.88) 100%)',
          pointerEvents: 'none',
        }}
      />
      {tileActions(screenshot)}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 1.5 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          noWrap
          sx={{ color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 0.75 }}
        >
          <AppsIcon sx={{ fontSize: 14, color: '#22d3ee' }} />
          {friendlyAppName(screenshot.appPackage)}
        </Typography>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.25 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            {screenshot.employeeId}
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            {format(new Date(screenshot.timestamp), 'HH:mm:ss')}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );

  const emptyState = (title, message) => (
    <Card sx={{ borderStyle: 'dashed' }}>
      <CardContent sx={{ textAlign: 'center', py: 7 }}>
        <Avatar
          sx={{
            width: 64, height: 64, mx: 'auto', mb: 2,
            bgcolor: 'rgba(6,182,212,0.12)', color: '#22d3ee',
            backgroundImage: 'none', border: '1px dashed rgba(6,182,212,0.35)',
          }}
        >
          <ImageSearchIcon sx={{ fontSize: 30 }} />
        </Avatar>
        <Typography variant="h6" sx={{ color: '#e2e8f0' }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{message}</Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <PageHeader
        icon={<ImageSearchIcon />}
        title="Screenshots"
        subtitle="Captured screens grouped by app, employee and time"
        actions={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, v) => v !== null && setViewMode(v)}
              sx={{ '& .MuiToggleButton-root': { px: 2, borderRightWidth: 1 } }}
            >
              <ToggleButton value={0}><GridIcon fontSize="small" sx={{ mr: 0.75 }} />Grid</ToggleButton>
              <ToggleButton value={1}><AppsIcon fontSize="small" sx={{ mr: 0.75 }} />By app</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Reload">
              <IconButton onClick={() => { fetchScreenshots(); fetchAppGroups(); }} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              type="date"
              size="small"
              label="Date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 190 }}
              InputProps={{
                startAdornment: <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            <TextField
              select
              size="small"
              label="Employee"
              value={selectedEmployee}
              onChange={(e) => { setSelectedEmployee(e.target.value); setSelectedApp('all'); setPage(1); }}
              sx={{ minWidth: 210 }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="all">All Employees</MenuItem>
              {employees.map((emp) => (
                <MenuItem key={emp.employeeId} value={emp.employeeId}>{emp.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="App"
              value={selectedApp}
              onChange={(e) => { setSelectedApp(e.target.value); setPage(1); }}
              sx={{ minWidth: 230 }}
            >
              <MenuItem value="all">All Apps</MenuItem>
              {appGroups.map((app) => (
                <MenuItem key={app.appPackage} value={app.appPackage}>
                  {app.appPackage} ({app.count})
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ flexGrow: 1 }} />

            <Chip
              size="small"
              icon={<PersonIcon />}
              label={`${screenshots.length} captured`}
              color="primary"
            />
          </Box>
        </CardContent>
      </Card>

      {viewMode === 0 && (
        <>
          {loading && screenshots.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={36} />
            </Box>
          ) : screenshots.length === 0 ? (
            emptyState('No screenshots found', 'Try another date, employee or app filter.')
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: 'repeat(auto-fill, minmax(160px, 1fr))',
                  sm: 'repeat(auto-fill, minmax(220px, 1fr))',
                  lg: 'repeat(auto-fill, minmax(260px, 1fr))',
                },
              }}
            >
              {screenshots.map(renderTile)}
            </Box>
          )}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
            </Box>
          )}
        </>
      )}

      {viewMode === 1 && (
        <Box>
          {appGroups.length === 0 && !loading && emptyState('No app data found', 'No screenshots were captured on this date.')}
          {appGroups.map((app) => {
            const groupShots = screenshots.filter((s) => s.appPackage === app.appPackage).slice(0, 8);
            return (
              <Card key={app.appPackage} sx={{ mb: 2.5 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      mb: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 40, height: 40, borderRadius: 2,
                        bgcolor: 'rgba(6,182,212,0.14)', color: '#22d3ee', backgroundImage: 'none',
                      }}
                    >
                      <AppsIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 180 }}>
                      <Typography fontWeight={700}>{friendlyAppName(app.appPackage)}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {app.appPackage} · last used {format(new Date(app.lastUsed), 'MMM dd, HH:mm:ss')}
                      </Typography>
                    </Box>
                    <Chip label={`${app.count} screenshots`} size="small" color="primary" />
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: 'repeat(auto-fill, minmax(150px, 1fr))',
                        md: 'repeat(auto-fill, minmax(200px, 1fr))',
                      },
                    }}
                  >
                    {groupShots.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        Thumbnails load on the grid view for this page.
                      </Typography>
                    ) : (
                      groupShots.map(renderTile)
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { overflow: 'hidden', bgcolor: '#0a0d14' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.5,
            bgcolor: 'rgba(18,22,31,0.96)',
            borderBottom: '1px solid rgba(148,163,184,0.14)',
          }}
        >
          <ImageSearchIcon fontSize="small" sx={{ color: '#22d3ee' }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {selectedImage ? friendlyAppName(selectedImage.appPackage) : ''}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {selectedImage?.employeeId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedImage && format(new Date(selectedImage.timestamp), 'MMM dd, yyyy HH:mm:ss')}
              </Typography>
            </Stack>
          </Box>
          {selectedImage && (
            <Tooltip title="Delete screenshot">
              <IconButton
                onClick={() => setDeleteTarget(selectedImage)}
                sx={{
                  color: '#fca5a5',
                  border: '1px solid rgba(248,113,113,0.35)',
                  '&:hover': { bgcolor: 'rgba(248,113,113,0.16)' },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={() => setSelectedImage(null)} sx={{ color: '#94a3b8' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#05070b' }}>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage.imageUrl}
              alt="Screenshot"
              sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            sx={{
              width: 36, height: 36, bgcolor: 'rgba(248,113,113,0.14)',
              color: '#fca5a5', backgroundImage: 'none',
            }}
          >
            <DeleteIcon fontSize="small" />
          </Avatar>
          Delete screenshot?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This permanently removes the capture from{' '}
            <Box component="span" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
              {deleteTarget ? friendlyAppName(deleteTarget.appPackage) : ''}
            </Box>{' '}
            taken at {deleteTarget ? format(new Date(deleteTarget.timestamp), 'MMM dd, yyyy HH:mm') : ''}. This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="contained"
            color="error"
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar && (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.severity}
            variant="filled"
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {snackbar.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
