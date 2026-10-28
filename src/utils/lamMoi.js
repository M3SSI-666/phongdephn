// Phần thuần của vòng làm mới 30 giây (tách khỏi hook để node --test chạy được,
// không cần React).

// Chu kỳ tải lại dữ liệu sheet của các bảng.
export const CHU_KY_LAM_MOI = 30000;

// Dữ liệu tải lại mà KHÔNG khác gì bản đang hiện thì trả lại ĐÚNG mảng cũ — React thấy
// cùng một tham chiếu nên bỏ qua, không vẽ lại cả bảng. Dùng trong setState dạng hàm:
//   setItems(cu => giuNeuKhongDoi(cu, moi))
//
// Vì sao cần: bản trước cứ 30 giây là đặt mảng mới vào state dù sheet không ai sửa,
// nên bảng vài trăm dòng (kèm ảnh, ô sửa) bị vẽ lại toàn bộ mỗi 30 giây — trên điện
// thoại là khựng một nhịp đều đặn. So bằng JSON: vài trăm dòng mất vài mili-giây, rẻ hơn
// rất nhiều so với vẽ lại bảng.
export function giuNeuKhongDoi(cu, moi) {
  if (cu === moi) return cu;
  try {
    return JSON.stringify(cu) === JSON.stringify(moi) ? cu : moi;
  } catch {
    return moi;
  }
}
