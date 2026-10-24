// Đuôi .js bắt buộc: Vite tự đoán được, nhưng node --test (ESM thuần) thì không.
import { anhCloudinary } from './anhCloudinary.js';

// Bề ngang ảnh gửi sang Telegram. Gửi thẳng ảnh gốc Cloudinary (3-8MB) thì vừa đốt
// băng thông Cloudinary, vừa dễ bị Telegram từ chối vì quá nặng. 1600px là thừa nét
// để xem trên điện thoại.
export const RONG_ANH_TELEGRAM = 1600;

// Mã căn gửi vào nhóm: ghi một mạch, không gạch nối — "T081903", đúng như trong sheet.
// Bản trước chèn gạch thành "T08-1903"; bỏ đi để mã trên Telegram trùng khít mã trong
// app, tìm kiếm bằng mã nào cũng ra.
export function maCanTelegram(maCan) {
  return (maCan || '').toString().toUpperCase().trim();
}

// Ô Hình Ảnh (các URL nối nhau bằng dấu phẩy) -> danh sách media gửi Telegram.
// anhCloudinary không đụng vào /video/upload/ nên video đi qua nguyên vẹn.
export function mediaTelegram(hinhAnh) {
  if (!hinhAnh) return [];
  return hinhAnh.toString().split(',').map(u => u.trim()).filter(Boolean)
    .map(u => anhCloudinary(u, RONG_ANH_TELEGRAM));
}
