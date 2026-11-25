const Screenshot = require('../models/Screenshot');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.uploadScreenshot = async (req, res) => {
  try {
    const { employee_id, timestamp, image_base64, app_package, window_title, width, height, format } = req.body;

    console.log(`[Screenshot] Upload request from employee: ${employee_id}, app: ${app_package}, timestamp: ${timestamp}`);

    if (!image_base64) {
      console.error('[Screenshot] ERROR: No image_base64 in request body');
      return res.status(400).json({ success: false, message: 'image_base64 is required' });
    }

    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`[Screenshot] Base64 decoded: ${buffer.length} bytes`);

    const filename = `${employee_id}_${timestamp}_${uuidv4()}.${format || 'jpeg'}`;
    const filepath = path.join(__dirname, '../../uploads/screenshots', filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`[Screenshot] File written: ${filepath}`);

    const screenshot = await Screenshot.create({
      employeeId: employee_id,
      timestamp: new Date(timestamp),
      imageUrl: `/uploads/screenshots/${filename}`,
      appPackage: app_package,
      windowTitle: window_title,
      width,
      height,
      format: format || 'jpeg',
      fileSize: buffer.length
    });
    console.log(`[Screenshot] MongoDB saved: ${screenshot._id}`);

    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('screenshot:new', {
        employeeId: employee_id,
        imageUrl: `/uploads/screenshots/${filename}`,
        appPackage: app_package,
        timestamp: screenshot.timestamp
      });
      console.log('[Screenshot] WebSocket emitted to dashboard');
    } else {
      console.warn('[Screenshot] WARNING: Socket.IO not available, skipping WebSocket emit');
    }

    res.status(201).json({ success: true, data: screenshot });
  } catch (error) {
    console.error('[Screenshot] ERROR:', error.message);
    console.error('[Screenshot] Stack:', error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadScreenshotBatch = async (req, res) => {
  try {
    const { employee_id, data } = req.body;
    console.log(`[Screenshot] Batch upload request from employee: ${employee_id}, count: ${data?.length || 0}`);
    const screenshots = [];
    for (const item of data) {
      const base64Data = item.image_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${employee_id}_${item.timestamp}_${uuidv4()}.${item.format || 'jpeg'}`;
      const filepath = path.join(__dirname, '../../uploads/screenshots', filename);
      fs.writeFileSync(filepath, buffer);
      screenshots.push({
        employeeId: employee_id,
        timestamp: new Date(item.timestamp),
        imageUrl: `/uploads/screenshots/${filename}`,
        appPackage: item.app_package,
        windowTitle: item.window_title,
        width: item.width,
        height: item.height,
        format: item.format || 'jpeg',
        fileSize: buffer.length
      });
    }
    await Screenshot.insertMany(screenshots);
    console.log(`[Screenshot] Batch saved: ${screenshots.length} screenshots`);
    res.status(201).json({ success: true, count: screenshots.length });
  } catch (error) {
    console.error('[Screenshot] Batch ERROR:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getScreenshots = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, app_package, page = 1, limit = 50 } = req.query;
    const query = {};
    if (employee_id) query.employeeId = employee_id;
    if (app_package) query.appPackage = app_package;
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }
    const total = await Screenshot.countDocuments(query);
    const screenshots = await Screenshot.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');
    res.json({ success: true, count: screenshots.length, total, page: parseInt(page), pages: Math.ceil(total / limit), data: screenshots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getScreenshot = async (req, res) => {
  try {
    const screenshot = await Screenshot.findById(req.params.id);
    if (!screenshot) {
      return res.status(404).json({ success: false, message: 'Screenshot not found' });
    }
    res.json({ success: true, data: screenshot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addAnnotation = async (req, res) => {
  try {
    const { type, x, y, width, height, text, color } = req.body;
    const screenshot = await Screenshot.findById(req.params.id);
    if (!screenshot) {
      return res.status(404).json({ success: false, message: 'Screenshot not found' });
    }
    screenshot.annotations.push({
      type, x, y, width, height, text, color,
      createdBy: req.user._id
    });
    screenshot.isAnnotated = true;
    await screenshot.save();
    res.json({ success: true, data: screenshot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getScreenshotsByApp = async (req, res) => {
  try {
    const { employee_id, start_date, end_date } = req.query;
    const match = {};
    if (employee_id) match.employeeId = employee_id;
    if (start_date || end_date) {
      match.timestamp = {};
      if (start_date) match.timestamp.$gte = new Date(start_date);
      if (end_date) match.timestamp.$lte = new Date(end_date);
    }
    const apps = await Screenshot.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$appPackage',
          count: { $sum: 1 },
          latestScreenshot: { $max: '$imageUrl' },
          lastUsed: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          appPackage: '$_id',
          count: 1,
          latestScreenshot: 1,
          lastUsed: 1
        }
      }
    ]);
    res.json({ success: true, data: apps });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteScreenshot = async (req, res) => {
  try {
    const screenshot = await Screenshot.findById(req.params.id);
    if (!screenshot) {
      return res.status(404).json({ success: false, message: 'Screenshot not found' });
    }
    const filepath = path.join(__dirname, '../..', screenshot.imageUrl);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    await Screenshot.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Screenshot deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
