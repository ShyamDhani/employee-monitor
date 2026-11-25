const Location = require('../models/Location');
const Employee = require('../models/Employee');

exports.uploadLocation = async (req, res) => {
  try {
    const { employee_id, timestamp, latitude, longitude, accuracy, altitude, speed, bearing, address } = req.body;
    const location = await Location.create({
      employeeId: employee_id,
      timestamp: new Date(timestamp),
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      bearing,
      address
    });
    await Employee.findOneAndUpdate(
      { employeeId: employee_id },
      { lastSeen: new Date(), isOnline: true }
    );
    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('location:update', {
        employeeId: employee_id,
        latitude,
        longitude,
        accuracy,
        speed,
        timestamp: location.timestamp
      });
    }
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLocations = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, page = 1, limit = 100 } = req.query;
    const query = {};
    if (employee_id) query.employeeId = employee_id;
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }
    const total = await Location.countDocuments(query);
    const locations = await Location.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, count: locations.length, total, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLatestLocations = async (req, res) => {
  try {
    const pipeline = [
      { $sort: { employeeId: 1, timestamp: -1 } },
      {
        $group: {
          _id: '$employeeId',
          latitude: { $first: '$latitude' },
          longitude: { $first: '$longitude' },
          accuracy: { $first: '$accuracy' },
          speed: { $first: '$speed' },
          address: { $first: '$address' },
          timestamp: { $first: '$timestamp' }
        }
      },
      {
        $project: {
          _id: 0,
          employeeId: '$_id',
          latitude: 1,
          longitude: 1,
          accuracy: 1,
          speed: 1,
          address: 1,
          timestamp: 1
        }
      }
    ];
    const locations = await Location.aggregate(pipeline);
    res.json({ success: true, count: locations.length, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLocationHistory = async (req, res) => {
  try {
    const { employee_id, hours = 24 } = req.query;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const query = { timestamp: { $gte: since } };
    if (employee_id) query.employeeId = employee_id;
    const locations = await Location.find(query).sort({ timestamp: 1 });
    res.json({ success: true, count: locations.length, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkGeofence = async (req, res) => {
  try {
    const { employee_id, fence_lat, fence_lng, fence_radius_km = 1 } = req.body;
    const latest = await Location.findOne({ employeeId: employee_id }).sort({ timestamp: -1 });
    if (!latest) {
      return res.json({ success: true, inside: false, message: 'No location data found' });
    }
    const R = 6371;
    const dLat = (fence_lat - latest.latitude) * Math.PI / 180;
    const dLon = (fence_lng - latest.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(latest.latitude * Math.PI / 180) * Math.cos(fence_lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const inside = distance <= fence_radius_km;
    res.json({
      success: true,
      employee_id,
      inside,
      distance_km: Math.round(distance * 100) / 100,
      fence_radius_km,
      location: { latitude: latest.latitude, longitude: latest.longitude },
      timestamp: latest.timestamp
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
