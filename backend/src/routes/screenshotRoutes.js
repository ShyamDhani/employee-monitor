const express = require('express');
const router = express.Router();
const { uploadScreenshot, uploadScreenshotBatch, getScreenshots, getScreenshotsByApp, getScreenshot, addAnnotation, deleteScreenshot } = require('../controllers/screenshotController');
const { auth } = require('../middleware/auth');

router.post('/upload', uploadScreenshot);
router.post('/batch', uploadScreenshotBatch);
router.get('/', auth, getScreenshots);
router.get('/by-app', auth, getScreenshotsByApp);
router.get('/:id', auth, getScreenshot);
router.post('/:id/annotate', auth, addAnnotation);
router.delete('/:id', auth, deleteScreenshot);

module.exports = router;
