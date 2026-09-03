const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  appPackage: {
    type: String,
    required: true
  },
  appName: {
    type: String
  },
  windowTitle: {
    type: String,
    default: ''
  },
  durationMs: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  keystrokeCount: {
    type: Number,
    default: 0
  },
  isScreenOn: {
    type: Boolean,
    default: true
  },
  batteryLevel: {
    type: Number
  },
  wifiConnected: {
    type: Boolean
  },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  networkUsage: {
    rxBytes: Number,
    txBytes: Number,
    rxPackets: Number,
    txPackets: Number
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

activitySchema.index({ employeeId: 1, timestamp: -1 });
activitySchema.index({ employeeId: 1, appPackage: 1 });
activitySchema.index({ employeeId: 1, appPackage: 1, startTime: 1 }, { unique: true, sparse: true });
activitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('Activity', activitySchema);
