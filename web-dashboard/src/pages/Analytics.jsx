import { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Grid, TextField, MenuItem } from '@mui/material';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { format, subDays } from 'date-fns';
import { reportAPI, employeeAPI } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COLORS = ['#1976D2', '#388E3C', '#F57C00', '#D32F2F', '#7B1FA2', '#00796B', '#C2185B', '#5D4037'];

export default function Analytics() {
  const [productivity, setProductivity] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchEmployees();
    fetchData();
  }, [selectedEmployee, selectedDate]);

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
      const params = { start_date: selectedDate, end_date: selectedDate };
      if (selectedEmployee !== 'all') params.employee_id = selectedEmployee;
      const [prodRes, dailyRes] = await Promise.all([
        reportAPI.getProductivity(params),
        reportAPI.getDaily({ employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined, date: selectedDate })
      ]);
      setProductivity(prodRes.data.data);
      setDailyReport(dailyRes.data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const appUsageChartData = {
    labels: productivity?.appUsage?.slice(0, 8).map(a => a._id?.appName || a._id?.appPackage) || [],
    datasets: [{
      label: 'Time (hours)',
      data: productivity?.appUsage?.slice(0, 8).map(a => a.totalTime / 3600000) || [],
      backgroundColor: COLORS,
      borderWidth: 0,
    }]
  };

  const productivityChartData = {
    labels: ['Productive', 'Unproductive', 'Neutral'],
    datasets: [{
      data: [productivity?.productiveTime || 0, productivity?.unproductiveTime || 0, productivity?.neutralTime || 0],
      backgroundColor: ['#4CAF50', '#F44336', '#FFC107'],
      borderWidth: 0,
    }]
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Analytics</Typography>
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
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Productivity Score</Typography>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h2" fontWeight="bold" color={productivity?.productivityScore > 60 ? 'success.main' : productivity?.productivityScore > 30 ? 'warning.main' : 'error.main'}>
                  {productivity?.productivityScore || 0}%
                </Typography>
                <Typography color="text.secondary">Productive Time</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Screen Time</Typography>
              <Typography variant="h3" fontWeight="bold" color="primary">
                {dailyReport?.totalActiveTime ? Math.round(dailyReport.totalActiveTime / 3600000 * 10) / 10 : 0}h
              </Typography>
              <Typography color="text.secondary">{dailyReport?.uniqueApps || 0} unique apps used</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Screenshots</Typography>
              <Typography variant="h3" fontWeight="bold" color="info.main">
                {dailyReport?.screenshotCount || 0}
              </Typography>
              <Typography color="text.secondary">captured today</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>App Usage</Typography>
              <Box sx={{ height: 300 }}>
                <Bar data={appUsageChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } } }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Productivity Breakdown</Typography>
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut data={productivityChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
