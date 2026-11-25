const express = require('express');
const router = express.Router();
const { getAllSettings, getSetting, updateSetting, updateMultipleSettings, getDeviceConfig, pollCommands, sendCommand } = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');

router.get('/device-config', getDeviceConfig);
router.get('/commands/:employee_id', pollCommands);
router.post('/commands', sendCommand);
router.get('/', auth, getAllSettings);
router.get('/:key', auth, getSetting);
router.put('/:key', auth, updateSetting);
router.put('/', auth, updateMultipleSettings);

module.exports = router;
