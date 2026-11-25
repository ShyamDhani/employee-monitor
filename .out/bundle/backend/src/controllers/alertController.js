const Alert = require('../models/Alert');
const Screenshot = require('../models/Screenshot');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.createAlert = async (req, res) => {
  try {
    const { employee_id, timestamp, app_package, app_name, type, severity, title, message, image_base64 } = req.body;

    console.log(`[Alert] New alert from employee: ${employee_id}, app: ${app_name}, type: ${type}`);

    let screenshotUrl = null;

    if (image_base64) {
      const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${employee_id}_alert_${timestamp}_${uuidv4()}.jpeg`;
      const filepath = path.join(__dirname, '../../uploads/screenshots', filename);
      fs.writeFileSync(filepath, buffer);
      screenshotUrl = `/uploads/screenshots/${filename}`;

      await Screenshot.create({
        employeeId: employee_id,
        timestamp: new Date(timestamp),
        imageUrl: screenshotUrl,
        appPackage: app_package,
        windowTitle: `BLOCKED: ${app_name}`,
        format: 'jpeg',
        fileSize: buffer.length,
        tags: ['blocked_app', 'alert']
      });
    }

    const alert = await Alert.create({
      employeeId: employee_id,
      type: Alert.schema.path('type').enumValues.includes(type) ? type : 'custom',
      severity: severity || 'high',
      title: title || `Unprofessional App: ${app_name}`,
      message: message || `Employee opened blocked app: ${app_name}`,
      data: {
        appPackage: app_package,
        appName: app_name,
        screenshotUrl,
        timestamp
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('alert:new', {
        _id: alert._id,
        employeeId: employee_id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        data: alert.data,
        createdAt: alert.createdAt
      });
      console.log('[Alert] WebSocket emitted to dashboard');
    }

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    console.error('[Alert] ERROR:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const { employee_id, type, severity, is_read, start_date, end_date, page = 1, limit = 50 } = req.query;
    const query = {};
    if (employee_id) query.employeeId = employee_id;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (is_read !== undefined) query.isRead = is_read === 'true';
    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) query.createdAt.$lte = new Date(end_date);
    }

    const total = await Alert.countDocuments(query);
    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      success: true,
      count: alerts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: alerts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const { employee_id } = req.query;
    const query = { isRead: false };
    if (employee_id) query.employeeId = employee_id;

    await Alert.updateMany(query, { isRead: true });
    res.json({ success: true, message: 'All alerts marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        isAcknowledged: true,
        acknowledgedBy: req.user?._id,
        acknowledgedAt: new Date()
      },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAlertStats = async (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.query;
    const match = {};
    if (employee_id) match.employeeId = employee_id;
    if (start_date || end_date) {
      match.createdAt = {};
      if (start_date) match.createdAt.$gte = new Date(start_date);
      if (end_date) match.createdAt.$lte = new Date(end_date);
    }

    const stats = await Alert.aggregate([
      { $match: match },
      {
        $group: {
          _id: { type: '$type', severity: '$severity' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalCount = await Alert.countDocuments(match);
    const unreadCount = await Alert.countDocuments({ ...match, isRead: false });

    res.json({
      success: true,
      data: {
        total: totalCount,
        unread: unreadCount,
        byTypeAndSeverity: stats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
