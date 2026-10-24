// Đuôi .js bắt buộc: Vite tự đoán được, nhưng node --test (ESM thuần) thì không.
import { anhCloudinary } from './anhCloudinary.js';

// Bề ngang ảnh gửi sang Telegram. Gửi thẳng ảnh gốc Cloudinary (3-8MB) thì vừa đốt
// băng thông Cloudinary, vừa dễ bị Telegram từ chối vì quá nặng. 1600px là thừa nét
// để xem trên điện thoại.
export const RONG_ANH_TELEGRAM = 1600;

// "T081903" -> "T08-1903". Đúng kiểu mã căn vẫn gõ tay vào nhóm từ trước tới giờ, để
// tìm trong Telegram vẫn ra cả tin cũ lẫn tin mới.
// Mã không khớp dạng (tòa + số) thì GIỮ NGUYÊN, không chèn gạch bừa.
export function maCanTelegram(maCan) {
  const s = (maCan || '').toString().toUpperCase().trim();
  const m = s.match(/^([A-Z]+\d{2})(.+)$/);
  return m ? `${m[1]}-${m[2]}` : s;
}

// Ô Hình Ảnh (các URL nối nhau bằng dấu phẩy) -> danh sách media gửi Telegram.
// anhCloudinary không đụng vào /video/upload/ nên video đi qua nguyên vẹn.
export function mediaTelegram(hinhAnh) {
  if (!hinhAnh) return [];
  return hinhAnh.toString().split(',').map(u => u.trim()).filter(Boolean)
    .map(u => anhCloudinary(u, RONG_ANH_TELEGRAM));
}
