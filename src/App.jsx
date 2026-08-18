import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate } from './pages/AuthPage';
import TimesCity from './pages/TimesCity';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <Routes>
      {/* Times City là toàn bộ ứng dụng: vào tên miền gốc là vào thẳng, không qua trang trung gian.
          Hệ quả cố ý: cả site nằm sau AuthGate, người chưa đăng nhập thấy màn hình đăng nhập. */}
      <Route path="/" element={<AuthGate><TimesCity /></AuthGate>} />
      {/* Giữ /timescity cho link đã lưu/chia sẻ trước đây — gồm cả link kèm ?viewAs=
          mà AdminDashboard đang sinh ra. */}
      <Route path="/timescity" element={<AuthGate><TimesCity /></AuthGate>} />
      <Route path="/admin-dashboard" element={<AuthGate><AdminDashboard /></AuthGate>} />

      {/* Đường dẫn lạ (kể cả link phòng trọ cũ /phong/:id) về trang chủ, thay vì màn hình trắng. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
