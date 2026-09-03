const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');

router.post('/upload', audioController.uploadAudioMultipart);
router.post('/upload-json', audioController.uploadAudio);
router.get('/', audioController.getAudios);
router.get('/stats', audioController.getStats);
router.get('/:id', audioController.getAudioById);
router.get('/:id/stream', audioController.getAudioStream);
router.delete('/:id', audioController.deleteAudio);

module.exports = router;
