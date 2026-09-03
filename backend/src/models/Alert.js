const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'unusual_activity',
      'policy_violation',
      'off_hours_usage',
      'excessive_break',
      'unauthorized_app',
      'suspicious_behavior',
      'device_offline',
      'custom'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isAcknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

alertSchema.index({ employeeId: 1, createdAt: -1 });
alertSchema.index({ type: 1, severity: 1 });
alertSchema.index({ isRead: 1 });

module.exports = mongoose.model('Alert', alertSchema);
