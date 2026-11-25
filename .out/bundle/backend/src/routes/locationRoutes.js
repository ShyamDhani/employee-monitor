const express = require('express');
const router = express.Router();
const { uploadLocation, getLocations, getLatestLocations, getLocationHistory, checkGeofence } = require('../controllers/locationController');

router.post('/upload', uploadLocation);
router.get('/', getLocations);
router.get('/latest', getLatestLocations);
router.get('/history', getLocationHistory);
router.post('/geofence/check', checkGeofence);

module.exports = router;
