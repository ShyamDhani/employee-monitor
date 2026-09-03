import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, IconButton, Menu, MenuItem, Divider,
  Badge, useTheme, useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon, Timeline as TimelineIcon,
  CameraAlt as ScreenshotIcon, Analytics as AnalyticsIcon,
  People as PeopleIcon, Assessment as ReportIcon,
  Settings as SettingsIcon, Menu as MenuIcon, AccountCircle,
  Notifications, Logout, MonitorHeart, GpsFixed, Warning as WarningIcon,
  Mic as MicIcon
} from '@mui/icons-material';
import { logout } from '../../store/authSlice';
import useWebSocket from '../../hooks/useWebSocket';
import { alertAPI } from '../../services/api';

const DRAWER_WIDTH = 260;

const menuItems = [
  { text: 'Live Monitor', icon: <MonitorHeart />, path: '/' },
  { text: 'Alerts', icon: <WarningIcon />, path: '/alerts' },
  { text: 'Timeline', icon: <TimelineIcon />, path: '/timeline' },
  { text: 'Screenshots', icon: <ScreenshotIcon />, path: '/screenshots' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  { text: 'Geofencing', icon: <GpsFixed />, path: '/geofencing' },
  { text: 'Audio', icon: <MicIcon />, path: '/audio' },
  { text: 'Employees', icon: <PeopleIcon />, path: '/employees' },
  { text: 'Reports', icon: <ReportIcon />, path: '/reports' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

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

  const drawer = (
    <Box>
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2,
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MonitorHeart sx={{ fontSize: 22, color: '#fff' }} />
        </Box>
        <Typography variant="h6" fontWeight="bold" sx={{ color: '#fafafa' }}>
          EmployeeMonitor
        </Typography>
      </Box>
      <Divider sx={{ borderColor: '#27272a' }} />
      <List sx={{ px: 1, pt: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ mt: 2, borderColor: '#27272a' }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: '#71717a' }}>
          Online Employees: {onlineEmployees.length}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          {onlineEmployees.slice(0, 6).map((emp) => (
            <Badge
              key={emp.employeeId}
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              sx={{ '& .MuiBadge-badge': { backgroundColor: '#34d399' } }}
            >
              <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
                {emp.employeeId.slice(0, 2).toUpperCase()}
              </Avatar>
            </Badge>
          ))}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ ml: { md: `${DRAWER_WIDTH}px` }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, color: '#fafafa' }}>
            Employee Monitoring Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge color={isConnected ? 'success' : 'error'} variant="dot">
              <Typography variant="caption" sx={{ color: '#a1a1aa' }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Typography>
            </Badge>
            <IconButton color="inherit" onClick={() => navigate('/alerts')}>
              <Badge badgeContent={unreadAlerts} color="error">
                <Notifications />
              </Badge>
            </IconButton>
            <IconButton onClick={handleMenu}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {user?.name?.charAt(0) || 'A'}
              </Avatar>
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
              <MenuItem onClick={handleClose}>Profile</MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
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
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, ml: { md: `${DRAWER_WIDTH}px` } }}>
        {children}
      </Box>
    </Box>
  );
}
