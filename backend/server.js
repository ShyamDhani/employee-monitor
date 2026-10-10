require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const connectDB = require('./src/config/database');
const { setupSocketHandlers } = require('./src/config/websocket');
const authRoutes = require('./src/routes/authRoutes');
const employeeRoutes = require('./src/routes/employeeRoutes');
const activityRoutes = require('./src/routes/activityRoutes');
const screenshotRoutes = require('./src/routes/screenshotRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const locationRoutes = require('./src/routes/locationRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const alertRoutes = require('./src/routes/alertRoutes');
const audioRoutes = require('./src/routes/audioRoutes');
const tileRoutes = require('./src/routes/tileRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 10e6
});

const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
const screenshotsDir = path.join(uploadsDir, 'screenshots');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

try {
  const testFile = path.join(screenshotsDir, '.write_test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('[Startup] uploads/screenshots directory: writable');
} catch (e) {
  console.error('[Startup] CRITICAL: uploads/screenshots directory is NOT writable:', e.message);
}

connectDB();

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many uploads, try again later' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests, try again later' }
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: function(origin, callback) {
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.set('io', io);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  let db = null;
  try {
    db = require('./src/config/database').getStatus();
  } catch (e) {
    db = { state: 'unknown', lastError: e.message };
  }
  res.json({
    status: 'ok',
    db,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/screenshots/count', async (req, res) => {
  try {
    const Screenshot = require('./src/models/Screenshot');
    const count = await Screenshot.countDocuments();
    const latest = await Screenshot.findOne().sort({ createdAt: -1 }).select('employeeId timestamp appPackage imageUrl createdAt');
    res.json({ success: true, count, latest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/activity/upload', uploadLimiter);
app.use('/api/activity/batch', uploadLimiter);
app.use('/api/activity', activityRoutes);
app.use('/api/screenshot/upload', uploadLimiter);
app.use('/api/screenshot/batch', uploadLimiter);
app.use('/api/screenshot', screenshotRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/location', apiLimiter, locationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/alerts', apiLimiter, alertRoutes);
app.use('/api/audio', apiLimiter, audioRoutes);
app.use(tileRoutes);

setupSocketHandlers(io);

const frontendDir = path.join(__dirname, '..', 'web-dashboard', 'dist');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(frontendDir, 'index.html'));
    }
  });
  console.log('[Startup] Serving frontend from:', frontendDir);
} else {
  console.log('[Startup] Frontend dist not found at:', frontendDir);
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (all interfaces)`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server, io };
