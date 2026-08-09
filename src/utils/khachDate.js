// Đọc ngày từ ô Check In / Check Out của bảng khách.
//
// Hai ô này là chữ tự do, người dùng gõ đủ kiểu: "12h30 10/8", "10h 9/8", "8/8",
// "20/8/2026", "Tháng 5", "15/04/2025"... Ta không đổi cách nhập; chỉ cố rút ra ngày/tháng
// để biết hôm nay hoặc ngày mai có khách check in / check out.
//
// Nguyên tắc: KHÔNG đoán bừa. Không rút được ngày chắc chắn thì trả null và ô không được tô
// màu — thà bỏ sót còn hơn tô nhầm, vì màu ở đây dùng để nhắc khách.

// Cụm giờ: "12h30", "10h", "14:00". Phải bỏ TRƯỚC khi dò ngày, nếu không chuỗi viết liền
// kiểu "12h30/8" sẽ bị đọc thành ngày 30 tháng 8.
// Cố ý KHÔNG cho khoảng trắng giữa "h" và số phút: nới ra thì "10h 9/8" bị nuốt luôn số 9
// (thành "10h 9") và mất ngày. Phút luôn viết dính vào giờ: "12h30", "14:00".
const TIME_RE = /\d{1,2}\s*[hH:]\d{0,2}/g;

// Ngày: d/m hoặc d/m/y. Cố ý KHÔNG cho khoảng trắng quanh dấu "/" — nới ra thì "12h30 /8"
// lại thành 30/8. Dữ liệu thực tế đều viết liền.
const DATE_RE = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;

// Trả { d, m, y } với y = null khi người dùng không ghi năm, hoặc null nếu không đọc được.
export function parseNoteDate(text) {
  const cleaned = String(text || '').replace(TIME_RE, ' ');
  const hit = DATE_RE.exec(cleaned);
  if (!hit) return null;
  const d = Number(hit[1]);
  const m = Number(hit[2]);
  // Chặn "8/2026" (tháng/năm) và các cụm số vô nghĩa khác.
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  let y = hit[3] == null ? null : Number(hit[3]);
  if (y != null && y < 100) y += 2000;   // "25" -> 2025
  return { d, m, y };
}

// 'today' | 'soon' (ngày mai) | null.
export function noteDateFlag(text, now = new Date()) {
  const p = parseNoteDate(text);
  if (!p) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Không ghi năm thì bỏ qua năm khi so. So với ĐỐI TƯỢNG ngày mai (chứ không phải cộng 1 vào
  // số ngày) nên các mốc chuyển tháng/chuyển năm tự đúng: 31/12 mà ô ghi "1/1" vẫn ra 'soon'.
  const same = (dt) =>
    p.d === dt.getDate() && p.m === dt.getMonth() + 1 && (p.y == null || p.y === dt.getFullYear());
  if (same(today)) return 'today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (same(tomorrow)) return 'soon';
  return null;
}

// 'YYYY-MM-DD'. Cùng đúng định dạng mà <input type="date"> trả về, nên so khoảng ngày chỉ
// cần so chuỗi — không phải dựng Date, không dính lệch múi giờ.
export function toDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ngày trong ô (vd cột Ngày PS) -> 'YYYY-MM-DD', hoặc null nếu không đọc được.
// Không ghi năm thì lấy năm hiện tại, đúng như người dùng ngầm hiểu khi gõ.
export function noteDayKey(text, now = new Date()) {
  const p = parseNoteDate(text);
  if (!p) return null;
  const y = p.y == null ? now.getFullYear() : p.y;
  return `${y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}
