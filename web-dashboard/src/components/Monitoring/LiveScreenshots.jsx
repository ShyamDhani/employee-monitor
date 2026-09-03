import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Card, CardContent, Typography, Chip, IconButton, Dialog,
  DialogContent, Grid
} from '@mui/material';
import { CameraAlt as CameraIcon, Close as CloseIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { screenshotAPI } from '../../services/api';
import { websocketService } from '../../services/websocket';
import { friendlyAppName } from '../../utils/appNames';

const LIVE_INTERVAL_MS = 5000;
const NORMAL_INTERVAL_MS = 30000;
const MAX_SCREENSHOTS = 18;

const screenshotKey = (s) => s.imageUrl || `${s.employeeId}-${s.timestamp}`;

export default function LiveScreenshots({ liveEmployees = [] }) {
  const selectedEmployee = useSelector((state) => state.dashboard.selectedEmployee);
  const [screenshots, setScreenshots] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newCapture, setNewCapture] = useState(false);
  const [preview, setPreview] = useState(null);
  const listRef = useRef([]);
  listRef.current = screenshots;

  const isLive = liveEmployees.length > 0;
  const pollInterval = isLive ? LIVE_INTERVAL_MS : NORMAL_INTERVAL_MS;

  const pushUnique = useCallback((items) => {
    const seen = new Set(listRef.current.map(screenshotKey));
    const fresh = items.filter((s) => !seen.has(screenshotKey(s)));
    if (fresh.length === 0) return;
    setScreenshots((prev) => [...fresh, ...prev].slice(0, MAX_SCREENSHOTS));
    setLastUpdated(new Date());
    setNewCapture(true);
  }, []);

  const fetchLatest = useCallback(async () => {
    try {
      const params = { limit: MAX_SCREENSHOTS };
      if (selectedEmployee) params.employee_id = selectedEmployee.employeeId;
      const response = await screenshotAPI.getAll(params);
      pushUnique(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch live screenshots:', error);
    }
  }, [selectedEmployee, pushUnique]);

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, pollInterval);
    const unsubscribe = websocketService.on('screenshot', (data) => pushUnique([data]));
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchLatest, pushUnique, pollInterval]);

  useEffect(() => {
    if (!newCapture) return;
    const timer = setTimeout(() => setNewCapture(false), 1500);
    return () => clearTimeout(timer);
  }, [newCapture]);

  const featured = screenshots[0] || null;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Live Screenshots
            </Typography>
            <Chip
              size="small"
              color={isLive ? 'error' : newCapture ? 'success' : 'primary'}
              label={isLive ? 'LIVE' : newCapture ? 'New capture' : 'Live'}
              icon={<CameraIcon />}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {lastUpdated
              ? `Updated ${format(lastUpdated, 'HH:mm:ss')} · refreshes every ${pollInterval / 1000}s`
              : 'Waiting for screenshots...'}
          </Typography>
        </Box>

        {!featured && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {selectedEmployee
                ? `No screenshots yet for ${selectedEmployee.name || selectedEmployee.employeeId}`
                : `No screenshots yet. They will appear here every ${pollInterval / 1000} seconds as the app captures them.`}
            </Typography>
          </Box>
        )}

        {featured && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box
                onClick={() => setPreview(featured)}
                sx={{
                  cursor: 'pointer', position: 'relative', borderRadius: 2, overflow: 'hidden',
                  border: newCapture ? '2px solid #4caf50' : '1px solid', borderColor: 'divider',
                  '&:hover': { boxShadow: 4 }
                }}
              >
                <img
                  src={featured.imageUrl}
                  alt="Latest screenshot"
                  style={{ width: '100%', maxHeight: 340, objectFit: 'contain', display: 'block', backgroundColor: '#0d1117' }}
                />
                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1.5, backgroundColor: 'rgba(0,0,0,0.65)' }}>
                  <Typography color="white" fontWeight="bold" variant="body2">
                    {featured.employeeId} | {friendlyAppName(featured.appPackage)}
                  </Typography>
                  <Typography color="white" variant="caption">
                    {format(new Date(featured.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>
                Latest captures
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {screenshots.map((s, index) => (
                  <Box
                    key={`${screenshotKey(s)}-${index}`}
                    onClick={() => setPreview(s)}
                    sx={{
                      minWidth: 150, cursor: 'pointer', borderRadius: 1, overflow: 'hidden',
                      border: index === 0 ? '2px solid #1976D2' : '1px solid', borderColor: 'divider',
                      position: 'relative', '&:hover': { opacity: 0.85 }
                    }}
                  >
                    <img src={s.imageUrl} alt="Screenshot" style={{ width: 150, height: 100, objectFit: 'cover', display: 'block' }} />
                    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 0.5, backgroundColor: 'rgba(0,0,0,0.65)' }}>
                      <Typography color="white" variant="caption" display="block" noWrap>
                        {s.employeeId} | {format(new Date(s.timestamp), 'HH:mm:ss')}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg" fullWidth>
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setPreview(null)}
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } }}
          >
            <CloseIcon sx={{ color: 'white' }} />
          </IconButton>
          {preview && (
            <Box>
              <img src={preview.imageUrl} alt="Screenshot" style={{ width: '100%', height: 'auto' }} />
              <Box sx={{ p: 2, position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <Typography color="white" fontWeight="bold">{friendlyAppName(preview.appPackage)}</Typography>
                <Typography color="white" variant="caption">
                  {preview.employeeId} | {format(new Date(preview.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
