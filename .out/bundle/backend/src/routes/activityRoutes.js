const express = require('express');
const router = express.Router();
const { uploadActivity, uploadActivityBatch, uploadUsageSummary, getActivities, getTimeline, getAppUsageSummary, getHourlyBreakdown } = require('../controllers/activityController');

router.post('/upload', uploadActivity);
router.post('/batch', uploadActivityBatch);
router.post('/usage-summary', uploadUsageSummary);
router.get('/', getActivities);
router.get('/timeline', getTimeline);
router.get('/summary', getAppUsageSummary);
router.get('/hourly', getHourlyBreakdown);

module.exports = router;
