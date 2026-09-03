import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#06b6d4',
      light: '#22d3ee',
      dark: '#0891b2',
    },
    secondary: {
      main: '#a78bfa',
      light: '#c4b5fd',
      dark: '#7c3aed',
    },
    background: {
      default: '#09090b',
      paper: '#18181b',
    },
    success: {
      main: '#34d399',
    },
    error: {
      main: '#f87171',
    },
    warning: {
      main: '#fbbf24',
    },
    info: {
      main: '#38bdf8',
    },
    text: {
      primary: '#fafafa',
      secondary: '#a1a1aa',
    },
    divider: '#27272a',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    caption: { color: '#71717a' },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#09090b',
          backgroundImage: 'radial-gradient(at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 60%)',
        },
        '#root': {
          backgroundColor: '#09090b',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          backgroundImage: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            borderColor: '#3f3f46',
            boxShadow: '0 0 30px rgba(6,182,212,0.06)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#18181b',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          padding: '8px 20px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
          },
        },
        outlinedPrimary: {
          borderColor: '#3f3f46',
          '&:hover': {
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6,182,212,0.08)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          width: 260,
          borderRight: '1px solid #27272a',
          backgroundColor: '#09090b',
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(9,9,11,0.8)',
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: '1px solid #27272a',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: '#3f3f46',
          backgroundImage: 'none',
          fontWeight: 500,
        },
        colorPrimary: {
          backgroundColor: 'rgba(6,182,212,0.15)',
          color: '#22d3ee',
          borderColor: 'rgba(6,182,212,0.3)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          backgroundImage: 'none',
          borderRadius: 20,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': { borderColor: '#3f3f46' },
            '&:hover fieldset': { borderColor: '#52525b' },
            '&.Mui-focused fieldset': { borderColor: '#06b6d4', borderWidth: 1 },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3f3f46',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginInline: 8,
          '&.Mui-selected': {
            backgroundColor: 'rgba(6,182,212,0.12)',
            color: '#22d3ee',
            '&:hover': { backgroundColor: 'rgba(6,182,212,0.18)' },
            '& .MuiListItemIcon-root': { color: '#22d3ee' },
          },
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(6,182,212,0.15)',
          color: '#22d3ee',
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        colorSuccess: {
          backgroundColor: '#34d399',
        },
      },
    },
  },
});
