const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

settingsSchema.index({ key: 1 });

const defaultSettings = [
  {
    key: 'monitoring.enabled',
    value: true,
    description: 'Enable/disable monitoring system'
  },
  {
    key: 'monitoring.default_screenshot_interval',
    value: 30,
    description: 'Default screenshot interval in seconds'
  },
  {
    key: 'monitoring.default_activity_interval',
    value: 5,
    description: 'Default activity check interval in seconds'
  },
  {
    key: 'monitoring.heartbeat_timeout',
    value: 90,
    description: 'Heartbeat timeout in seconds'
  },
  {
    key: 'retention.activity_days',
    value: 90,
    description: 'Days to retain activity data'
  },
  {
    key: 'retention.screenshot_days',
    value: 30,
    description: 'Days to retain screenshots'
  },
  {
    key: 'alerts.enabled',
    value: true,
    description: 'Enable alerts system'
  },
  {
    key: 'alerts.off_hours_start',
    value: 22,
    description: 'Off-hours start time (24h format)'
  },
  {
    key: 'alerts.off_hours_end',
    value: 6,
    description: 'Off-hours end time (24h format)'
  },
  {
    key: 'productivity.unproductive_apps',
    value: ['com.facebook.katana', 'com.instagram.android', 'com.twitter.android', 'com.ss.android.ugc.trill', 'com.google.android.youtube'],
    description: 'List of unproductive app packages'
  }
];

settingsSchema.statics.initializeDefaults = async function() {
  for (const setting of defaultSettings) {
    await this.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true }
    );
  }
};

settingsSchema.statics.getSetting = async function(key) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : null;
};

settingsSchema.statics.setSetting = async function(key, value, userId) {
  return this.findOneAndUpdate(
    { key },
    { $set: { value, updatedBy: userId } },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
