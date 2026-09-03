const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/employee_monitor').then(async () => {
  const Location = mongoose.model('Location', new mongoose.Schema({}, { strict: false }));
  const count = await Location.countDocuments();
  console.log('Total location entries:', count);
  if (count > 0) {
    const latest = await Location.find().sort({ timestamp: -1 }).limit(5);
    console.log('Latest 5:');
    latest.forEach(l => console.log('  emp=' + l.employeeId + ' lat=' + l.latitude + ' lng=' + l.longitude + ' ts=' + l.timestamp));
  }
  mongoose.disconnect();
});
