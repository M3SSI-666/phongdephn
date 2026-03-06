import { Routes, Route } from 'react-router-dom';
import RoomList from './pages/RoomList';
import RoomDetail from './pages/RoomDetail';
import AdminTool from './pages/AdminTool';
import TimesCity from './pages/TimesCity';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoomList />} />
      <Route path="/phong/:id" element={<RoomDetail />} />
      <Route path="/admin" element={<AdminTool />} />
      <Route path="/timescity" element={<TimesCity />} />
    </Routes>
  );
}
