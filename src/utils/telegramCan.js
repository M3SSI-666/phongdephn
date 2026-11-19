// Đuôi .js bắt buộc: Vite tự đoán được, nhưng node --test (ESM thuần) thì không.
import { anhCloudinary } from './anhCloudinary.js';
// Giữ tên cũ cho chỗ gọi: phép đổi vị trí giờ dùng chung với thẻ bảng con.
export { doiViTri as doiViTriNhom } from './doiViTri.js';

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


// Trái tim đứng trước mã căn cho dễ nhìn khi cuộn trong nhóm. Để riêng khỏi
// maCanTelegram vì chỉ TIN GỬI ĐI mới cần nó — tiêu đề hộp thoại và câu thông báo
// trong app vẫn dùng mã trần, thêm tim vào đó chỉ tổ rối.
export const TIM = '❤️';

// SĐT Việt Nam luôn có số 0 đầu, nhưng ô SĐT trong Google Sheet hay bị hiểu là SỐ
// nên mất số 0: "0937738788" thành "937738788". Bù lại: dãy đúng 9 chữ số bắt đầu
// bằng 3/5/7/8/9 (đầu số di động) → thêm "0". Dạng quốc tế "+84…" / "84…" → "0…".
// Không dùng lookbehind (?<!…) trong regex: Safari iOS cũ không hỗ trợ, cả module
// hỏng theo. Ô có nhiều số (xuống dòng, cách nhau) thì sửa từng số một.
export function themSo0(sdt) {
  return (sdt ?? '').toString()
    .replace(/(^|[^\d+])\+?84([35789]\d{8})(?!\d)/g, (_, a, b) => `${a}0${b}`)
    .replace(/(^|\D)([35789]\d{8})(?!\d)/g, (_, a, b) => `${a}0${b}`);
}

// "❤️ P110312A - 0971 524 525 - A Hoan". Mã căn LUÔN đứng đầu để tìm trong Telegram
// vẫn khớp; phần nào trống thì bỏ hẳn, không để lại dấu gạch mồ côi.
export function tinMaCan(maCan, sdt, tenChu) {
  const ma = maCanTelegram(maCan);
  if (!ma) return '';
  // Ô SĐT hay chứa nhiều số xuống dòng — gộp lại một dòng, không thì tin vỡ bố cục.
  const phan = [themSo0(sdt), tenChu]
    .map(v => (v || '').toString().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [`${TIM} ${ma}`, ...phan].join(' - ');
}

// Ô Hình Ảnh (các URL nối nhau bằng dấu phẩy) -> danh sách ẢNH gửi Telegram.
//
// BỎ VIDEO. Telegram chỉ tự tải video qua URL tới 20 MB, mà video quay căn thuê thường
// 18–35 MB; một video quá cỡ là Telegram từ chối CẢ ALBUM ("Bad Request"), kéo theo
// mọi ảnh trong album đó. Người dùng chốt: không cần gửi video.
export function laVideoUrl(u) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(u) || u.includes('/video/upload/');
}

export function mediaTelegram(hinhAnh) {
  if (!hinhAnh) return [];
  return hinhAnh.toString().split(',').map(u => u.trim()).filter(Boolean)
    .filter(u => !laVideoUrl(u))
    .map(u => anhCloudinary(u, RONG_ANH_TELEGRAM));
}

// Chia ảnh thành các album ĐỀU NHAU, mỗi album tối đa 10.
//
// sendMediaGroup đòi 2–10 món. Cắt tuần tự 10 một (cách cũ) thì 11 ảnh ra 10 + 1, 21
// ảnh ra 10 + 10 + 1: album 1 ảnh bị Telegram trả "Bad Request" — 16 căn bán, 6 căn thuê
// rơi đúng vào đó. Chia đều thì 11 → 6 + 5, 21 → 7 + 7 + 7. Chỉ khi cả căn có đúng 1 ảnh
// mới còn album 1 món, chỗ gọi gửi nó bằng sendPhoto.
export function chiaAlbum(ds) {
  const n = (ds || []).length;
  if (!n) return [];
  const so = Math.ceil(n / 10);
  const ra = [];
  let dau = 0;
  for (let i = 0; i < so; i++) {
    const co = Math.floor(n / so) + (i < n % so ? 1 : 0);
    ra.push(ds.slice(dau, dau + co));
    dau += co;
  }
  return ra;
}
