// Kéo thả đổi thứ tự một phần tử trong danh sách: cầm phần tử `tu`, thả vào TRƯỚC
// (duoi=false) hoặc SAU (duoi=true) phần tử `i`. Trả mảng MỚI, hoặc null khi thả về
// đúng chỗ cũ (chỗ gọi khỏi lưu lại).
//
// Để riêng khỏi telegramCan: nhóm Telegram và thẻ bảng con đều cần đúng phép này,
// mà chép hai bản thì hai bên lệch nhau lúc sửa.
export function doiViTri(ds, tu, i, duoi) {
  if (!Array.isArray(ds) || tu == null || i == null) return null;
  let den = i + (duoi ? 1 : 0);
  if (den > tu) den -= 1;                    // bỏ phần tử ra trước thì chỉ số dồn lên 1
  if (den === tu) return null;
  const moi = [...ds];
  const [x] = moi.splice(tu, 1);
  moi.splice(den, 0, x);
  return moi;
}
