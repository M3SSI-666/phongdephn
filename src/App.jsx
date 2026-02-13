import { Routes, Route } from 'react-router-dom';
import RoomList from './pages/RoomList';
import RoomDetail from './pages/RoomDetail';
import AdminTool from './pages/AdminTool';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoomList />} />
      <Route path="/phong/:id" element={<RoomDetail />} />
      <Route path="/admin" element={<AdminTool />} />
    </Routes>
  );
}
