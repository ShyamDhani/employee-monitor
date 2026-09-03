const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema({
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
  audioBase64: {
    type: String,
    required: true
  },
  sampleRate: {
    type: Number,
    default: 16000
  },
  durationMs: {
    type: Number,
    default: 0
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

audioSchema.index({ employeeId: 1, timestamp: -1 });
audioSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Audio', audioSchema);
