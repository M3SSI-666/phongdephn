import { useEffect, useRef } from 'react';
import { CHU_KY_LAM_MOI } from './lamMoi.js';

/**
 * Chạy `lamMoi` mỗi `ms` (mặc định 30 giây) để bảng tự cập nhật khi người khác sửa sheet.
 *
 * Khác vòng setInterval trần các trang dùng trước đây:
 *  - TẠM DỪNG khi tab trình duyệt bị ẩn / điện thoại tắt màn hình: không ai nhìn thì
 *    không tải lại cả sheet, đỡ pin, đỡ mạng, đỡ quota Google Sheets.
 *  - Quay lại tab mà đã quá một chu kỳ thì làm mới NGAY, không bắt chờ thêm 30 giây.
 *  - Luôn gọi bản `lamMoi` MỚI NHẤT (qua ref) — không dính giá trị cũ của lần render
 *    đầu. Bản trước của Quỹ Homestay / Shophouse để deps [] nên vòng poll giữ mãi
 *    userId/role ban đầu và bỏ quên isViewAs.
 *
 * Chống vẽ lại khi dữ liệu không đổi là việc của chỗ gọi: setItems(cu => giuNeuKhongDoi(cu, moi)).
 */
export function useLamMoiDinhKy(lamMoi, ms = CHU_KY_LAM_MOI) {
  const ref = useRef(lamMoi);
  ref.current = lamMoi;

  useEffect(() => {
    let lanCuoi = Date.now();
    const chay = () => {
      lanCuoi = Date.now();
      try { ref.current(); } catch { /* lỗi một lượt thì thôi, lượt sau thử lại */ }
    };
    const iv = setInterval(() => { if (!document.hidden) chay(); }, ms);
    const khiHienLai = () => {
      if (!document.hidden && Date.now() - lanCuoi >= ms) chay();
    };
    document.addEventListener('visibilitychange', khiHienLai);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', khiHienLai);
    };
  }, [ms]);
}
