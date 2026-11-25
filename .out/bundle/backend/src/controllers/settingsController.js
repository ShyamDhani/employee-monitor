const Settings = require('../models/Settings');

const commandQueues = new Map();

exports.queueCommand = (employeeId, command, data = {}) => {
  if (!commandQueues.has(employeeId)) {
    commandQueues.set(employeeId, []);
  }
  commandQueues.get(employeeId).push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    command,
    data,
    createdAt: new Date().toISOString()
  });
};

exports.pollCommands = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const commands = commandQueues.get(employee_id) || [];
    commandQueues.set(employee_id, []);
    res.json({ success: true, commands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendCommand = async (req, res) => {
  try {
    const { employee_id, command, data } = req.body;
    if (!employee_id || !command) {
      return res.status(400).json({ success: false, message: 'employee_id and command required' });
    }
    exports.queueCommand(employee_id, command, data || {});
    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('command:queued', { employeeId: employee_id, command });
    }
    res.json({ success: true, message: `Command '${command}' queued for ${employee_id}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllSettings = async (req, res) => {
  try {
    await Settings.initializeDefaults();
    const settings = await Settings.find({}).sort({ key: 1 });
    const grouped = {};
    for (const s of settings) {
      const prefix = s.key.split('.')[0];
      if (!grouped[prefix]) grouped[prefix] = {};
      grouped[prefix][s.key] = { value: s.value, description: s.description };
    }
    res.json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const value = await Settings.getSetting(key);
    if (value === null) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }
    res.json({ success: true, key, value });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await Settings.setSetting(key, value, req.user?._id);
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      const setting = await Settings.setSetting(key, value, req.user?._id);
      results.push(setting);
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDeviceConfig = async (req, res) => {
  try {
    await Settings.initializeDefaults();
    const screenshotInterval = await Settings.getSetting('monitoring.default_screenshot_interval');
    const activityInterval = await Settings.getSetting('monitoring.default_activity_interval');
    const locationTracking = await Settings.getSetting('monitoring.location_tracking') || true;
    const cameraMonitoring = await Settings.getSetting('monitoring.camera_mic_monitoring') || false;
    res.json({
      success: true,
      settings: {
        screenshot_interval_ms: (screenshotInterval || 30) * 1000,
        activity_check_interval_ms: (activityInterval || 5) * 1000,
        location_tracking: locationTracking,
        camera_monitoring: cameraMonitoring,
        enabled: await Settings.getSetting('monitoring.enabled') || true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
