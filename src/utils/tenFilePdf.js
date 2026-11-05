// Để riêng khỏi lichXemNhaPdf.js: file đó import CSS nên node --test không nạp được,
// mà quy tắc đặt tên file thì đáng có test.

// Tên file xuất ra: "Times City_05-11-2026_Linh Hoàng.pdf".
// GIỮ dấu tiếng Việt — tên khách đọc được mới có ích khi tìm lại file sau này. Chỉ bỏ
// những ký tự Windows cấm đặt tên: dính một cái là trình duyệt lặng lẽ đổi tên file
// hoặc không tải được, mà chẳng báo gì.
const KY_TU_CAM = /[\\/:*?"<>|]/g;

export function tenFilePdf(date, client) {
  const ngay = /^\d{4}-\d{2}-\d{2}$/.test(date || '')
    ? date.split('-').reverse().join('-')   // 2026-11-05 -> 05-11-2026
    : '';
  const ten = (client || '').replace(KY_TU_CAM, '').replace(/\s+/g, ' ').trim();
  return ['Times City', ngay, ten].filter(Boolean).join('_') + '.pdf';
}
