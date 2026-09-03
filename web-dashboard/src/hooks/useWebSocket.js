import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { websocketService } from '../services/websocket';
import { addActivity, addScreenshot, addAlert, addOnlineEmployee, removeOnlineEmployee } from '../store/dashboardSlice';

export const useWebSocket = () => {
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(websocketService.isConnected());

  useEffect(() => {
    websocketService.connect();

    const unsubConnected = websocketService.on('connected', () => setIsConnected(true));
    const unsubDisconnected = websocketService.on('disconnected', () => setIsConnected(false));
    const unsubActivity = websocketService.on('activity', (data) => dispatch(addActivity(data)));
    const unsubScreenshot = websocketService.on('screenshot', (data) => dispatch(addScreenshot(data)));
    const unsubAlert = websocketService.on('alert', (data) => dispatch(addAlert(data)));
    const unsubOnline = websocketService.on('employeeOnline', (data) => dispatch(addOnlineEmployee(data)));
    const unsubOffline = websocketService.on('employeeOffline', (data) => dispatch(removeOnlineEmployee(data)));

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubActivity();
      unsubScreenshot();
      unsubAlert();
      unsubOnline();
      unsubOffline();
    };
  }, [dispatch]);

  const requestScreenshot = useCallback((employeeId) => {
    websocketService.requestScreenshot(employeeId);
  }, []);

  const sendCommand = useCallback((employeeId, command, data = {}) => {
    websocketService.sendCommand(employeeId, command, data);
  }, []);

  return { isConnected, requestScreenshot, sendCommand };
};

export default useWebSocket;
