import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
  getMe: () => api.get('/auth/me'),
};

export const employeeAPI = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  register: (data) => api.post('/employees/register', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
};

export const activityAPI = {
  upload: (data) => api.post('/activity/upload', data),
  uploadBatch: (data) => api.post('/activity/batch', data),
  getAll: (params) => api.get('/activity', { params }),
  getTimeline: (params) => api.get('/activity/timeline', { params }),
  getSummary: (params) => api.get('/activity/summary', { params }),
  getHourly: (params) => api.get('/activity/hourly', { params }),
};

export const screenshotAPI = {
  upload: (data) => api.post('/screenshot/upload', data),
  uploadBatch: (data) => api.post('/screenshot/batch', data),
  getAll: (params) => api.get('/screenshot', { params }),
  getByApp: (params) => api.get('/screenshot/by-app', { params }),
  getById: (id) => api.get(`/screenshot/${id}`),
  addAnnotation: (id, data) => api.post(`/screenshot/${id}/annotate`, data),
  delete: (id) => api.delete(`/screenshot/${id}`),
};

export const reportAPI = {
  getDaily: (params) => api.get('/reports/daily', { params }),
  getWeekly: (params) => api.get('/reports/weekly', { params }),
  getProductivity: (params) => api.get('/reports/productivity', { params }),
  getEmployeeStats: (employeeId) => api.get(`/reports/employee/${employeeId}`),
};

export const alertAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  getStats: (params) => api.get('/alerts/stats', { params }),
  markAsRead: (id) => api.put(`/alerts/${id}/read`),
  markAllAsRead: (params) => api.put('/alerts/read-all', null, { params }),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
  delete: (id) => api.delete(`/alerts/${id}`),
};

export default api;
