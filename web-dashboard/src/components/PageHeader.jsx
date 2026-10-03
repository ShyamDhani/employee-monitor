import { Box, Typography, Stack } from '@mui/material';

export default function PageHeader({ icon = null, title, subtitle, actions = null, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {icon && (
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22d3ee',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.20) 0%, rgba(6,182,212,0.05) 100%)',
                border: '1px solid rgba(6,182,212,0.28)',
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="h5" component="h1" sx={{ lineHeight: 1.2 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {actions && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {actions}
          </Stack>
        )}
      </Box>
      {children}
    </Box>
  );
}
