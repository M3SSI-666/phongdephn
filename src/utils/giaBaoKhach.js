// Giá báo khách gõ tay cho từng căn trong báo cáo "Lộ trình xem nhà".
//
// Sales hay gõ mỗi con số ("6.5") vì đơn vị là hiển nhiên trong đầu họ. In nguyên "6.5"
// ra file gửi khách thì thành vô nghĩa, nên số trần được tự thêm đơn vị.
// Còn khi đã gõ kèm chữ ("6,5 tỷ bao phí", "thương lượng") thì GIỮ NGUYÊN — lúc đó họ
// đã nói rõ ý rồi, tự sửa lại là cãi lời người dùng.

export const DON_VI_BAN  = 'tỷ';
export const DON_VI_THUE = 'triệu/tháng';

export function giaBaoKhach(nhap, donVi) {
  const s = (nhap || '').toString().trim();
  if (!s) return '';
  // Dấu phẩy hay dấu chấm đều giữ đúng như đã gõ: "6,5" là cách viết của người Việt,
  // đổi thành "6.5" là sửa chữ của họ mà không hỏi.
  return /^[\d.,]+$/.test(s) ? `${s} ${donVi}` : s;
}
