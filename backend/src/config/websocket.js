const connectedEmployees = new Map();

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('register', (data) => {
      const { employeeId, platform } = data;
      if (employeeId) {
        connectedEmployees.set(employeeId, {
          socketId: socket.id,
          platform,
          connectedAt: new Date(),
          lastHeartbeat: new Date()
        });
        socket.join(`employee:${employeeId}`);
      }
      socket.join('dashboard');
      console.log(`Client registered: ${employeeId || 'dashboard'}`);
      if (employeeId) {
        io.to('dashboard').emit('employee:online', { employeeId, platform });
      }
    });

    socket.on('activity', (data) => {
      const { employeeId } = data;
      io.to('dashboard').emit('activity:realtime', data);
      if (connectedEmployees.has(employeeId)) {
        connectedEmployees.get(employeeId).lastHeartbeat = new Date();
      }
    });

    socket.on('screenshot', (data) => {
      const { employeeId } = data;
      io.to('dashboard').emit('screenshot:new', data);
    });

    socket.on('alert', (data) => {
      io.to('dashboard').emit('alert:new', data);
    });

    socket.on('heartbeat', (data) => {
      const { employeeId, timestamp } = data;
      if (connectedEmployees.has(employeeId)) {
        connectedEmployees.get(employeeId).lastHeartbeat = new Date(timestamp);
      }
      io.to('dashboard').emit('heartbeat:update', data);
    });

    socket.on('command', (data) => {
      const { employeeId, command } = data;
      io.to(`employee:${employeeId}`).emit('command', data);
      console.log(`Command sent to ${employeeId}: ${command}`);
    });

    socket.on('camera:capture', (data) => {
      const { employeeId } = data;
      io.to(`employee:${employeeId}`).emit('command', { employeeId, command: 'capture_camera', data });
      console.log(`Camera capture requested for ${employeeId}`);
    });

    socket.on('audio:record', (data) => {
      const { employeeId, duration = 10 } = data;
      io.to(`employee:${employeeId}`).emit('command', { employeeId, command: 'record_audio', data: { duration } });
      console.log(`Audio recording requested for ${employeeId}: ${duration}s`);
    });

    socket.on('screen:record', (data) => {
      const { employeeId, action = 'start', duration = 30 } = data;
      io.to(`employee:${employeeId}`).emit('command', { employeeId, command: `screen_record_${action}`, data: { duration } });
      console.log(`Screen record ${action} requested for ${employeeId}`);
    });

    socket.on('location:track', (data) => {
      const { employeeId } = data;
      io.to(`employee:${employeeId}`).emit('command', { employeeId, command: 'track_location', data });
    });

    socket.on('location:update', (data) => {
      io.to('dashboard').emit('location:update', data);
    });

    socket.on('disconnect', () => {
      for (const [employeeId, info] of connectedEmployees.entries()) {
        if (info.socketId === socket.id) {
          connectedEmployees.delete(employeeId);
          io.to('dashboard').emit('employee:offline', { employeeId });
          console.log(`Employee disconnected: ${employeeId}`);
          break;
        }
      }
    });
  });

  setInterval(() => {
    const now = new Date();
    const timeout = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '90') * 1000;
    for (const [employeeId, info] of connectedEmployees.entries()) {
      if (now - info.lastHeartbeat > timeout) {
        connectedEmployees.delete(employeeId);
        io.to('dashboard').emit('employee:offline', { employeeId });
        console.log(`Employee timed out: ${employeeId}`);
      }
    }
  }, 30000);
};

const getConnectedEmployees = () => {
  return Array.from(connectedEmployees.entries()).map(([id, info]) => ({
    employeeId: id,
    ...info
  }));
};

const isEmployeeConnected = (employeeId) => {
  return connectedEmployees.has(employeeId);
};

module.exports = { setupSocketHandlers, getConnectedEmployees, isEmployeeConnected };
