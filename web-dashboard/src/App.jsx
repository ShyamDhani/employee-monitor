import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './pages/Login';
import DashboardLayout from './components/Dashboard/DashboardLayout';
import LiveMonitor from './pages/LiveMonitor';
import Timeline from './pages/Timeline';
import Screenshots from './pages/Screenshots';
import Analytics from './pages/Analytics';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Geofencing from './pages/Geofencing';
import AudioRecordings from './pages/AudioRecordings';
import Alerts from './pages/Alerts';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<LiveMonitor />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/screenshots" element={<Screenshots />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/geofencing" element={<Geofencing />} />
                <Route path="/audio" element={<AudioRecordings />} />
                <Route path="/alerts" element={<Alerts />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
