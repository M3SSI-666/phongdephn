// Tách mã căn Times City thành tòa / tầng / trục.
//
// Cấu trúc: [3 ký tự tòa][2-3 ký tự tầng][2-3 ký tự trục]
//   T010301   -> T01 | 03  | 01
//   T0112B11  -> T01 | 12B | 11
//   T010312A  -> T01 | 03  | 12A
//   T0112A12A -> T01 | 12A | 12A
//
// Chỗ dễ sai: phần sau mã tòa dài 5 ký tự thì cắt ở đâu? "12B11" là 12B+11 hay 12+B11?
// VỊ TRÍ CHỮ CÁI quyết định: chữ A/B chỉ đứng cuối trường mà nó thuộc về. Đối chiếu
// 12.556 mã thật trong dataCan.json: không có mã nào từ 8 ký tự trở lên mà thiếu A/B,
// nên quy tắc này không có ca nhập nhằng.
//
// Toà nhà Việt Nam kiêng số 13, 14 nên đánh số 12A, 12B thay thế — 12A LÀ tầng 13,
// 12B LÀ tầng 14. Dữ liệu thật xác nhận: tầng nhảy 12 -> 12A -> 12B -> 15, tuyệt đối
// không có 13/14 viết thẳng. Số trục cũng theo quy ước này.

// Tầng/trục hợp lệ: 2 chữ số, hoặc 12A/12B. Mọi thứ khác (shophouse P01SH0102,
// P02S11, mã rác 46298) đều bị loại chứ không đoán bừa.
const PHAN_HOP_LE = /^(\d{2}|12[AB])$/;

export function parseMaCan(code) {
  const c = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (c.length < 7) return null;

  const toa  = c.slice(0, 3);
  const rest = c.slice(3);

  let tang, truc;
  if (rest.length === 4) {              // 0301      -> 03 | 01
    tang = rest.slice(0, 2); truc = rest.slice(2);
  } else if (rest.length === 6) {       // 12A12A    -> 12A | 12A
    tang = rest.slice(0, 3); truc = rest.slice(3);
  } else if (rest.length === 5) {       // 12B11 hoặc 0312A
    const chuOGiua = /[A-Z]/.test(rest[2]);
    tang = chuOGiua ? rest.slice(0, 3) : rest.slice(0, 2);
    truc = chuOGiua ? rest.slice(3)    : rest.slice(2);
  } else {
    return null;
  }

  if (!PHAN_HOP_LE.test(tang) || !PHAN_HOP_LE.test(truc)) return null;
  return { toa, tang, truc };
}

// Tầng -> số thứ tự thật, để so sánh khoảng được. 12A và 12B không phải "tầng 12 biến thể"
// mà là tầng 13 và 14, nên dãy 12 -> 12A -> 12B -> 15 ra đúng 12,13,14,15: liền mạch.
// Nhờ vậy "từ tầng 12 đến 15" tự động gồm cả 12A/12B mà không cần luật riêng.
export function tangToNumber(tang) {
  const t = String(tang || '').trim().toUpperCase();
  if (t === '12A') return 13;
  if (t === '12B') return 14;
  return /^\d{1,3}$/.test(t) ? parseInt(t, 10) : null;
}

// Chiều ngược lại, chỉ dùng để hiển thị: người ta gọi tầng đó là 12A, không ai nói "tầng 13".
export function numberToTang(n) {
  if (n == null) return '';
  if (n === 13) return '12A';
  if (n === 14) return '12B';
  return String(n);
}

// Người dùng gõ "trục 5" nhưng mã căn ghi "05"; gõ "12a" nhưng mã ghi "12A".
export function normalizeTruc(input) {
  const t = String(input == null ? '' : input).trim().toUpperCase().replace(/\s+/g, '');
  if (/^12[AB]$/.test(t)) return t;
  if (/^\d{1,2}$/.test(t)) return t.padStart(2, '0');
  return null;
}

// Trục khớp CHÍNH XÁC: 12, 12A, 12B là ba căn khác nhau trên cùng một tầng, gộp lại
// thì mất luôn cách lọc riêng trục 12.
export function maCanTrucMatch(code, truc) {
  const want = normalizeTruc(truc);
  if (want == null) return false;
  const p = parseMaCan(code);
  return p != null && p.truc === want;
}

// min/max để null nghĩa là không chặn đầu đó ("từ tầng 20 trở lên").
export function maCanTangInRange(code, min, max) {
  const p = parseMaCan(code);
  if (p == null) return false;
  const n = tangToNumber(p.tang);
  if (n == null) return false;
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}
