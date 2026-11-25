const Activity = require('../models/Activity');
const Screenshot = require('../models/Screenshot');
const Employee = require('../models/Employee');

exports.getDailyReport = async (req, res) => {
  try {
    const { employee_id, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const matchQuery = { timestamp: { $gte: targetDate, $lt: nextDay } };
    if (employee_id) matchQuery.employeeId = employee_id;
    const appUsage = await Activity.aggregate([
      { $match: matchQuery },
      { $group: { _id: { appPackage: '$appPackage', appName: '$appName' }, totalTime: { $sum: '$durationMs' }, sessions: { $sum: 1 } } },
      { $sort: { totalTime: -1 } }
    ]);
    const totalActiveTime = appUsage.reduce((sum, item) => sum + item.totalTime, 0);
    const screenshotCount = await Screenshot.countDocuments({ timestamp: { $gte: targetDate, $lt: nextDay }, ...(employee_id && { employeeId: employee_id }) });
    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        employeeId: employee_id || 'all',
        totalActiveTime,
        appUsage,
        screenshotCount,
        productiveApps: appUsage.filter(a => a.totalTime > 300000).length,
        uniqueApps: appUsage.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWeeklyReport = async (req, res) => {
  try {
    const { employee_id, start_date } = req.query;
    const startDate = start_date ? new Date(start_date) : new Date();
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    const matchQuery = { timestamp: { $gte: startDate, $lt: endDate } };
    if (employee_id) matchQuery.employeeId = employee_id;
    const dailyBreakdown = await Activity.aggregate([
      { $match: matchQuery },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, appPackage: '$appPackage', appName: '$appName' }, totalTime: { $sum: '$durationMs' } } },
      { $sort: { '_id.day': 1 } }
    ]);
    res.json({ success: true, data: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), dailyBreakdown } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductivityReport = async (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.query;
    const matchQuery = {};
    if (employee_id) matchQuery.employeeId = employee_id;
    if (start_date || end_date) {
      matchQuery.timestamp = {};
      if (start_date) matchQuery.timestamp.$gte = new Date(start_date);
      if (end_date) matchQuery.timestamp.$lte = new Date(end_date);
    }
    const Settings = require('../models/Settings');
    const unproductiveApps = await Settings.getSetting('productivity.unproductive_apps') || [];
    const appUsage = await Activity.aggregate([
      { $match: matchQuery },
      { $group: { _id: { appPackage: '$appPackage', appName: '$appName' }, totalTime: { $sum: '$durationMs' } } },
      { $sort: { totalTime: -1 } }
    ]);
    let productiveTime = 0;
    let unproductiveTime = 0;
    let neutralTime = 0;
    appUsage.forEach(app => {
      if (unproductiveApps.includes(app._id.appPackage)) {
        unproductiveTime += app.totalTime;
      } else if (app._id.appPackage.includes('com.google.android.gm') || app._id.appPackage.includes('com.microsoft.office') || app._id.appPackage.includes('com.slack')) {
        productiveTime += app.totalTime;
      } else {
        neutralTime += app.totalTime;
      }
    });
    const total = productiveTime + unproductiveTime + neutralTime;
    res.json({
      success: true,
      data: {
        productiveTime,
        unproductiveTime,
        neutralTime,
        total,
        productivityScore: total > 0 ? Math.round((productiveTime / total) * 100) : 0,
        appUsage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployeeStats = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const employee = await Employee.findOne({ employeeId: employee_id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const todayStats = await Activity.aggregate([
      { $match: { employeeId: employee_id, timestamp: { $gte: todayStart } } },
      { $group: { _id: '$appPackage', totalTime: { $sum: '$durationMs' } } },
      { $sort: { totalTime: -1 } }
    ]);
    const weekStats = await Activity.aggregate([
      { $match: { employeeId: employee_id, timestamp: { $gte: weekStart } } },
      { $group: { _id: '$appPackage', totalTime: { $sum: '$durationMs' } } },
      { $sort: { totalTime: -1 } }
    ]);
    const totalToday = todayStats.reduce((sum, item) => sum + item.totalTime, 0);
    const totalWeek = weekStats.reduce((sum, item) => sum + item.totalTime, 0);
    res.json({
      success: true,
      data: {
        employee: { employeeId: employee.employeeId, name: employee.name },
        today: { totalTime: totalToday, apps: todayStats.slice(0, 10) },
        week: { totalTime: totalWeek, apps: weekStats.slice(0, 20) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
