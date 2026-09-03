import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText,
  IconButton, TextField, Button, Breadcrumbs, Link, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Alert, CircularProgress, Tooltip,
  Card, CardContent, Grid, Divider
} from '@mui/material';
import {
  Folder, InsertDriveFile, ArrowBack, Refresh, Search, Download,
  Home, PhoneAndroid, Storage, Image, VideoFile, AudioFile,
  PictureAsPdf, Code, Archive, Apps, Delete, Visibility
} from '@mui/icons-material';
import { employeeAPI, fileManagerAPI } from '../services/api';

const FILE_ICONS = {
  folder: <Folder sx={{ color: '#FFA726' }} />,
  image: <Image sx={{ color: '#06b6d4' }} />,
  video: <VideoFile sx={{ color: '#EF5350' }} />,
  audio: <AudioFile sx={{ color: '#AB47BC' }} />,
  pdf: <PictureAsPdf sx={{ color: '#EF5350' }} />,
  code: <Code sx={{ color: '#66BB6A' }} />,
  archive: <Archive sx={{ color: '#8D6E63' }} />,
  file: <InsertDriveFile sx={{ color: '#78909C' }} />,
};

function getFileIcon(item) {
  if (item.is_directory) return FILE_ICONS.folder;
  const ext = item.extension || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return FILE_ICONS.image;
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return FILE_ICONS.video;
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return FILE_ICONS.audio;
  if (ext === 'pdf') return FILE_ICONS.pdf;
  if (['js', 'ts', 'py', 'java', 'kt', 'xml', 'json', 'html', 'css'].includes(ext)) return FILE_ICONS.code;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FILE_ICONS.archive;
  return FILE_ICONS.file;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FileManager() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState('/sdcard');
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [apps, setApps] = useState(null);
  const [error, setError] = useState('');
  const [filePreview, setFilePreview] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadListing(selectedEmployee.employee_id, currentPath);
    }
  }, [selectedEmployee, currentPath]);

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

  const loadListing = async (empId, path) => {
    setLoading(true);
    setError('');
    try {
      await fileManagerAPI.sendCommand(empId, 'browse_files', { path });
      let attempts = 0;
      const maxAttempts = 6;
      const poll = async () => {
        attempts++;
        try {
          const res = await fileManagerAPI.browseEmployee(empId);
          if (res.data?.data?.files) {
            setListing(res.data.data);
            setBreadcrumb(buildBreadcrumb(path));
            setLoading(false);
            return;
          }
        } catch (e) {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setError('No data received. Phone may be offline. Click Refresh to retry.');
          setLoading(false);
        }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setError('Failed to send browse command');
      setLoading(false);
    }
  };

  const loadApps = async (empId) => {
    setLoading(true);
    setError('');
    try {
      await fileManagerAPI.sendCommand(empId, 'list_apps', {});
      let attempts = 0;
      const maxAttempts = 6;
      const poll = async () => {
        attempts++;
        try {
          const res = await fileManagerAPI.getApps(empId);
          if (res.data?.data) {
            setApps(res.data.data);
            setLoading(false);
            return;
          }
        } catch (e) {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setError('App list not received. Phone may be offline. Click Installed Apps to retry.');
          setLoading(false);
        }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setError('Failed to send list_apps command');
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedEmployee || !searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      await fileManagerAPI.sendCommand(selectedEmployee.employee_id, 'search_files', {
        root_path: currentPath,
        query: searchQuery
      });
      let attempts = 0;
      const maxAttempts = 6;
      const poll = async () => {
        attempts++;
        try {
          const res = await fileManagerAPI.getListings(selectedEmployee.employee_id);
          const listings = res.data.listings || [];
          const searchResult = listings.find(l => l.query === searchQuery);
          if (searchResult) {
            setListing({ files: searchResult.results, path: searchResult.root_path, total_items: searchResult.results?.length || 0 });
            setBreadcrumb([{ name: 'Search Results', path: null }]);
            setLoading(false);
            return;
          }
        } catch (e) {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setError('Search results not received. Phone may be offline.');
          setLoading(false);
        }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setError('Search failed');
      setLoading(false);
    }
  };

  const handleDownload = async (file) => {
    if (!selectedEmployee) return;
    try {
      await fileManagerAPI.sendCommand(selectedEmployee.employee_id, 'download_file', { file_path: file.path });
      let attempts = 0;
      const maxAttempts = 6;
      const poll = async () => {
        attempts++;
        try {
          const res = await fileManagerAPI.getFiles(selectedEmployee.employee_id);
          const files = res.data.files || [];
          const target = files.find(f => f.original_path === file.path);
          if (target) {
            setFilePreview({ ...target, originalName: file.name });
            return;
          }
        } catch (e) {}
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setError('Download failed');
    }
  };

  const buildBreadcrumb = (path) => {
    const parts = path.split('/').filter(Boolean);
    const crumbs = [{ name: 'Root', path: '/sdcard' }];
    let accumulated = '/sdcard';
    for (const part of parts.slice(1)) {
      accumulated += `/${part}`;
      crumbs.push({ name: part, path: accumulated });
    }
    return crumbs;
  };

  const navigateTo = (path) => {
    setCurrentPath(path);
    setListing(null);
    setApps(null);
  };

  const handleItemClick = (item) => {
    if (item.is_directory) {
      navigateTo(item.path);
    } else {
      handleDownload(item);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>File Manager</Typography>

      <Grid container spacing={2} mb={3}>
        {employees.map((emp) => (
          <Grid item xs={12} sm={6} md={4} key={emp.employee_id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedEmployee?.employee_id === emp.employee_id ? '2px solid #1976D2' : '1px solid #e0e0e0',
                '&:hover': { boxShadow: 3 }
              }}
              onClick={() => {
                setSelectedEmployee(emp);
                setCurrentPath('/sdcard');
                setListing(null);
                setApps(null);
              }}
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
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mr: 'auto' }}>
              {selectedEmployee.name || selectedEmployee.employee_id}
            </Typography>
            <Button size="small" startIcon={<Refresh />} onClick={() => { setListing(null); setApps(null); loadListing(selectedEmployee.employee_id, currentPath); }}>
              Refresh
            </Button>
            <Button size="small" startIcon={<Apps />} variant={apps ? 'contained' : 'outlined'} onClick={() => loadApps(selectedEmployee.employee_id)}>
              Installed Apps
            </Button>
          </Box>

          {!apps && (
            <>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  sx={{ flexGrow: 1 }}
                />
                <Button variant="contained" startIcon={<Search />} onClick={handleSearch}>Search</Button>
              </Box>

              <Breadcrumbs sx={{ mb: 2 }}>
                {breadcrumb.map((crumb, i) => (
                  crumb.path ? (
                    <Link
                      key={i}
                      component="button"
                      variant="body1"
                      underline="hover"
                      onClick={() => navigateTo(crumb.path)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {i === 0 ? <Home sx={{ verticalAlign: 'middle', mr: 0.5 }} /> : null}
                      {crumb.name}
                    </Link>
                  ) : (
                    <Typography key={i} color="text.primary">{crumb.name}</Typography>
                  )
                ))}
              </Breadcrumbs>

              {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}

              {listing?.storage && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Chip icon={<Storage />} label={`Total: ${listing.storage.total_gb} GB`} variant="outlined" />
                  <Chip label={`Free: ${listing.storage.free_gb} GB`} color="success" variant="outlined" />
                  <Chip label={`Used: ${listing.storage.used_gb} GB`} color="warning" variant="outlined" />
                </Box>
              )}

              {currentPath !== '/sdcard' && (
                <Button size="small" startIcon={<ArrowBack />} onClick={() => {
                  const parts = currentPath.split('/');
                  parts.pop();
                  navigateTo(parts.join('/') || '/sdcard');
                }} sx={{ mb: 1 }}>
                  Back
                </Button>
              )}

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : listing?.files ? (
                <List dense>
                  {listing.files.map((item, i) => (
                    <ListItem
                      key={i}
                      button
                      onClick={() => handleItemClick(item)}
                      sx={{ borderRadius: 1, '&:hover': { backgroundColor: '#f5f5f5' } }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getFileIcon(item)}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={item.is_directory ? `${item.children_count || 0} items` : `${item.size_human || formatSize(item.size_bytes)} · ${item.extension || 'file'}`}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                        {item.last_modified}
                      </Typography>
                      {!item.is_directory && (
                        <Tooltip title="Download to server">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">Select a path or click Refresh to load files.</Alert>
              )}
            </>
          )}

          {apps && (
            <Box>
              <Typography variant="subtitle2" mb={1}>
                {apps.total_apps || 0} apps installed
              </Typography>
              <List dense sx={{ maxHeight: 500, overflow: 'auto' }}>
                {(apps.apps || []).map((app, i) => (
                  <ListItem key={i} sx={{ borderBottom: '1px solid #f0f0f0' }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Apps color={app.is_system ? 'action' : 'primary'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={app.app_name}
                      secondary={`${app.package_name} · v${app.version_name}`}
                    />
                    {app.is_system && <Chip label="System" size="small" variant="outlined" />}
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Paper>
      )}

      <Dialog open={!!filePreview} onClose={() => setFilePreview(null)} maxWidth="md" fullWidth>
        <DialogTitle>{filePreview?.originalName || 'File'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Size: {formatSize(filePreview?.file_size)} · Type: {filePreview?.mime_type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Original path: {filePreview?.original_path}
            </Typography>
          </Box>
          {filePreview?.file_base64 && filePreview?.mime_type?.startsWith('image/') ? (
            <Box
              component="img"
              src={`data:${filePreview.mime_type};base64,${filePreview.file_base64}`}
              sx={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }}
            />
          ) : filePreview?.file_base64 ? (
            <Alert severity="info">File downloaded to server as Base64. Check server uploads/filefiles/ directory.</Alert>
          ) : (
            <CircularProgress />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilePreview(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
