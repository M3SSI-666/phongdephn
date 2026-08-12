// Helper dùng chung cho Quỹ Căn Thuê / Quỹ Căn Bán / Quỹ Đập Thông.
// Trước đây các hàm này bị copy-paste giống hệt nhau ở 2 trang; gom về đây để
// sửa 1 chỗ là cả 3 bảng cùng đổi. Dùng cho CẢ render bảng lẫn import.

// ── Chuẩn hoá chuỗi ──

// Chuẩn hóa tên header/tên sheet: bỏ dấu, gộp khoảng trắng/xuống dòng, viết thường.
export function normHeader(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Mã căn hợp lệ: 1-3 chữ cái + >=3 chữ số (T010604, P0112A11...). Loại banner (T01, Park Hill...).
export const MA_CAN_RE = /^[A-Za-z]{1,3}\d{3,}/;

// Khoá so khớp 1 căn giữa bảng chính và bảng con.
// PHẢI khớp conKey() trong api/quycanban.js, api/quycanthue.js, api/quydapthong.js.
// Lệch 1 khoảng trắng là client tưởng "đã có dòng" còn server tưởng "chưa có" -> đẻ dòng trùng.
export const conKey = s => (s || '').trim().toUpperCase().replace(/\s+/g, '');

// Chốt chặn cho sửa/xoá dòng bảng con: server đọc lại Mã Căn + Owner_Id tại _rowIndex,
// lệch thì trả 409 thay vì ghi mù. Sheet con dùng chung cho mọi user nên bất kỳ ai xoá
// 1 dòng là mọi _rowIndex phía dưới đang giữ ở client thành sai.
// Bảng chính chỉ admin ghi -> không cần, trả {} để trải vào payload cho gọn.
export const expectOf = (item, fromCon) =>
  fromCon ? { expect: { Ma_Can: item?.Ma_Can || '', Owner_Id: item?.Owner_Id || '' } } : {};

// ── Màu trạng thái ──
// Các hex này phải KHÁC mọi giá trị trong RAINBOW_COLORS của 2 trang để phân biệt
// được màu trạng thái (từ file công ty) với màu Mã Căn user tự tô.

export const STATUS_GRAY   = '#9CA3AF'; // xám  -> Đã cho thuê (Thuê) / Đã bán (Bán)
export const STATUS_PAUSED = '#FFF000'; // vàng -> Dừng thuê / Dừng bán
// Hồng nhạt: đánh dấu căn import từ sheet "Hàng Đầu Tư" (chỉ Quỹ Căn Bán).
// Không phải màu user tô, không phải trạng thái -> có thể bị ghi đè khi import lại.
export const INVEST_COLOR  = '#F9A8D4';

// fgColor.rgb của ô Mã Căn trong file công ty -> màu trạng thái chuẩn, hoặc '' (bình thường).
export function canonicalStatusColor(rgb) {
  if (!rgb) return '';
  let h = rgb.toString().replace('#', '').toUpperCase();
  if (h.length === 8) h = h.slice(2);   // bỏ alpha AARRGGBB
  if (h.length !== 6) return '';
  if (h === 'FFFFFF') return '';         // trắng = bình thường
  if (h === 'FFFF00') return STATUS_PAUSED;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min <= 16 && min >= 0x60 && max <= 0xF0) return STATUS_GRAY; // dải xám trung tính
  return '';
}

// ── Chuẩn hoá giá trị cột ──

// "2N" -> "2PN"; giữ nguyên nếu không phải dạng số + N.
export function normalizeThietKe(val) {
  const s = (val || '').toString().trim();
  const m = s.match(/^(\d+)\s*n$/i);
  return m ? `${m[1]}PN` : s;
}

// "TV" -> "Thu về", "BP" -> "Bao phí"; giữ nguyên phần còn lại.
export function mapPhi(val) {
  const s = (val || '').toString().trim();
  const key = s.toUpperCase();
  if (key === 'TV') return 'Thu về';
  if (key === 'BP') return 'Bao phí';
  return s;
}

// Giá bán bị lỗi khi ô Excel định dạng NGÀY (VD "d.m") -> lưu thành số serial ngày
// (43831 ≈ 2020-01-01, ~47500 ≈ 2030). Giá bán thật tính bằng tỷ nên chỉ vài chữ số
// (VD "6.7", "85"). Bất kỳ số nguyên >= 1000 nào ở ô Giá đều KHÔNG phải giá -> loại.
// Áp cho cả chuỗi đã có/ chưa có chữ "tỷ" (dữ liệu cũ import trước khi có guard, VD "45800 tỷ").
export function isDateSerialGia(val) {
  const s = (val || '').toString().trim();
  if (!s) return false;
  const num = parseFloat(s.replace(/[^\d.,-]/g, '').replace(/,/g, '.'));
  return Number.isInteger(num) && num >= 1000;
}

// ── Khung nhập tay cho ô "paste tin Zalo" ──
// Mở modal Thêm căn là ô đã có sẵn danh sách trường, gõ giá trị vào sau dấu ":" cho nhanh.
// Muốn dán tin từ Zalo thì bôi đen xoá hết rồi dán đè — vẫn chạy như cũ.
//
// QUAN TRỌNG: các nhãn ở đây phải nằm trong danh sách nhãn mà prompt AI đang bắt
// (api/parse-tc.js). Thêm nhãn ở đây mà quên dạy prompt = người dùng điền đủ nhưng form
// vẫn trống, và không có gì báo cho họ biết.
export const KHUNG_THUE = [
  'Căn hộ:', 'Thiết kế:', 'Diện tích:', 'Hướng ban công:', 'Slot xe:',
  'Giá:', 'Phí mg:', 'Nội thất:', 'Thời gian vào:', 'Liên hệ:',
].join('\n');

export const KHUNG_BAN = [
  'Căn hộ:', 'Thiết kế:', 'Diện tích:', 'Hướng ban công:', 'Slot xe:',
  'Giá:', 'Phí:', 'Nội thất:', 'SĐT:', 'Tên chủ:',
].join('\n');

// Khung vẫn còn trống = chưa dòng nào có chữ sau dấu ":".
// Dùng để khoá nút Parse: gọi AI với khung rỗng chỉ tốn một lượt gọi rồi trả về rỗng, mà
// nút vẫn sáng thì người dùng tưởng mình đã làm đúng.
// Dòng KHÔNG có dấu ":" (tin Zalo dán vào) mà có chữ thì tính là đã có nội dung.
export function khungConTrong(text) {
  return !String(text || '').split('\n').some((line) => {
    const i = line.indexOf(':');
    return (i === -1 ? line : line.slice(i + 1)).trim() !== '';
  });
}
