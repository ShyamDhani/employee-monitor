const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const activityValidation = [
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('timestamp').isNumeric().withMessage('Timestamp must be a number'),
  body('app_package').notEmpty().withMessage('App package is required')
];

const screenshotValidation = [
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('timestamp').isNumeric().withMessage('Timestamp must be a number'),
  body('image_base64').notEmpty().withMessage('Image data is required')
];

const employeeValidation = [
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('name').notEmpty().withMessage('Name is required')
];

module.exports = { validate, activityValidation, screenshotValidation, employeeValidation };
