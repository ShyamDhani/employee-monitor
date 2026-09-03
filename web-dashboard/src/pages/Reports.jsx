import { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, MenuItem, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { format, subDays } from 'date-fns';
import { reportAPI, employeeAPI } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const formatDuration = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function Reports() {
  const [dailyReport, setDailyReport] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchReports();
  }, [selectedEmployee, selectedDate]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee;
      const [dailyRes, weeklyRes] = await Promise.all([
        reportAPI.getDaily(params),
        reportAPI.getWeekly(params)
      ]);
      setDailyReport(dailyRes.data.data);
      setWeeklyReport(weeklyRes.data.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const weeklyChartData = {
    labels: [...new Set(weeklyReport?.dailyBreakdown?.map(d => d._id?.day) || [])],
    datasets: weeklyReport?.dailyBreakdown
      ? Object.entries(
          weeklyReport.dailyBreakdown.reduce((acc, item) => {
            const day = item._id?.day;
            const app = item._id?.appName || item._id?.appPackage;
            if (!acc[app]) acc[app] = {};
            acc[app][day] = item.totalTime;
            return acc;
          }, {})
        ).map(([app, days], i) => ({
          label: app,
          data: Object.values(days),
          backgroundColor: `hsl(${i * 45}, 70%, 60%)`,
        }))
      : []
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Reports</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField type="date" size="small" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        <TextField select size="small" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="all">All Employees</MenuItem>
          {employees.map((emp) => (
            <MenuItem key={emp.employeeId} value={emp.employeeId}>{emp.name}</MenuItem>
          ))}
        </TextField>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Daily Report - {selectedDate}</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Total Active Time</Typography>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {formatDuration(dailyReport?.totalActiveTime || 0)}
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>App</TableCell>
                      <TableCell align="right">Time</TableCell>
                      <TableCell align="right">Sessions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyReport?.appUsage?.slice(0, 10).map((app, index) => (
                      <TableRow key={index}>
                        <TableCell>{app._id?.appName || app._id?.appPackage}</TableCell>
                        <TableCell align="right">{formatDuration(app.totalTime)}</TableCell>
                        <TableCell align="right">{app.sessions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Weekly Overview</Typography>
              <Box sx={{ height: 300 }}>
                {weeklyChartData.labels.length > 0 ? (
                  <Bar data={weeklyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'Time (hours)' } } } }} />
                ) : (
                  <Typography textAlign="center" py={10} color="text.secondary">No weekly data available</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
