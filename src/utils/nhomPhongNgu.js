// Gom khách trong bảng Khách Times thành từng dải theo dòng căn họ đang hỏi:
// 1N, 2N, 3N, 4N... rồi Đập thông, rồi loại khác, cuối cùng là khách chưa ghi.
//
// Ô Phòng ngủ là một <select>, nhưng dữ liệu cũ và dữ liệu gõ tay vẫn lẫn nhiều kiểu
// ("2", "2N", "2PN"), nên phải quy về một nhãn trước khi gom — không thì cùng một dòng
// căn lại bị tách thành mấy dải riêng.

export const NHOM_DAP_THONG = 'Đập thông';
export const NHOM_CHUA_RO   = 'Chưa rõ';

// Giá trị ô Phòng ngủ -> nhãn dải. "2" / "2N" / "2PN" đều về "2N".
// Loại không đọc ra số phòng ngủ thì GIỮ NGUYÊN chữ đã nhập: "Đập thông", "Shophouse"
// là nhu cầu thật, gom bừa vào một dải số là ghi sai khách đó đang tìm gì.
export function nhanNhomPhongNgu(val) {
  const s = (val || '').toString().trim();
  if (!s) return NHOM_CHUA_RO;
  const m = s.match(/^(\d+)\s*(?:pn|n)?$/i);
  return m ? `${m[1]}N` : s;
}

// Hạng của một nhãn dải: [bậc, giá trị so trong bậc].
function hangNhom(nhan) {
  if (nhan === NHOM_CHUA_RO) return [3, 0];
  if (nhan === NHOM_DAP_THONG) return [1, 0];
  const m = nhan.match(/^(\d+)N$/);
  if (m) return [0, Number(m[1])];
  return [2, nhan];
}

// Thứ tự dải: số phòng ngủ tăng dần (1N, 2N, 3N, 4N...), rồi Đập thông, rồi các loại
// khác xếp theo chữ cái (Shophouse...), cuối cùng là khách chưa ghi phòng ngủ.
export function soSanhNhomPhongNgu(a, b) {
  const [ba, va] = hangNhom(a);
  const [bb, vb] = hangNhom(b);
  if (ba !== bb) return ba - bb;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb), 'vi');
}
