const Activity = require('../models/Activity');
const Employee = require('../models/Employee');

exports.uploadActivity = async (req, res) => {
  try {
    const { employee_id, timestamp, app_package, app_name, window_title, duration_ms, start_time, end_time, keystroke_count, is_screen_on, battery_level, wifi_connected, location, network_usage } = req.body;

    // Upsert: if same employee + app + start_time exists, update it
    const startTimeDate = start_time ? new Date(start_time) : new Date(timestamp);
    const filter = {
      employeeId: employee_id,
      appPackage: app_package,
      startTime: startTimeDate
    };
    const update = {
      $set: {
        timestamp: new Date(timestamp),
        appName: app_name,
        windowTitle: window_title || '',
        durationMs: duration_ms,
        endTime: end_time ? new Date(end_time) : undefined,
        keystrokeCount: keystroke_count,
        isScreenOn: is_screen_on,
        batteryLevel: battery_level,
        wifiConnected: wifi_connected,
        location,
        networkUsage: network_usage
      },
      $setOnInsert: {
        employeeId: employee_id,
        appPackage: app_package,
        startTime: startTimeDate
      }
    };

    const activity = await Activity.findOneAndUpdate(filter, update, { upsert: true, new: true });

    await Employee.findOneAndUpdate(
      { employeeId: employee_id },
      { lastSeen: new Date(), isOnline: true, name: `Employee ${employee_id}` },
      { upsert: true, new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('activity:realtime', {
        employeeId: employee_id,
        appPackage: app_package,
        appName: app_name,
        durationMs: duration_ms,
        startTime: startTimeDate,
        endTime: end_time ? new Date(end_time) : undefined,
        timestamp: activity.timestamp
      });
      io.to('dashboard').emit('employee:online', { employeeId: employee_id });
    }
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadActivityBatch = async (req, res) => {
  try {
    const { employee_id, data } = req.body;
    const activities = data.map(item => ({
      employeeId: employee_id,
      timestamp: new Date(item.timestamp),
      appPackage: item.app_package,
      appName: item.app_name,
      windowTitle: item.window_title,
      durationMs: item.duration_ms,
      startTime: item.start_time ? new Date(item.start_time) : undefined,
      endTime: item.end_time ? new Date(item.end_time) : undefined,
      keystrokeCount: item.keystroke_count
    }));
    await Activity.insertMany(activities);
    await Employee.findOneAndUpdate(
      { employeeId: employee_id },
      { lastSeen: new Date(), isOnline: true }
    );
    res.status(201).json({ success: true, count: activities.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadUsageSummary = async (req, res) => {
  try {
    const { employee_id, timestamp, total_usage } = req.body;
    if (!employee_id || !total_usage) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('usage:summary', {
        employeeId: employee_id,
        timestamp: new Date(timestamp),
        totalUsage: total_usage
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, app_package, page = 1, limit = 100 } = req.query;
    const query = {};
    if (employee_id) query.employeeId = employee_id;
    if (app_package) query.appPackage = app_package;
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }
    const total = await Activity.countDocuments(query);
    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, count: activities.length, total, page: parseInt(page), pages: Math.ceil(total / limit), data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimeline = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, limit: queryLimit } = req.query;
    const query = {};
    if (employee_id) query.employeeId = employee_id;
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }
    const limitNum = parseInt(queryLimit) || 2000;
    const timeline = await Activity.find(query)
      .select('employeeId timestamp appPackage appName windowTitle durationMs startTime endTime')
      .sort({ timestamp: 1 })
      .limit(limitNum);
    res.json({ success: true, count: timeline.length, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAppUsageSummary = async (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.query;
    const matchQuery = {};
    if (employee_id) matchQuery.employeeId = employee_id;
    if (start_date || end_date) {
      matchQuery.timestamp = {};
      if (start_date) matchQuery.timestamp.$gte = new Date(start_date);
      if (end_date) matchQuery.timestamp.$lte = new Date(end_date);
    }
    const summary = await Activity.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { employeeId: '$employeeId', appPackage: '$appPackage', appName: '$appName' },
          totalTime: { $sum: '$durationMs' },
          totalKeystrokes: { $sum: '$keystrokeCount' },
          sessions: { $sum: 1 },
          lastUsed: { $max: '$timestamp' },
          firstUsed: { $min: '$timestamp' }
        }
      },
      { $sort: { totalTime: -1 } }
    ]);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHourlyBreakdown = async (req, res) => {
  try {
    const { employee_id, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const matchQuery = {
      timestamp: { $gte: targetDate, $lt: nextDay }
    };
    if (employee_id) matchQuery.employeeId = employee_id;
    const breakdown = await Activity.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            appPackage: '$appPackage',
            appName: '$appName'
          },
          totalTime: { $sum: '$durationMs' }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
