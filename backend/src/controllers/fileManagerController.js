const path = require('path');
const fs = require('fs');

const listingsDir = path.join(__dirname, '../../uploads/filemanager');
const filesDir = path.join(__dirname, '../../uploads/filefiles');
if (!fs.existsSync(listingsDir)) fs.mkdirSync(listingsDir, { recursive: true });
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

exports.saveDirectoryListing = async (req, res) => {
  try {
    const { employee_id, path: dirPath, files, storage, timestamp } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id required' });
    }

    const empDir = path.join(listingsDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const safePath = (dirPath || '/').replace(/[^a-zA-Z0-9_\/\-\.]/g, '_');
    const fileName = `listing_${Date.now()}.json`;
    const filePath = path.join(empDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify({
      employee_id,
      path: dirPath,
      storage,
      files,
      timestamp: timestamp || Date.now(),
      saved_at: new Date().toISOString()
    }, null, 2));

    const latestPath = path.join(empDir, 'latest_listing.json');
    fs.writeFileSync(latestPath, JSON.stringify({
      employee_id,
      path: dirPath,
      storage,
      files,
      timestamp: timestamp || Date.now(),
      saved_at: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, message: 'Directory listing saved' });
  } catch (error) {
    console.error('Save directory listing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveFileContent = async (req, res) => {
  try {
    const { employee_id, file_path, file_name, file_size, file_base64, mime_type, timestamp } = req.body;
    if (!employee_id || !file_base64) {
      return res.status(400).json({ success: false, message: 'employee_id and file_base64 required' });
    }

    const empDir = path.join(filesDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const safeName = (file_name || 'unknown').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    const filePath = path.join(empDir, fileName);

    const buffer = Buffer.from(file_base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    const metaPath = path.join(empDir, `${fileName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      employee_id,
      original_path: file_path,
      file_name: file_name,
      saved_as: fileName,
      file_size,
      mime_type,
      timestamp: timestamp || Date.now(),
      saved_at: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, message: 'File saved', saved_as: fileName });
  } catch (error) {
    console.error('Save file content error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveSearchResults = async (req, res) => {
  try {
    const { employee_id, query, root_path, results, timestamp } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id required' });
    }

    const empDir = path.join(listingsDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const fileName = `search_${Date.now()}.json`;
    const filePath = path.join(empDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify({
      employee_id,
      query,
      root_path,
      results,
      timestamp: timestamp || Date.now(),
      saved_at: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, message: 'Search results saved' });
  } catch (error) {
    console.error('Save search results error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveInstalledApps = async (req, res) => {
  try {
    const { employee_id, total_apps, apps, timestamp } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id required' });
    }

    const empDir = path.join(listingsDir, employee_id);
    if (!fs.existsSync(empDir)) fs.mkdirSync(empDir, { recursive: true });

    const filePath = path.join(empDir, 'installed_apps.json');
    fs.writeFileSync(filePath, JSON.stringify({
      employee_id,
      total_apps,
      apps,
      timestamp: timestamp || Date.now(),
      saved_at: new Date().toISOString()
    }, null, 2));

    res.json({ success: true, message: 'App list saved' });
  } catch (error) {
    console.error('Save apps error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.browseEmployee = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const empDir = path.join(listingsDir, employee_id);
    const latestPath = path.join(empDir, 'latest_listing.json');

    if (!fs.existsSync(latestPath)) {
      return res.status(404).json({ success: false, message: 'No listings found for this employee' });
    }

    const data = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFile = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const requestedFile = req.params[0];
    const empDir = path.join(filesDir, employee_id);
    const filePath = path.join(empDir, path.basename(requestedFile));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const metaPath = `${filePath}.meta.json`;
    let meta = {};
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    res.json({
      success: true,
      data: {
        ...meta,
        file_base64: base64
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getListings = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const empDir = path.join(listingsDir, employee_id);

    if (!fs.existsSync(empDir)) {
      return res.json({ success: true, listings: [] });
    }

    const files = fs.readdirSync(empDir)
      .filter(f => f.startsWith('listing_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 50);

    const listings = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(empDir, f), 'utf8'));
      return { file: f, ...data };
    });

    res.json({ success: true, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFiles = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const empDir = path.join(filesDir, employee_id);

    if (!fs.existsSync(empDir)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(empDir)
      .filter(f => !f.endsWith('.meta.json'))
      .map(f => {
        const metaPath = path.join(empDir, `${f}.meta.json`);
        let meta = {};
        if (fs.existsSync(metaPath)) {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        return { saved_name: f, ...meta };
      })
      .sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''));

    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInstalledApps = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const empDir = path.join(listingsDir, employee_id);
    const appsPath = path.join(empDir, 'installed_apps.json');

    if (!fs.existsSync(appsPath)) {
      return res.json({ success: true, data: null, message: 'No app list yet. Command may still be processing.' });
    }

    const data = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
