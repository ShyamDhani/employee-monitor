const express = require('express');
const router = express.Router();
const controller = require('../controllers/callRecordingController');

router.post('/upload', controller.uploadRecording);
router.post('/list', controller.saveRecordingsList);
router.post('/status', controller.saveStatus);
router.get('/status/:employee_id', controller.getStatusLog);
router.get('/listings/:employee_id', controller.getRecordingsList);
router.get('/download/:employee_id/:filename', controller.downloadRecording);
router.delete('/:employee_id/:filename', controller.deleteRecording);

module.exports = router;
