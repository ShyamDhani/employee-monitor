const mongoose = require('mongoose');

const RETRY_DELAYS_MS = [5000, 10000, 20000, 30000];
let attempt = 0;
let retryTimer = null;

const uri = () =>
  process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_monitor';

const scheduleRetry = (reason) => {
  if (retryTimer) return;
  attempt += 1;
  const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
  console.error(
    `MongoDB connection problem (attempt ${attempt}): ${reason}. Retrying in ${delay / 1000}s`
  );
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectDB();
  }, delay);
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  try {
    const conn = await mongoose.connect(uri(), {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    attempt = 0;
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    scheduleRetry(error.message);
  }
};

mongoose.connection.on('connected', () => {
  attempt = 0;
  console.log('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  scheduleRetry('disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});

module.exports = connectDB;
