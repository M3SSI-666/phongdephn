import { Routes, Route } from 'react-router-dom';
import { AuthGate } from './pages/AuthPage';
import RoomList from './pages/RoomList';
import RoomDetail from './pages/RoomDetail';
import AdminTool from './pages/AdminTool';
import TimesCity from './pages/TimesCity';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<RoomList />} />
      <Route path="/phong/:id" element={<RoomDetail />} />

      {/* Protected routes */}
      <Route path="/timescity" element={<AuthGate><TimesCity /></AuthGate>} />
      <Route path="/admin" element={<AuthGate><AdminTool /></AuthGate>} />
      <Route path="/admin-dashboard" element={<AuthGate><AdminDashboard /></AuthGate>} />
    </Routes>
  );
}
