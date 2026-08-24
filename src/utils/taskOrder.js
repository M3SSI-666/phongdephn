// Thứ tự hiển thị và kéo-thả của danh sách Task hàng ngày.
//
// Độ ưu tiên CHÍNH LÀ vị trí trong danh sách — không có cột "mức ưu tiên" riêng. Kéo lên
// trên = quan trọng hơn.

const xong  = t => ((t.Xong || '').toString().trim() ? 1 : 0);
const thuTu = t => { const n = Number(t.Thu_Tu); return Number.isFinite(n) ? n : 0; };

// Việc chưa xong lên trên, việc đã xong tụt xuống cuối; trong mỗi nhóm thì theo Thu_Tu.
//
// Sắp theo chỉ số gốc ở nấc cuối để hai task cùng Thu_Tu (vd cùng bằng 0 lúc mới nhập tay
// vào sheet) giữ nguyên thứ tự dòng, không nhảy loạn mỗi lần render.
export function sapXepTask(list) {
  return list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => xong(a.t) - xong(b.t) || thuTu(a.t) - thuTu(b.t) || a.i - b.i)
    .map(x => x.t);
}

// Kéo task từ vị trí `from` sang vị trí `to` trong danh sách ĐANG HIỂN THỊ.
// Trả về { list, orders } — `list` là thứ tự mới đã gắn Thu_Tu, `orders` là thứ gửi server.
// Trả null khi không có gì thay đổi (thả vào đúng chỗ cũ, chỉ số rác).
//
// Đánh số lại TOÀN BỘ danh sách chứ không chỉ đoạn bị ảnh hưởng. An toàn vì tab Task không
// có bộ lọc nào: danh sách hiển thị chính là danh sách đầy đủ, không có dòng ẩn nào để bị
// bỏ sót số. (Đây là điểm khác với persistOrder bên bảng khách, nơi phải chặn kéo khi đang
// lọc vì các dòng bị ẩn vẫn giữ số cũ.)
export function keoTask(list, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (from === to) return null;
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return null;

  const moved = [...list];
  moved.splice(to, 0, moved.splice(from, 1)[0]);

  const withOrder = moved.map((t, i) => ({ ...t, Thu_Tu: String(i + 1) }));
  return {
    list: withOrder,
    orders: withOrder.map(t => ({ Id: t.Id, Thu_Tu: t.Thu_Tu })),
  };
}

// Số thứ tự cho task mới: đứng cuối hàng. Đọc từ Thu_Tu lớn nhất đang có chứ không lấy
// list.length — hai thứ đó lệch nhau ngay sau lần xoá đầu tiên, và trùng số thì task mới
// chen vào giữa danh sách.
export function thuTuTiepTheo(list) {
  return list.reduce((max, t) => Math.max(max, thuTu(t)), 0) + 1;
}
