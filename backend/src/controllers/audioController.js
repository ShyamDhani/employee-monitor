const Audio = require('../models/Audio');
const Employee = require('../models/Employee');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads/audio');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

exports.uploadAudioMultipart = [
  upload.single('audio'),
  async (req, res) => {
    try {
      const employee_id = req.body.employee_id;
      const timestamp = req.body.timestamp;
      const sample_rate = parseInt(req.body.sample_rate) || 16000;
      const duration_ms = parseInt(req.body.duration_ms) || 0;

      if (!employee_id) {
        return res.status(400).json({ success: false, message: 'employee_id required' });
      }

      let audioBase64 = '';
      let fileSize = 0;

      if (req.file) {
        const fileBuffer = fs.readFileSync(req.file.path);
        audioBase64 = fileBuffer.toString('base64');
        fileSize = fileBuffer.size;
        fs.unlinkSync(req.file.path);
        console.log(`[Audio] Multipart upload from ${employee_id}: ${(fileSize / 1024).toFixed(1)}KB`);
      } else {
        return res.status(400).json({ success: false, message: 'No audio file provided' });
      }

      const audio = await Audio.create({
        employeeId: employee_id,
        timestamp: new Date(parseInt(timestamp) || Date.now()),
        audioBase64,
        sampleRate: sample_rate,
        durationMs: duration_ms,
        fileSize
      });

      console.log(`[Audio] Stored: ${audio._id}`);

      await Employee.findOneAndUpdate(
        { employeeId: employee_id },
        { $set: { lastSeen: new Date(), isOnline: true } },
        { upsert: false }
      );

      const io = req.app.get('io');
      if (io) {
        io.to('dashboard').emit('audio:new', {
          employeeId: employee_id,
          timestamp: audio.timestamp,
          durationMs: audio.durationMs,
          _id: audio._id
        });
      }

      res.status(201).json({ success: true, data: { _id: audio._id, timestamp: audio.timestamp } });
    } catch (error) {
      console.error('[Audio] Multipart upload error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
];

exports.uploadAudio = async (req, res) => {
  try {
    const { employee_id, timestamp, audio_base64, sample_rate, duration_ms } = req.body;

    if (!employee_id || !audio_base64) {
      console.error('[Audio] Missing fields:', { employee_id: !!employee_id, audio_base64: !!audio_base64 });
      return res.status(400).json({ success: false, message: 'employee_id and audio_base64 required' });
    }

    const audioSize = Math.ceil((audio_base64.length * 3) / 4);
    console.log(`[Audio] Receiving JSON from ${employee_id}: ${(audioSize / 1024).toFixed(1)}KB, ${duration_ms || 0}ms`);

    const audio = await Audio.create({
      employeeId: employee_id,
      timestamp: new Date(timestamp || Date.now()),
      audioBase64: audio_base64,
      sampleRate: sample_rate || 16000,
      durationMs: duration_ms || 0,
      fileSize: audioSize
    });

    console.log(`[Audio] Stored: ${audio._id}`);

    await Employee.findOneAndUpdate(
      { employeeId: employee_id },
      { $set: { lastSeen: new Date(), isOnline: true } },
      { upsert: false }
    );

    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('audio:new', {
        employeeId: employee_id,
        timestamp: audio.timestamp,
        durationMs: audio.durationMs,
        _id: audio._id
      });
    }

    res.status(201).json({ success: true, data: { _id: audio._id, timestamp: audio.timestamp } });
  } catch (error) {
    console.error('[Audio] Upload error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAudios = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, page = 1, limit = 50 } = req.query;
    const query = {};
    if (employee_id) query.employeeId = employee_id;
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }

    const total = await Audio.countDocuments(query);
    const audios = await Audio.find(query)
      .select('employeeId timestamp sampleRate durationMs fileSize fileName createdAt')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    console.log(`[Audio] List: ${audios.length} recordings (total: ${total})`);
    res.json({ success: true, count: audios.length, total, page: parseInt(page), pages: Math.ceil(total / limit), data: audios });
  } catch (error) {
    console.error('[Audio] List error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAudioById = async (req, res) => {
  try {
    const audio = await Audio.findById(req.params.id);
    if (!audio) {
      return res.status(404).json({ success: false, message: 'Audio not found' });
    }
    res.json({ success: true, data: audio });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAudioStream = async (req, res) => {
  try {
    const audio = await Audio.findById(req.params.id).select('audioBase64 sampleRate');
    if (!audio) {
      return res.status(404).json({ success: false, message: 'Audio not found' });
    }
    const buffer = Buffer.from(audio.audioBase64, 'base64');
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': buffer.length,
      'Accept-Ranges': 'bytes'
    });
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAudio = async (req, res) => {
  try {
    const audio = await Audio.findByIdAndDelete(req.params.id);
    if (!audio) {
      return res.status(404).json({ success: false, message: 'Audio not found' });
    }
    res.json({ success: true, message: 'Audio deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { employee_id } = req.query;
    const matchQuery = {};
    if (employee_id) matchQuery.employeeId = employee_id;

    const stats = await Audio.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$employeeId',
          totalRecordings: { $sum: 1 },
          totalDurationMs: { $sum: '$durationMs' },
          totalSizeBytes: { $sum: '$fileSize' },
          lastRecording: { $max: '$timestamp' }
        }
      },
      { $sort: { lastRecording: -1 } }
    ]);

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
