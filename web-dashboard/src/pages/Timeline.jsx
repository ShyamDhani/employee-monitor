import { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Tooltip, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButton, ToggleButtonGroup, Divider
} from '@mui/material';
import { format, addHours, startOfDay, differenceInMinutes } from 'date-fns';
import { activityAPI, employeeAPI } from '../services/api';

const COLORS = [
  '#1976D2','#388E3C','#F57C00','#D32F2F','#7B1FA2','#00796B',
  '#C2185B','#5D4037','#455A64','#FF6F00','#0288D1','#689F38',
  '#E64A19','#0097A7','#8BC34A','#FF5722'
];

const appColorMap = {};
let colorIdx = 0;
const getAppColor = (name) => {
  if (!appColorMap[name]) {
    appColorMap[name] = COLORS[colorIdx % COLORS.length];
    colorIdx++;
  }
  return appColorMap[name];
};

const formatDur = (ms) => {
  if (!ms || ms <= 0) return '0s';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatTime = (ts) => {
  if (!ts) return '';
  return format(new Date(ts), 'HH:mm:ss');
};

const formatTimeShort = (ts) => {
  if (!ts) return '';
  return format(new Date(ts), 'HH:mm');
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Merge adjacent blocks for the same app that are close together (within 5 minutes)
function mergeBlocks(blocks) {
  if (!blocks.length) return [];
  const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    const gap = curr.startTime - prev.endTime;

    // Merge if same app and gap is less than 5 minutes
    if (curr.appName === prev.appName && gap < 5 * 60 * 1000) {
      prev.endTime = Math.max(prev.endTime, curr.endTime);
      prev.duration = prev.endTime - prev.startTime;
      prev.merged = true;
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

export default function Timeline() {
  const [timeline, setTimeline] = useState([]);
  const [summary, setSummary] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [viewMode, setViewMode] = useState('timeline');
  const timelineRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchData = async () => {
    try {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + 1);
      const params = { start_date: start.toISOString(), end_date: end.toISOString() };
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee;
      const [timelineRes, summaryRes] = await Promise.all([
        activityAPI.getTimeline(params),
        activityAPI.getSummary(params)
      ]);
      setTimeline(timelineRes.data.data || []);
      setSummary(summaryRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
    }
  };

  const totalDuration = summary.reduce((sum, s) => sum + (s.totalTime || 0), 0);

  // Build ManicTime-style blocks: each entry in timeline becomes a colored block positioned by time
  const buildBlocks = () => {
    if (!timeline.length) return [];
    const dayStart = startOfDay(new Date(selectedDate));
    const dayEndMs = 24 * 60 * 60 * 1000;

    const raw = timeline.map((item) => {
      const startTime = new Date(item.startTime || item.timestamp).getTime();
      const endTime = item.endTime ? new Date(item.endTime).getTime() : startTime + (item.durationMs || 0);
      const startOffset = Math.max(0, startTime - dayStart.getTime());
      const duration = Math.max(endTime - startTime, 1000);
      const leftPct = (startOffset / dayEndMs) * 100;
      const widthPct = Math.max((duration / dayEndMs) * 100, 0.15);
      const appName = item.appName || item.appPackage || 'Unknown';
      return {
        ...item,
        leftPct,
        widthPct,
        duration,
        appName,
        startTime,
        endTime,
        startFormatted: formatTime(startTime),
        endFormatted: formatTime(endTime),
        color: getAppColor(appName),
      };
    });

    return mergeBlocks(raw);
  };

  const blocks = buildBlocks();

  // Group blocks by employee for multi-row display
  const blocksByEmployee = {};
  blocks.forEach(b => {
    const emp = b.employeeId || 'unknown';
    if (!blocksByEmployee[emp]) blocksByEmployee[emp] = [];
    blocksByEmployee[emp].push(b);
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={1}>Timeline</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        App usage periods showing when each application was active on the device (ManicTime-style)
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField type="date" size="small" value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          sx={{ minWidth: 180 }}
        />
        <TextField select size="small" value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All Employees</MenuItem>
          {employees.map((emp) => (
            <MenuItem key={emp.employeeId} value={emp.employeeId}>{emp.name || emp.employeeId}</MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="timeline">Timeline</ToggleButton>
          <ToggleButton value="sessions">Sessions</ToggleButton>
          <ToggleButton value="summary">Summary</ToggleButton>
        </ToggleButtonGroup>
        <Chip label={`${timeline.length} entries`} size="small" variant="outlined" />
        <Chip label={`Total: ${formatDur(totalDuration)}`} size="small" color="primary" />
      </Box>

      {/* ===== MANICTIME-STYLE 24-HOUR TIMELINE BAR ===== */}
      {(viewMode === 'timeline' || viewMode === 'sessions') && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Daily Timeline - {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </Typography>

            {/* Hour labels */}
            <Box sx={{ display: 'flex', ml: '0px', mb: 0.5 }}>
              {HOURS.map((h) => (
                <Box key={h} sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" fontSize="10px">
                    {String(h).padStart(2, '0')}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Total usage summary bar at top */}
            <Box sx={{ position: 'relative', height: 20, border: '1px solid', borderColor: 'divider', borderRadius: '4px 4px 0 0', overflow: 'hidden', backgroundColor: 'background.paper', mb: 0.5 }}>
              {(() => {
                const dayStartMs = startOfDay(new Date(selectedDate)).getTime();
                const dayEndMs = 24 * 60 * 60 * 1000;
                return summary.map((item, idx) => {
                  // We don't have exact start times in summary, just total durations
                  // Show as a proportional bar segment
                  return null; // Summary bar is just a label
                });
              })()}
              <Box sx={{ position: 'absolute', top: 2, left: 4 }}>
                <Typography variant="caption" fontWeight="bold" fontSize="10px" color="text.secondary">
                  24-Hour Overview
                </Typography>
              </Box>
            </Box>

            {/* Timeline tracks - each app gets its own row */}
            <Box ref={timelineRef} sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: '0 0 4px 4px', overflow: 'hidden', backgroundColor: 'background.default' }}>
              {/* Hour grid lines */}
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none', zIndex: 0 }}>
                {HOURS.map((h) => (
                  <Box key={h} sx={{
                    flex: 1,
                    borderRight: h % 6 === 0 ? '1px solid #ddd' : '1px solid #f0f0f0',
                    height: '100%',
                    backgroundColor: h >= 9 && h <= 17 ? 'rgba(25, 118, 210, 0.02)' : 'transparent'
                  }} />
                ))}
              </Box>

              {/* Blocks grouped by app, each app gets a row */}
              {(() => {
                const appBlocks = {};
                blocks.forEach((b) => {
                  if (!appBlocks[b.appName]) appBlocks[b.appName] = [];
                  appBlocks[b.appName].push(b);
                });
                const apps = Object.keys(appBlocks).sort((a, b) => {
                  const totalA = appBlocks[a].reduce((s, b) => s + b.duration, 0);
                  const totalB = appBlocks[b].reduce((s, b) => s + b.duration, 0);
                  return totalB - totalA; // Sort by most used
                });
                const rowHeight = 36;

                return (
                  <Box sx={{ position: 'relative', height: Math.max(apps.length * rowHeight, rowHeight) }}>
                    {apps.map((appName, rowIdx) => (
                      <Box key={appName} sx={{
                        position: 'relative',
                        height: rowHeight,
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)'
                      }}>
                        {/* App name label */}
                        <Box sx={{
                          position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                          zIndex: 5, backgroundColor: 'rgba(255,255,255,0.85)',
                          px: 0.5, borderRadius: 1, border: '1px solid', borderColor: 'divider'
                        }}>
                          <Typography variant="caption" fontSize="10px" fontWeight="bold" noWrap
                            sx={{ maxWidth: 100, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {appName}
                          </Typography>
                        </Box>
                        {appBlocks[appName].map((block, blockIdx) => (
                          <Tooltip
                            key={blockIdx}
                            title={
                              <Box sx={{ p: 0.5 }}>
                                <Typography fontWeight="bold" fontSize="13px">{block.appName}</Typography>
                                <Divider sx={{ my: 0.5 }} />
                                <Typography variant="caption" display="block">
                                  Start: {format(new Date(block.startTime), 'HH:mm:ss')}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  End: {format(new Date(block.endTime), 'HH:mm:ss')}
                                </Typography>
                                <Typography variant="caption" display="block" fontWeight="bold">
                                  Duration: {formatDur(block.duration)}
                                </Typography>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  Employee: {block.employeeId}
                                </Typography>
                                {block.merged && (
                                  <Typography variant="caption" display="block" color="info.main" fontStyle="italic">
                                    Merged session
                                  </Typography>
                                )}
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 4,
                                left: `${block.leftPct}%`,
                                width: `${block.widthPct}%`,
                                height: rowHeight - 8,
                                backgroundColor: block.color,
                                borderRadius: 1,
                                cursor: 'pointer',
                                opacity: 0.85,
                                '&:hover': { opacity: 1, transform: 'scaleY(1.15)', zIndex: 10, boxShadow: 2 },
                                transition: 'all 0.15s',
                                minWidth: 3,
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                px: 0.5,
                                border: block.merged ? '1px dashed rgba(255,255,255,0.5)' : 'none',
                              }}
                            >
                              {block.widthPct > 2.5 && (
                                <Typography variant="caption" color="white" noWrap fontSize="10px" fontWeight="bold"
                                  textShadow="0 1px 2px rgba(0,0,0,0.3)">
                                  {formatTimeShort(block.startTime)}-{formatTimeShort(block.endTime)}
                                </Typography>
                              )}
                            </Box>
                          </Tooltip>
                        ))}
                      </Box>
                    ))}
                    {apps.length === 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: rowHeight }}>
                        <Typography color="text.secondary">No activity data for this date</Typography>
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
              {summary.slice(0, 20).map((item, index) => {
                const appName = item._id?.appName || item._id?.appPackage || 'Unknown';
                return (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: getAppColor(appName) }} />
                    <Typography variant="caption" fontWeight="medium">{appName}</Typography>
                    <Typography variant="caption" color="text.secondary">({formatDur(item.totalTime)})</Typography>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ===== SESSIONS LIST (ManicTime-style) ===== */}
      {(viewMode === 'timeline' || viewMode === 'sessions') && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Usage Sessions (Time Ranges)</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Each row shows when an app was active: from start time to end time
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>App</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Package</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Start Time</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>End Time</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Employee</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {blocks
                    .sort((a, b) => b.startTime - a.startTime)
                    .map((block, index) => (
                    <TableRow key={index} hover sx={{
                      '&:nth-of-type(odd)': { backgroundColor: 'rgba(0,0,0,0.02)' },
                    }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: block.color, flexShrink: 0 }} />
                          <Typography fontWeight="medium" fontSize="0.85rem">{block.appName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{block.appPackage || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.85rem">
                          {format(new Date(block.startTime), 'HH:mm:ss')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.85rem">
                          {format(new Date(block.endTime), 'HH:mm:ss')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={formatDur(block.duration)} size="small"
                          color={block.duration > 3600000 ? 'primary' : block.duration > 600000 ? 'default' : 'default'}
                          variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{block.employeeId}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {blocks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary" py={3}>No activity data for this date</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* ===== APP USAGE SUMMARY ===== */}
      {(viewMode === 'timeline' || viewMode === 'summary') && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>App Usage Summary</Typography>
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {summary.map((item, index) => {
                const appName = item._id?.appName || item._id?.appPackage || 'Unknown';
                const pkg = item._id?.appPackage || '';
                const pct = totalDuration > 0 ? (item.totalTime / totalDuration) * 100 : 0;
                return (
                  <Box key={index} sx={{
                    py: 1.5, borderBottom: '1px solid #f0f0f0',
                    display: 'flex', alignItems: 'center', gap: 2
                  }}>
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: getAppColor(appName), flexShrink: 0 }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight="medium" fontSize="0.9rem" noWrap>{appName}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">{pkg}</Typography>
                    </Box>
                    {/* Progress bar */}
                    <Box sx={{ width: 120, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', backgroundColor: getAppColor(appName), borderRadius: 4 }} />
                    </Box>
                    <Chip label={formatDur(item.totalTime)} size="small" sx={{ fontWeight: 'bold', minWidth: 80 }} />
                    <Chip label={`${pct.toFixed(1)}%`} size="small" color={pct > 30 ? 'primary' : 'default'} variant="outlined" />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
                      {item.sessions} sessions
                    </Typography>
                  </Box>
                );
              })}
              {summary.length === 0 && (
                <Typography color="text.secondary" textAlign="center" py={4}>No app usage data for this date</Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
