import { createSlice } from '@reduxjs/toolkit';

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    employees: [],
    selectedEmployee: null,
    activities: [],
    screenshots: [],
    alerts: [],
    timeline: [],
    onlineEmployees: [],
    stats: null,
    loading: false,
  },
  reducers: {
    setEmployees: (state, action) => {
      state.employees = action.payload;
    },
    setSelectedEmployee: (state, action) => {
      state.selectedEmployee = action.payload;
    },
    setActivities: (state, action) => {
      state.activities = action.payload;
    },
    addActivity: (state, action) => {
      state.activities.unshift(action.payload);
      if (state.activities.length > 100) {
        state.activities.pop();
      }
    },
    setScreenshots: (state, action) => {
      state.screenshots = action.payload;
    },
    addScreenshot: (state, action) => {
      state.screenshots.unshift(action.payload);
      if (state.screenshots.length > 50) {
        state.screenshots.pop();
      }
    },
    setAlerts: (state, action) => {
      state.alerts = action.payload;
    },
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
      if (state.alerts.length > 100) {
        state.alerts.pop();
      }
    },
    setTimeline: (state, action) => {
      state.timeline = action.payload;
    },
    setOnlineEmployees: (state, action) => {
      state.onlineEmployees = action.payload;
    },
    addOnlineEmployee: (state, action) => {
      const exists = state.onlineEmployees.find(e => e.employeeId === action.payload.employeeId);
      if (!exists) {
        state.onlineEmployees.push(action.payload);
      }
    },
    removeOnlineEmployee: (state, action) => {
      state.onlineEmployees = state.onlineEmployees.filter(e => e.employeeId !== action.payload.employeeId);
    },
    setStats: (state, action) => {
      state.stats = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const {
  setEmployees, setSelectedEmployee, setActivities, addActivity,
  setScreenshots, addScreenshot, setAlerts, addAlert, setTimeline, setOnlineEmployees,
  addOnlineEmployee, removeOnlineEmployee, setStats, setLoading
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
