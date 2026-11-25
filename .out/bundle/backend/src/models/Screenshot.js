const mongoose = require('mongoose');

const screenshotSchema = new mongoose.Schema({
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
  imageUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String
  },
  appPackage: {
    type: String
  },
  windowTitle: {
    type: String,
    default: ''
  },
  width: {
    type: Number
  },
  height: {
    type: Number
  },
  format: {
    type: String,
    default: 'jpeg'
  },
  fileSize: {
    type: Number
  },
  isAnnotated: {
    type: Boolean,
    default: false
  },
  annotations: [{
    type: {
      type: String,
      enum: ['highlight', 'arrow', 'text', 'rectangle']
    },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    text: String,
    color: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

screenshotSchema.index({ employeeId: 1, timestamp: -1 });
screenshotSchema.index({ employeeId: 1, appPackage: 1 });
screenshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Screenshot', screenshotSchema);
