import { createTheme } from '@mui/material/styles';

const ACCENT = '#06b6d4';
const ACCENT_LIGHT = '#22d3ee';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: ACCENT,
      light: ACCENT_LIGHT,
      dark: '#0891b2',
    },
    secondary: {
      main: '#a78bfa',
      light: '#c4b5fd',
      dark: '#7c3aed',
    },
    background: {
      default: '#0a0d14',
      paper: '#12161f',
    },
    success: { main: '#34d399' },
    error: { main: '#f87171' },
    warning: { main: '#fbbf24' },
    info: { main: '#38bdf8' },
    text: {
      primary: '#eef2f7',
      secondary: '#94a3b8',
    },
    divider: 'rgba(148, 163, 184, 0.14)',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.025em' },
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 650, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body2: { color: '#94a3b8' },
    overline: { fontWeight: 700, letterSpacing: '0.08em' },
    button: { fontWeight: 650, textTransform: 'none' },
    caption: { color: '#7b8794' },
  },
  shape: { borderRadius: 14 },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.35)',
    '0 2px 6px rgba(0,0,0,0.35)',
    '0 4px 14px rgba(0,0,0,0.35)',
    '0 8px 24px rgba(0,0,0,0.4)',
    '0 12px 32px rgba(0,0,0,0.42)',
    '0 16px 40px rgba(0,0,0,0.45)',
    '0 20px 48px rgba(0,0,0,0.48)',
    ...Array(16).fill('0 24px 56px rgba(0,0,0,0.5)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0a0d14',
          backgroundImage:
            'radial-gradient(900px 500px at 15% -10%, rgba(6,182,212,0.10) 0%, transparent 60%), radial-gradient(800px 480px at 100% 0%, rgba(167,139,250,0.08) 0%, transparent 55%)',
          backgroundAttachment: 'fixed',
        },
        '#root': {
          backgroundColor: 'transparent',
        },
        '::selection': {
          backgroundColor: 'rgba(6,182,212,0.35)',
          color: '#ffffff',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: 'rgba(18,22,31,0.88)',
          border: '1px solid rgba(148,163,184,0.12)',
          backgroundImage: 'none',
          transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 650,
          borderRadius: 10,
          padding: '8px 18px',
          boxShadow: 'none',
        },
        sizeSmall: { padding: '5px 12px', borderRadius: 8 },
        containedPrimary: {
          backgroundImage: `linear-gradient(135deg, ${ACCENT_LIGHT} 0%, ${ACCENT} 55%, #0e7490 100%)`,
          color: '#04141a',
          '&:hover': { backgroundImage: `linear-gradient(135deg, #67e8f9 0%, ${ACCENT_LIGHT} 60%, ${ACCENT} 100%)` },
        },
        outlined: { border: '1px solid rgba(148,163,184,0.28)' },
        outlinedPrimary: {
          borderColor: 'rgba(6,182,212,0.5)',
          '&:hover': { borderColor: ACCENT, backgroundColor: 'rgba(6,182,212,0.10)' },
        },
        text: { '&:hover': { backgroundColor: 'rgba(148,163,184,0.08)' } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
        colorDefault: { '&:hover': { backgroundColor: 'rgba(148,163,184,0.10)' } },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: 'rgba(148,163,184,0.05)',
            '& fieldset': { borderColor: 'rgba(148,163,184,0.22)' },
            '&:hover fieldset': { borderColor: 'rgba(148,163,184,0.4)' },
            '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1.5 },
          },
          '& .MuiInputLabel-root': { color: '#94a3b8' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: 'rgba(148,163,184,0.05)',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.22)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.4)' },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { borderRadius: 8, minHeight: 42 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, border: '1px solid transparent' },
        colorPrimary: {
          backgroundColor: 'rgba(6,182,212,0.14)',
          color: '#67e8f9',
          border: '1px solid rgba(6,182,212,0.32)',
        },
        colorSuccess: {
          backgroundColor: 'rgba(52,211,153,0.14)',
          color: '#6ee7b7',
          border: '1px solid rgba(52,211,153,0.32)',
        },
        colorError: {
          backgroundColor: 'rgba(248,113,113,0.14)',
          color: '#fca5a5',
          border: '1px solid rgba(248,113,113,0.32)',
        },
        colorWarning: {
          backgroundColor: 'rgba(251,191,36,0.14)',
          color: '#fcd34d',
          border: '1px solid rgba(251,191,36,0.32)',
        },
        colorDefault: {
          backgroundColor: 'rgba(148,163,184,0.12)',
          color: '#cbd5e1',
          border: '1px solid rgba(148,163,184,0.22)',
        },
        outlined: {
          backgroundColor: 'rgba(148,163,184,0.08)',
          borderColor: 'rgba(148,163,184,0.28)',
          color: '#cbd5e1',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          width: 264,
          borderRight: '1px solid rgba(148,163,184,0.12)',
          backgroundColor: 'rgba(10,13,20,0.98)',
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10,13,20,0.78)',
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(148,163,184,0.12)',
          backdropFilter: 'blur(14px)',
          color: '#eef2f7',
        },
      },
    },
    MuiToolbar: { styleOverrides: { root: { minHeight: 68 } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#12161f',
          border: '1px solid rgba(148,163,184,0.16)',
          backgroundImage: 'none',
          borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 700, fontSize: '1.1rem', paddingBottom: 8 } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px' } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginInline: 10,
          paddingInline: 12,
          minHeight: 44,
          color: '#94a3b8',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          '&:hover': { backgroundColor: 'rgba(148,163,184,0.08)', color: '#eef2f7' },
          '&.Mui-selected': {
            backgroundImage: 'linear-gradient(90deg, rgba(6,182,212,0.20) 0%, rgba(6,182,212,0.04) 100%)',
            color: '#67e8f9',
            '&:hover': { backgroundColor: 'rgba(6,182,212,0.18)' },
            '& .MuiListItemIcon-root': { color: '#22d3ee' },
            '& .MuiListItemText-primary': { fontWeight: 650 },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 38, color: 'inherit' } },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          backgroundImage: 'linear-gradient(135deg, rgba(6,182,212,0.9) 0%, rgba(14,116,144,0.9) 100%)',
          color: '#04141a',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 3, borderRadius: 3, backgroundImage: `linear-gradient(90deg, ${ACCENT_LIGHT}, ${ACCENT})` },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 650,
          minHeight: 48,
          paddingInline: 20,
          '&.Mui-selected': { color: ACCENT_LIGHT },
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: { borderRadius: 10, borderColor: 'rgba(148,163,184,0.2)' },
        '&.Mui-selected': {
          backgroundImage: `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT})`,
          color: '#04141a',
          fontWeight: 700,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1b2130',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 10px',
        },
        arrow: { color: '#1b2130' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: 'rgba(148,163,184,0.06)',
          color: '#cbd5e1',
          fontWeight: 700,
          fontSize: '0.78rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: 'none',
        },
        root: { borderBottom: '1px solid rgba(148,163,184,0.10)' },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT_LIGHT } },
        track: { borderRadius: 12, backgroundColor: 'rgba(148,163,184,0.3)' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 6, backgroundColor: 'rgba(148,163,184,0.14)' },
        bar: { borderRadius: 6, backgroundImage: `linear-gradient(90deg, ${ACCENT_LIGHT}, ${ACCENT})` },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 500, border: '1px solid transparent' },
        standardSuccess: { backgroundColor: 'rgba(52,211,153,0.12)', color: '#a7f3d0' },
        standardError: { backgroundColor: 'rgba(248,113,113,0.12)', color: '#fecaca' },
        standardWarning: { backgroundColor: 'rgba(251,191,36,0.12)', color: '#fde68a' },
        standardInfo: { backgroundColor: 'rgba(56,189,248,0.12)', color: '#bae6fd' },
      },
    },
    MuiBadge: {
      styleOverrides: {
        colorSuccess: { backgroundColor: '#34d399', color: '#04141a' },
        badge: { fontWeight: 700 },
      },
    },
  },
});
