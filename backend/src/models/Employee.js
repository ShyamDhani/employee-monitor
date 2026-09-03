const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  department: {
    type: String,
    default: 'General'
  },
  group: {
    type: String,
    default: 'default'
  },
  deviceInfo: {
    platform: {
      type: String,
      default: 'android'
    },
    model: String,
    osVersion: String,
    appVersion: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  monitoringEnabled: {
    type: Boolean,
    default: true
  },
  monitoringConfig: {
    screenshotInterval: {
      type: Number,
      default: 30
    },
    activityInterval: {
      type: Number,
      default: 5
    },
    networkMonitoring: {
      type: Boolean,
      default: true
    },
    locationTracking: {
      type: Boolean,
      default: false
    },
    cameraMicMonitoring: {
      type: Boolean,
      default: true
    },
    usbMonitoring: {
      type: Boolean,
      default: true
    }
  },
  lastSeen: {
    type: Date
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ group: 1 });
employeeSchema.index({ status: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
