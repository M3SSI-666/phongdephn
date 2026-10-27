// Dựng danh sách căn dạng chữ để dán ra ngoài (Zalo, Telegram, email...).
//
// Khác tin gửi khách ở chỗ: tin gửi khách là MỘT căn viết nhiều dòng cho đẹp, còn đây là
// NHIỀU căn, mỗi căn một dòng, để người đọc lướt nhanh và so sánh được theo cột.

const bo = v => (v || '').toString().trim();

// Một dòng tóm tắt 1 căn:
// "T081903 - 53m - Hướng: Nam - Giá: 4.55 tỷ thu về - Liên hệ: A Hoan 0962862895"
//
// Phần nào rỗng thì BỎ HẲN khỏi dòng, không để lại nhãn cụt kiểu "Hướng: -". Danh sách
// này dán thẳng ra ngoài để làm việc, nhãn trống chỉ gây hiểu nhầm là mất dữ liệu.
export function dongXuatCan({ maCan, dienTich, huong, gia, lienHe, ghiChu }) {
  const phan = [];
  const ma = bo(maCan).toUpperCase();
  if (ma) phan.push(ma);
  // "53 m²" / "53m2" / "53m" -> "53m". Giữ nguyên dạng ghi lạ ("75+25") vì đó là
  // diện tích thật của căn đập thông, ép về một số là ghi sai căn.
  const dt = bo(dienTich).replace(/\s*(m²|m2|m)$/i, '').trim();
  if (dt) phan.push(`${dt}m`);
  const h = bo(huong);
  if (h) phan.push(`Hướng: ${h}`);
  const g = bo(gia);
  if (g) phan.push(`Giá: ${g}`);
  const lh = bo(lienHe);
  if (lh) phan.push(`Liên hệ: ${lh}`);
  // Ghi chú để CUỐI vì nó dài và không cố định độ dài — đặt giữa dòng là đẩy mấy trường
  // sau nó lệch tứ tung, nhìn cả danh sách không còn thẳng cột.
  // Ô ghi chú gõ xuống dòng được (bảng hiển thị pre-line), mà ở đây mỗi căn đúng một
  // dòng — nên gộp mọi xuống dòng và khoảng trắng thừa thành một dấu cách.
  const gc = bo(ghiChu).replace(/\s+/g, ' ');
  if (gc) phan.push(`Ghi chú: ${gc}`);
  return phan.join(' - ');
}

// Ghép tiêu đề + các dòng. Dòng rỗng (căn không có nổi mã căn) bị loại, không để lại
// dòng trắng giữa danh sách.
export function xuatDanhSach(tieuDe, dong) {
  const ds = (dong || []).filter(d => bo(d));
  const td = bo(tieuDe);
  return [...(td ? [`${td}:`] : []), ...ds].join('\n');
}
