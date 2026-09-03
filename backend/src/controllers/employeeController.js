const Employee = require('../models/Employee');

exports.getEmployees = async (req, res) => {
  try {
    const { status, department, group, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (group) query.group = group;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    const employees = await Employee.find(query).sort({ name: 1 });
    const now = Date.now();
    for (const emp of employees) {
      if (!emp.name) emp.name = `Employee ${emp.employeeId}`;
      const isRecent = emp.lastSeen && (now - new Date(emp.lastSeen).getTime()) < 120000;
      if (emp.isOnline !== isRecent) {
        emp.isOnline = isRecent;
        await emp.save().catch(() => {});
      }
    }
    res.json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.registerEmployee = async (req, res) => {
  try {
    const { employee_id, name, email, department, group, device_info } = req.body;
    let employee = await Employee.findOne({ employeeId: employee_id });
    if (employee) {
      employee.lastSeen = new Date();
      if (device_info) employee.deviceInfo = device_info;
      await employee.save();
      return res.json({ success: true, data: employee });
    }
    employee = await Employee.create({
      employeeId: employee_id,
      name: name || `Employee ${employee_id}`,
      email,
      department,
      group,
      deviceInfo: device_info,
      createdBy: req.user?._id
    });
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      req.body,
      { new: true }
    );
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndDelete({ employeeId: req.params.id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEmployeeStatus = async (req, res) => {
  try {
    const { isOnline, lastSeen } = req.body;
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    if (isOnline !== undefined) employee.isOnline = isOnline;
    if (lastSeen) employee.lastSeen = lastSeen;
    await employee.save();
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDeviceConfig = async (req, res) => {
  try {
    const { device_id } = req.params;
    let employee = await Employee.findOne({ employeeId: device_id });
    if (!employee) {
      employee = await Employee.create({
        employeeId: device_id,
        name: `Employee ${device_id}`,
        deviceInfo: { autoRegistered: true, registeredAt: new Date() },
        status: 'active'
      });
    }
    employee.lastSeen = new Date();
    employee.isOnline = true;
    await employee.save();
    res.json({
      success: true,
      employee_id: employee.employeeId,
      name: employee.name,
      status: employee.status || 'active',
      settings: {
        screenshot_interval_ms: 30000,
        activity_check_interval_ms: 10000,
        enabled: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
