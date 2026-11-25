const express = require('express');
const router = express.Router();
const {
  createAlert,
  getAlerts,
  getAlert,
  markAsRead,
  markAllAsRead,
  acknowledgeAlert,
  deleteAlert,
  getAlertStats
} = require('../controllers/alertController');
const { auth } = require('../middleware/auth');

router.post('/', createAlert);
router.get('/', auth, getAlerts);
router.get('/stats', auth, getAlertStats);
router.get('/:id', auth, getAlert);
router.put('/:id/read', auth, markAsRead);
router.put('/read-all', auth, markAllAsRead);
router.put('/:id/acknowledge', auth, acknowledgeAlert);
router.delete('/:id', auth, deleteAlert);

module.exports = router;
