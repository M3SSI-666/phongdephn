// Tra ảnh mặt bằng riêng của một căn từ chính mã căn.
//
// Mặt bằng mọi tầng của một tòa giống hệt nhau, nên ảnh layout chỉ cần một bản cho mỗi
// TRỤC chứ không phải mỗi căn: tòa T1 có 450 căn mà chỉ 18 ảnh. Nhập thêm căn T1 mới là
// căn đó có layout ngay, không ai phải upload gì.
//
// Ảnh và toạ độ do scripts/catTrucMatBang.py cắt sẵn từ mặt bằng tòa.
import { parseMaCan } from './maCan.js';
import BAN_DO from '../data/matBangTruc.js';

export const THU_MUC = '/mat-bang/truc';

// Tòa nào chưa cắt thì trả null để chỗ gọi rơi về mặt bằng tòa như cũ — làm dần từng
// tòa được, không có lúc nào app gãy.
export function trucCuaCan(maCan) {
  const p = parseMaCan(maCan);
  if (!p) return null;
  const toa = BAN_DO[p.toa];
  const khung = toa && toa[p.truc];
  return khung ? { toa: p.toa, truc: p.truc, khung } : null;
}

// Ảnh cắt riêng của căn, dùng cho ô Layout và cho PDF lộ trình.
export function anhTrucCan(maCan) {
  const t = trucCuaCan(maCan);
  return t ? `${THU_MUC}/${t.toa}-${t.truc}.jpg` : null;
}

// Mặt bằng cả tòa dùng làm nền khoanh đỏ. Khung đỏ tính theo % của ẢNH NÀY, không
// dùng được với file /mat-bang/<tòa>.jpg cũ — hai ảnh lệch khung nhau.
export function matBangSach(maCan) {
  const t = trucCuaCan(maCan);
  return t ? `${THU_MUC}/${t.toa}.jpg` : null;
}

// Telegram tự đi tải ảnh từ URL nên phải là đường dẫn TUYỆT ĐỐI công khai; đưa đường
// dẫn tương đối thì máy chủ Telegram không biết lấy ở đâu. Chạy localhost thì Telegram
// không với tới máy mình được — chỗ này chỉ thật sự chạy trên bản đã deploy.
export function anhTrucCanTuyetDoi(maCan, goc) {
  const duong = anhTrucCan(maCan);
  if (!duong) return '';
  const g = String(goc || '').replace(/\/+$/, '');
  return /^https?:\/\//i.test(g) ? `${g}${duong}` : '';
}

// Khung đỏ vị trí căn, đơn vị %. Trả về dạng dán thẳng vào style tuyệt đối được.
export function khungTrucCan(maCan) {
  const t = trucCuaCan(maCan);
  if (!t) return null;
  const { x, y, w, h } = t.khung;
  return { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` };
}

export function coBanDo(toa) {
  return Boolean(BAN_DO[String(toa || '').toUpperCase()]);
}
