// Đọc ô Giá bên Quỹ Căn Thuê, trả về số TRIỆU/tháng, hoặc null khi không đọc được.
//
// Dấu phẩy là dấu THẬP PHÂN ("13,5tr" = 13.5 triệu), không phải phân cách nghìn.
// Phải đổi ',' -> '.' TRƯỚC khi dò số: "13,5tr" mà dò ngay thì /([\d.]+)tr/ chỉ bắt
// được "5tr" và căn 13,5 triệu bị đọc thành 5 triệu — lọt hết vào mọi bộ lọc
// "thuê dưới 10tr". Đây là lỗi có thật trong bản cũ của trang Thuê.

export function parseGiaThue(gia) {
  const s = String(gia == null ? '' : gia).toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
  const ty = s.match(/([\d.]+)t[ỷy]/);
  if (ty) return num(parseFloat(ty[1]) * 1000);
  // Giá ghi dạng khoảng "14-15tr" -> lấy đầu thấp, giống cách trang Bán đọc "85-90tr".
  // Bắt đúng dạng A-B chứ KHÔNG lấy số nhỏ nhất trong câu: "15tr, bao phí 2tr" mà lấy
  // min thì ra 2 triệu.
  const khoang = s.match(/([\d.]+)[-~]([\d.]+)tr/);
  if (khoang) return num(parseFloat(khoang[1]));
  const tr = s.match(/([\d.]+)tr/);
  if (tr) return num(parseFloat(tr[1]));
  // Số trần không đơn vị: giá thuê tính bằng triệu ("15" = 15tr/tháng).
  const n = s.match(/([\d.]+)/);
  return n ? num(parseFloat(n[1])) : null;
}

// "Thỏa thuận", ô trống, hay "0" đều là KHÔNG có giá. Trả 0 thì căn đó thành rẻ nhất
// và chiếm luôn hạng 1 trong bảng "top 10 giá tốt".
function num(v) {
  return Number.isFinite(v) && v > 0 ? v : null;
}
