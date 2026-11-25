const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
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
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  accuracy: {
    type: Number,
    default: 0
  },
  altitude: {
    type: Number,
    default: 0
  },
  speed: {
    type: Number,
    default: 0
  },
  bearing: {
    type: Number,
    default: 0
  },
  address: {
    type: String
  }
}, {
  timestamps: true
});

locationSchema.index({ employeeId: 1, timestamp: -1 });
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Location', locationSchema);
