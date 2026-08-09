// Đọc số tiền ở cột "Thu về" (doanh thu) của bảng khách.
//
// Quy ước gõ của người dùng:
//   - Số trần là NGHÌN đồng: "300" = 300.000 đ, "500" = 500.000 đ
//   - Có đuôi thì theo đuôi: "1tr" = 1.000.000 đ, "2.5tr" = 2.500.000 đ
//
// Nguyên tắc như bên khachDate.js: không đọc được thì trả null để chỗ gọi ĐẾM RA và báo,
// tuyệt đối không âm thầm coi là 0 — doanh thu thiếu tiền mà vẫn hiện một con số trông
// bình thường là kiểu sai tệ nhất.

const MUL = {
  'tỷ': 1e9, 'tỉ': 1e9, 'ty': 1e9, 'ti': 1e9,
  'tr': 1e6, 'triệu': 1e6, 'trieu': 1e6,
  'k': 1e3, 'nghìn': 1e3, 'nghin': 1e3, 'ngàn': 1e3, 'ngan': 1e3,
};

// Không ghi đuôi = nghìn.
const MUL_MAC_DINH = 1e3;

// Đuôi dài đặt trước đuôi ngắn để "triệu" không bị khớp cụt thành "tr".
// (?![\p{L}]) chặn ăn nhầm chữ cái đầu của một từ khác: "300 tiền" phải ra 300 nghìn,
// không phải 300 tỉ vì thấy "ti".
const TIEN_RE = /(\d+(?:[.,]\d+)*)\s*(tỷ|tỉ|triệu|trieu|nghìn|nghin|ngàn|ngan|ty|ti|tr|k)?(?![\p{L}])/iu;

// "1.000.000" là dấu phân nhóm nghìn; "2.5" / "2,5" là dấu thập phân.
function toNumber(raw) {
  const nhom = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
  const s = nhom ? raw.replace(/[.,]/g, '') : raw.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Trả số tiền quy về ĐỒNG, hoặc null nếu ô không đọc được.
export function parseTienVnd(text) {
  const hit = TIEN_RE.exec(String(text ?? ''));
  if (!hit) return null;
  const n = toNumber(hit[1]);
  if (n == null) return null;
  const donVi = (hit[2] || '').toLowerCase();
  return n * (donVi ? MUL[donVi] : MUL_MAC_DINH);
}

// 25300000 -> "25.300.000 đ". Tự nhóm nghìn thay vì toLocaleString để kết quả không phụ
// thuộc bộ ICU của trình duyệt/Node.
export function formatVnd(n) {
  const am = n < 0;
  const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${am ? '-' : ''}${s} đ`;
}
