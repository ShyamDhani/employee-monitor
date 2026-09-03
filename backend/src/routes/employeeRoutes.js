const express = require('express');
const router = express.Router();
const { getEmployees, getEmployee, registerEmployee, updateEmployee, deleteEmployee, updateEmployeeStatus, getDeviceConfig } = require('../controllers/employeeController');
const { auth } = require('../middleware/auth');

router.get('/device/:device_id/config', getDeviceConfig);
router.get('/', auth, getEmployees);
router.get('/:id', auth, getEmployee);
router.post('/register', registerEmployee);
router.put('/:id', auth, updateEmployee);
router.delete('/:id', auth, deleteEmployee);
router.put('/:id/status', auth, updateEmployeeStatus);

module.exports = router;
