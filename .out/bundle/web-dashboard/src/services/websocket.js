import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return;
    if (this.socket) {
      this.socket.connect();
      return;
    }

    const wsUrl = window.location.origin;

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.socket.emit('register', { role: 'dashboard' });
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
    });

    this.socket.on('activity:realtime', (data) => {
      this.emit('activity', data);
    });

    this.socket.on('screenshot:new', (data) => {
      this.emit('screenshot', data);
    });

    this.socket.on('alert:new', (data) => {
      this.emit('alert', data);
    });

    this.socket.on('employee:online', (data) => {
      this.emit('employeeOnline', data);
    });

    this.socket.on('employee:offline', (data) => {
      this.emit('employeeOffline', data);
    });

    this.socket.on('heartbeat:update', (data) => {
      this.emit('heartbeat', data);
    });

    this.socket.on('command', (data) => {
      this.emit('command', data);
    });

    this.socket.on('location:update', (data) => {
      this.emit('locationUpdate', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  send(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  requestScreenshot(employeeId) {
    this.sendCommandToServer(employeeId, 'capture_screenshot');
  }

  sendCommand(employeeId, command, data = {}) {
    this.sendCommandToServer(employeeId, command, data);
  }

  async sendCommandToServer(employeeId, command, data = {}) {
    try {
      const res = await fetch(`/api/settings/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, command, data })
      });
      const result = await res.json();
      console.log('Command sent:', result);
    } catch (e) {
      console.error('Failed to send command:', e);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();
export default websocketService;
