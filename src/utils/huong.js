// Đưa một hướng ban công về MÃ chuẩn: "N", "ĐN", "TB"…
//
// Sheet lưu hướng bằng ký hiệu viết tắt (N, ĐB, TN — đếm trên quỹ thuê: 537 căn "N"),
// còn ô tìm kiếm nhận chữ đầy đủ ("Nam", "Đông Nam"). So chữ thô thì "n" không bao giờ
// chứa "nam" và tìm "hướng Nam" ra 0 căn. Hai phía phải cùng về một dạng rồi mới so.
//
// Trả về null khi không đọc ra hướng nào — chỗ gọi tự quyết định có lọc hay không.
const TU = [
  ['ĐONG', 'Đ'], ['DONG', 'Đ'],
  ['TAY', 'T'],
  ['NAM', 'N'],
  ['BAC', 'B'],
];

export function maHuong(val) {
  let s = String(val == null ? '' : val).trim().toUpperCase();
  if (!s) return null;
  // Bỏ dấu (giữ Đ), để "Bắc", "BẮC", "bac" cùng một dạng.
  s = s.replace(/Đ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Đ');
  for (const [tu, ma] of TU) s = s.split(tu).join(ma);
  // Gạch nối, chấm, khoảng trắng giữa hai chữ ("Đ-N", "Đ·N", "Đông Nam").
  s = s.replace(/[\s.\-·/_]/g, '').replace(/D/g, 'Đ');
  return /^[ĐTNB]{1,2}$/.test(s) ? s : null;
}

// Căn có khớp hướng khách tìm không. Khớp ĐÚNG mã: tìm "Nam" ra căn N, không ra ĐN/TN
// — khách nói hướng Nam là hướng Nam, căn Đông Nam là một lựa chọn khác.
// Hướng tìm không đọc ra mã thì rơi về so chữ như cũ, để không lọc mất sạch bảng.
export function khopHuong(huongCan, huongTim) {
  const tim = maHuong(huongTim);
  if (tim == null) {
    return String(huongCan || '').toLowerCase().includes(String(huongTim || '').toLowerCase());
  }
  return maHuong(huongCan) === tim;
}
