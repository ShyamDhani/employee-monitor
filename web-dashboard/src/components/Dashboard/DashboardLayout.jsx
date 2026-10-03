import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, IconButton, Menu, MenuItem, Divider,
  Badge, Chip, Stack, useTheme, useMediaQuery, Tooltip
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  CameraAlt as ScreenshotIcon, Analytics as AnalyticsIcon,
  People as PeopleIcon, Assessment as ReportIcon,
  Settings as SettingsIcon, Menu as MenuIcon,
  Notifications, Logout, MonitorHeart, GpsFixed, Warning as WarningIcon,
  Mic as MicIcon, Person as PersonIcon, CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon, ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { logout } from '../../store/authSlice';
import useWebSocket from '../../hooks/useWebSocket';
import { alertAPI } from '../../services/api';

const DRAWER_WIDTH = 264;

const navGroups = [
  {
    label: 'Monitor',
    items: [
      { text: 'Live Monitor', icon: <MonitorHeart fontSize="small" />, path: '/' },
      { text: 'Alerts', icon: <WarningIcon fontSize="small" />, path: '/alerts' },
      { text: 'Timeline', icon: <TimelineIcon fontSize="small" />, path: '/timeline' },
      { text: 'Screenshots', icon: <ScreenshotIcon fontSize="small" />, path: '/screenshots' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { text: 'Analytics', icon: <AnalyticsIcon fontSize="small" />, path: '/analytics' },
      { text: 'Geofencing', icon: <GpsFixed fontSize="small" />, path: '/geofencing' },
      { text: 'Audio', icon: <MicIcon fontSize="small" />, path: '/audio' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { text: 'Employees', icon: <PeopleIcon fontSize="small" />, path: '/employees' },
      { text: 'Reports', icon: <ReportIcon fontSize="small" />, path: '/reports' },
      { text: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/settings' },
    ],
  },
];

const pageMeta = {
  '/': { title: 'Live Monitor', subtitle: 'Real-time overview of your workforce' },
  '/alerts': { title: 'Alerts', subtitle: 'Policy violations and flagged activity' },
  '/timeline': { title: 'Timeline', subtitle: 'Hour-by-hour activity history' },
  '/screenshots': { title: 'Screenshots', subtitle: 'Browse and manage captured screens' },
  '/analytics': { title: 'Analytics', subtitle: 'Productivity trends and app usage' },
  '/geofencing': { title: 'Geofencing', subtitle: 'Location zones and movement history' },
  '/audio': { title: 'Audio', subtitle: 'Recorded audio clips' },
  '/employees': { title: 'Employees', subtitle: 'People, devices and status' },
  '/reports': { title: 'Reports', subtitle: 'Daily and weekly summaries' },
  '/settings': { title: 'Settings', subtitle: 'Dashboard preferences' },
};

export default function DashboardLayout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { onlineEmployees, alerts } = useSelector((state) => state.dashboard);
  const { isConnected } = useWebSocket();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [alerts]);

  const fetchUnreadCount = async () => {
    try {
      const response = await alertAPI.getStats();
      setUnreadAlerts(response.data.data.unread);
    } catch (e) { }
  };

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenu = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const meta = pageMeta[location.pathname] || { title: 'Dashboard', subtitle: '' };
  const onlineCount = onlineEmployees.length;

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          px: 2.5,
          py: 2.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid rgba(148,163,184,0.12)',
        }}
      >
        <Box sx={{
          width: 40, height: 40, borderRadius: 2.5,
          background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(6,182,212,0.35)',
        }}>
          <MonitorHeart sx={{ fontSize: 24, color: '#04141a' }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.15, color: '#f8fafc' }}>
            EmployeeMonitor
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
            Workforce insights
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1.5, px: 0 }}>
        {navGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            <Typography
              variant="overline"
              sx={{ px: 3, py: 0.75, display: 'block', color: '#64748b', fontSize: '0.66rem' }}
            >
              {group.label}
            </Typography>
            <List disablePadding>
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton
                      selected={active}
                      onClick={() => {
                        navigate(item.path);
                        if (isMobile) setMobileOpen(false);
                      }}
                      sx={{
                        position: 'relative',
                        '&::before': active ? {
                          content: '""',
                          position: 'absolute',
                          left: -10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 4,
                          height: 22,
                          borderRadius: '0 4px 4px 0',
                          background: 'linear-gradient(180deg, #22d3ee, #0891b2)',
                        } : undefined,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? 700 : 500 }}
                      />
                      {item.path === '/alerts' && unreadAlerts > 0 && (
                        <Badge badgeContent={unreadAlerts} color="error" max={99} sx={{ mr: 0.5 }}>
                          <Box sx={{ width: 6, height: 6 }} />
                        </Badge>
                      )}
                      {active && <ChevronRightIcon fontSize="small" sx={{ opacity: 0.7 }} />}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            background: 'linear-gradient(160deg, rgba(6,182,212,0.12) 0%, rgba(148,163,184,0.05) 100%)',
            border: '1px solid rgba(6,182,212,0.18)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700 }}>
              Online now
            </Typography>
            <Chip
              size="small"
              label={`${onlineCount} online`}
              color="success"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Stack>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {onlineEmployees.slice(0, 8).map((emp) => (
              <Badge
                key={emp.employeeId}
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                sx={{ '& .MuiBadge-badge': { backgroundColor: '#34d399', boxShadow: '0 0 0 2px #0a0d14' } }}
              >
                <Avatar sx={{ width: 26, height: 26, fontSize: 11 }}>
                  {(emp.employeeId || '?').slice(0, 2).toUpperCase()}
                </Avatar>
              </Badge>
            ))}
            {onlineEmployees.length === 0 && (
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                No one online right now
              </Typography>
            )}
            {onlineEmployees.length > 8 && (
              <Avatar sx={{ width: 26, height: 26, fontSize: 10, bgcolor: 'rgba(148,163,184,0.2)', color: '#cbd5e1' }}>
                +{onlineEmployees.length - 8}
              </Avatar>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          ml: { md: `${DRAWER_WIDTH}px` },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 0.5, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" noWrap sx={{ color: '#f8fafc', fontSize: '1.05rem' }}>
                {meta.title}
              </Typography>
              {meta.subtitle && (
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    display: { xs: 'none', lg: 'inline' },
                    color: '#64748b',
                    borderLeft: '1px solid rgba(148,163,184,0.25)',
                    pl: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {meta.subtitle}
                </Typography>
              )}
            </Stack>
          </Box>

          <Tooltip title={isConnected ? 'Live connection active' : 'Connection lost'}>
            <Chip
              size="small"
              icon={isConnected ? <CloudDoneIcon /> : <CloudOffIcon />}
              label={isConnected ? 'Live' : 'Offline'}
              color={isConnected ? 'success' : 'error'}
              variant="outlined"
              sx={{ height: 28, fontWeight: 700 }}
            />
          </Tooltip>

          <Tooltip title="Alerts">
            <IconButton color="inherit" onClick={() => navigate('/alerts')} sx={{ color: '#94a3b8' }}>
              <Badge badgeContent={unreadAlerts} color="error" overlap="circular">
                <Notifications fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ my: 1.5, borderColor: 'rgba(148,163,184,0.18)' }} />

          <IconButton onClick={handleMenu} sx={{ p: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Avatar sx={{ width: 34, height: 34, fontSize: 14 }}>
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
                <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                  {user?.name || 'Administrator'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1.2 }}>
                  {user?.email || 'Admin'}
                </Typography>
              </Box>
            </Stack>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ sx: { mt: 1, minWidth: 200, p: 0.5 } }}
          >
            <Box sx={{ px: 2, py: 1.25, display: { sm: 'block', md: 'none' } }}>
              <Typography variant="body2" fontWeight={700}>{user?.name || 'Administrator'}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email || ''}</Typography>
            </Box>
            <Divider sx={{ display: { sm: 'block', md: 'none' } }} />
            <MenuItem onClick={() => { handleClose(); navigate('/employees'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Team
            </MenuItem>
            <MenuItem onClick={() => { handleClose(); navigate('/settings'); }}>
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', fontWeight: 650 }}>
              <ListItemIcon sx={{ color: 'error.main' }}><Logout fontSize="small" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          px: { xs: 2, sm: 3 },
          pt: { xs: 10, sm: 11 },
          pb: 4,
          ml: { md: `${DRAWER_WIDTH}px` },
          maxWidth: { xl: 1600 },
        }}
      >
        <Box className="em-page-enter" key={location.pathname}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
