const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');
  await c.connect();
  const db = c.db('employee_monitor');
  const emps = await db.collection('employees').find({}).project({ employeeId: 1, name: 1, _id: 0 }).toArray();
  console.log('EMPLOYEES:', JSON.stringify(emps));
  const acts = await db.collection('activities')
    .aggregate([{ $group: { _id: '$employeeId', count: { $sum: 1 }, last: { $max: '$timestamp' } } }]).toArray();
  console.log('ACTIVITY BY EMPLOYEE:', JSON.stringify(acts));
  const today = new Date(); today.setHours(0,0,0,0);
  const next = new Date(today); next.setDate(next.getDate() + 1);
  const todays = await db.collection('activities')
    .aggregate([{ $match: { timestamp: { $gte: today, $lt: next } } }, { $group: { _id: '$employeeId', count: { $sum: 1 } } }]).toArray();
  console.log('TODAYS ACTIVITY:', JSON.stringify(todays));
  await c.close();
})();
