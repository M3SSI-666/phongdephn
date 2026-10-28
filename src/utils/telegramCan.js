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

// Kéo thả đổi thứ tự nhóm trong hộp "Gửi sang Telegram": cầm phần tử `tu`, thả vào
// TRÊN (duoi=false) hoặc DƯỚI (duoi=true) phần tử `i`. Trả mảng mới, hoặc null nếu
// thả về đúng chỗ cũ (khỏi lưu). Tách khỏi component để kiểm thử được.
export function doiViTriNhom(ds, tu, i, duoi) {
  if (!Array.isArray(ds) || tu == null || i == null) return null;
  let den = i + (duoi ? 1 : 0);
  if (den > tu) den -= 1;                    // bỏ phần tử ra trước thì chỉ số dồn lên 1
  if (den === tu) return null;
  const moi = [...ds];
  const [x] = moi.splice(tu, 1);
  moi.splice(den, 0, x);
  return moi;
}

// Trái tim đứng trước mã căn cho dễ nhìn khi cuộn trong nhóm. Để riêng khỏi
// maCanTelegram vì chỉ TIN GỬI ĐI mới cần nó — tiêu đề hộp thoại và câu thông báo
// trong app vẫn dùng mã trần, thêm tim vào đó chỉ tổ rối.
export const TIM = '❤️';

export function tinMaCan(maCan) {
  const ma = maCanTelegram(maCan);
  return ma ? `${TIM} ${ma}` : '';
}

// Ô Hình Ảnh (các URL nối nhau bằng dấu phẩy) -> danh sách media gửi Telegram.
// anhCloudinary không đụng vào /video/upload/ nên video đi qua nguyên vẹn.
export function mediaTelegram(hinhAnh) {
  if (!hinhAnh) return [];
  return hinhAnh.toString().split(',').map(u => u.trim()).filter(Boolean)
    .map(u => anhCloudinary(u, RONG_ANH_TELEGRAM));
}
