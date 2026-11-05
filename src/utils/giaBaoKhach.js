// Giá báo khách gõ tay cho từng căn trong báo cáo "Lộ trình xem nhà".
//
// Sales hay gõ mỗi con số ("6.5") vì đơn vị là hiển nhiên trong đầu họ. In nguyên "6.5"
// ra file gửi khách thì thành vô nghĩa, nên số trần được tự thêm đơn vị.
// Còn khi đã gõ kèm chữ ("6,5 tỷ bao phí", "thương lượng") thì GIỮ NGUYÊN — lúc đó họ
// đã nói rõ ý rồi, tự sửa lại là cãi lời người dùng.

export const DON_VI_BAN  = 'tỷ';
export const DON_VI_THUE = 'triệu/tháng';

/**
 * nhap  — chuỗi người dùng gõ
 * donVi — đơn vị thêm vào khi gõ mỗi con số ("tỷ" / "triệu/tháng")
 * hau   — đuôi thêm sau đơn vị, CHỈ khi tự thêm đơn vị: bên Bán là loại phí
 *         ("thu về" / "bao phí") lấy từ cột Phí của chính căn đó. Giá mặc định đã
 *         kèm phần này, nên giá gõ tay thiếu nó là hai căn cạnh nhau ghi hai kiểu.
 */
export function giaBaoKhach(nhap, donVi, hau = '') {
  const s = (nhap || '').toString().trim();
  if (!s) return '';
  // Đã gõ kèm chữ thì giữ NGUYÊN VĂN, không thêm đơn vị cũng không thêm đuôi phí:
  // lúc đó người dùng đã viết trọn câu giá rồi, nối thêm là ra "6,5 tỷ bao phí thu về".
  if (!/^[\d.,]+$/.test(s)) return s;
  // Dấu phẩy hay dấu chấm đều giữ đúng như đã gõ: "6,5" là cách viết của người Việt,
  // đổi thành "6.5" là sửa chữ của họ mà không hỏi.
  return `${s} ${donVi}${hau ? ` ${hau}` : ''}`;
}
