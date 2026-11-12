// Bảng con lưu BẢN SAO của căn, chụp lúc gắn thẻ — để giữ Giá Nét, Ghi Chú… người dùng
// sửa riêng. Hệ quả: gắn thẻ trước rồi mới import ảnh vào bảng chính thì bản con mãi mãi
// không có ảnh (P05-1510: bảng chính 7 ảnh, bảng con trống trơn).
//
// Bù lúc HIỂN THỊ chứ không ghi lại sheet: dòng con chưa có ảnh nào thì mượn ảnh của
// chính căn đó ở bảng chính. Dòng con đã có ảnh riêng thì giữ nguyên — đó có thể là bộ
// ảnh người dùng đã chọn lọc cho khách.
import { conKey } from './quyCanShared.js';

export function buAnhBangCon(conRows, mainRows) {
  const anh = new Map();
  for (const r of mainRows || []) {
    const h = (r.Hinh_Anh || '').trim();
    if (h) anh.set(conKey(r.Ma_Can), h);
  }
  if (!anh.size) return conRows;
  let doi = false;
  const ra = (conRows || []).map(r => {
    if ((r.Hinh_Anh || '').trim()) return r;
    const h = anh.get(conKey(r.Ma_Can));
    if (!h) return r;
    doi = true;
    return { ...r, Hinh_Anh: h };
  });
  // Không đổi dòng nào thì trả lại đúng mảng cũ, để useMemo phía sau không tính lại vô ích.
  return doi ? ra : conRows;
}
