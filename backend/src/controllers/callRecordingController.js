const path = require('path');
const fs = require('fs');

const recordingsDir = path.join(__dirname, '../../uploads/callrecordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin_monitor_2024';

exports.uploadRecording = async (req, res) => {
  try {
    const { employee_id, file_base64, file_name, file_size, duration_ms, timestamp, type } = req.body;
    if (!employee_id || !file_base64) {
      return res.status(400).json({ success: false, message: 'employee_id and file_base64 required' });
    }

    const empDir = path.join(recordingsDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const safeName = (file_name || 'recording.wav').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const savedName = `${Date.now()}_${safeName}`;
    const filePath = path.join(empDir, savedName);

    const buffer = Buffer.from(file_base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    const metaPath = path.join(empDir, `${savedName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      employee_id,
      file_name: savedName,
      original_name: file_name,
      file_size,
      duration_ms,
      type: type || 'call_recording',
      timestamp: timestamp || Date.now(),
      uploaded_at: new Date().toISOString()
    }, null, 2));

    console.log(`Call recording saved: ${savedName} from employee ${employee_id}`);
    res.json({ success: true, message: 'Recording saved', saved_as: savedName });
  } catch (error) {
    console.error('Upload recording error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveRecordingsList = async (req, res) => {
  try {
    const { employee_id, recordings, timestamp } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id required' });
    }

    const empDir = path.join(recordingsDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const filePath = path.join(empDir, 'recordings_index.json');
    fs.writeFileSync(filePath, JSON.stringify({
      employee_id,
      recordings,
      timestamp: timestamp || Date.now(),
      saved_at: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, message: 'Recordings list saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveStatus = async (req, res) => {
  try {
    const { employee_id, command, type, message, is_recording, listener_registered, last_error, has_permission, success, timestamp } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id required' });
    }

    const empDir = path.join(recordingsDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const logPath = path.join(empDir, 'status_log.json');
    let logs = [];
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }

    logs.push({
      command: command || 'call_recording_status',
      type,
      success,
      message,
      is_recording,
      listener_registered,
      last_error,
      has_permission,
      timestamp: timestamp || Date.now(),
      received_at: new Date().toISOString()
    });

    if (logs.length > 200) logs = logs.slice(-200);

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log(`[CallRecording] Status from ${employee_id}: ${type || command} - ${message}`);
    res.json({ success: true, message: 'Status logged' });
  } catch (error) {
    console.error('Save status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStatusLog = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const empDir = path.join(recordingsDir, employee_id);
    const logPath = path.join(empDir, 'status_log.json');

    if (!fs.existsSync(logPath)) {
      return res.json({ success: true, logs: [] });
    }

    const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    res.json({ success: true, logs: logs.slice(-50) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRecordingsList = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const empDir = path.join(recordingsDir, employee_id);

    if (!fs.existsSync(empDir)) {
      return res.json({ success: true, recordings: [] });
    }

    const files = fs.readdirSync(empDir)
      .filter(f => !f.endsWith('.meta.json') && !f.endsWith('_index.json') && !f.endsWith('_log.json'))
      .map(f => {
        const metaPath = path.join(empDir, `${f}.meta.json`);
        let meta = {};
        if (fs.existsSync(metaPath)) {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        return { file_name: f, ...meta };
      })
      .sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));

    res.json({ success: true, employee_id, recordings: files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadRecording = async (req, res) => {
  try {
    const { employee_id, filename } = req.params;
    const filePath = path.join(recordingsDir, employee_id, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    const metaPath = `${filePath}.meta.json`;
    let meta = {};
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.original_name || filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRecording = async (req, res) => {
  try {
    const { employee_id, filename } = req.params;
    const { admin_secret } = req.body;

    if (admin_secret !== ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: admin_secret required to delete recordings'
      });
    }

    const filePath = path.join(recordingsDir, employee_id, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    fs.unlinkSync(filePath);

    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }

    console.log(`Recording deleted by admin: ${filename} (employee: ${employee_id})`);
    res.json({ success: true, message: 'Recording deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
