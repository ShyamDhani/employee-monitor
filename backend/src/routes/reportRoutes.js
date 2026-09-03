const express = require('express');
const router = express.Router();
const { getDailyReport, getWeeklyReport, getProductivityReport, getEmployeeStats } = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

router.get('/daily', auth, getDailyReport);
router.get('/weekly', auth, getWeeklyReport);
router.get('/productivity', auth, getProductivityReport);
router.get('/employee/:employee_id', auth, getEmployeeStats);

module.exports = router;
