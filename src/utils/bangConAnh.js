// Bảng con lưu BẢN SAO của căn, chụp lúc gắn thẻ — để giữ Giá Nét, Ghi Chú… người dùng
// sửa riêng. Hệ quả: gắn thẻ trước rồi mới import ảnh vào bảng chính thì bản con mãi mãi
// không có ảnh (P05-1510: bảng chính 7 ảnh, bảng con trống trơn).
//
// Bù lúc HIỂN THỊ chứ không ghi lại sheet: dòng con không có ẢNH nào dùng được thì mượn
// ảnh của chính căn đó ở bảng chính. "Dùng được" chứ không phải "ô không trống": ô còn
// sót dấu phẩy thừa, hay chỉ còn một video cũ (Telegram không gửi video), thì vẫn là
// không có ảnh — đếm theo ô trống là P03-0611 gửi Telegram ra 0 ảnh dù bảng chính có 7.
// Dòng con đã có ảnh riêng thì giữ nguyên — đó có thể là bộ ảnh đã chọn lọc cho khách.
import { conKey } from './quyCanShared.js';

const laVideo = u => /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(u) || u.includes('/video/upload/');
const soAnh = s => String(s || '').split(',').map(u => u.trim()).filter(u => u && !laVideo(u)).length;

export function buAnhBangCon(conRows, mainRows) {
  const anh = new Map();
  for (const r of mainRows || []) {
    if (soAnh(r.Hinh_Anh)) anh.set(conKey(r.Ma_Can), r.Hinh_Anh.trim());
  }
  if (!anh.size) return conRows;
  let doi = false;
  const ra = (conRows || []).map(r => {
    if (soAnh(r.Hinh_Anh)) return r;
    const h = anh.get(conKey(r.Ma_Can));
    if (!h) return r;
    doi = true;
    return { ...r, Hinh_Anh: h };
  });
  // Không đổi dòng nào thì trả lại đúng mảng cũ, để useMemo phía sau không tính lại vô ích.
  return doi ? ra : conRows;
}
