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

// Vẽ mặt bằng tòa + khung đỏ ra MỘT ảnh để gửi đi.
//
// Trên màn hình khung đỏ chỉ là một thẻ div đặt đè lên ảnh, Telegram không hiểu CSS nên
// phải nung khung vào ảnh rồi đẩy nguyên tệp lên. Vẽ ngay trên máy người gửi thì không
// phải lưu thêm 398 ảnh khoanh sẵn trong repo, và đổi màu hay độ dày nét lúc nào cũng được.
//
// Ảnh nền cùng tên miền với app nên canvas không bị "nhiễm", toDataURL đọc ra bình thường.
export function veKhoanhDo(maCan) {
  return new Promise(xong => {
    const nen = matBangSach(maCan), t = trucCuaCan(maCan);
    if (!nen || !t || typeof document === 'undefined') return xong('');
    const img = new Image();
    img.onerror = () => xong('');
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const { x, y, w, h } = t.khung;
        // Nét dày theo cỡ ảnh, không ghi cứng: mặt bằng tòa to nhỏ khác nhau, ghi cứng
        // 3px thì tòa ảnh lớn nhìn ra sợi chỉ.
        const net = Math.max(2, Math.round(c.width / 320));
        g.strokeStyle = '#e11d48';
        g.lineWidth = net;
        // strokeRect vẽ nét đè lên đường biên nên thụt vào nửa nét, không thì khung
        // ăn lẹm sang căn bên cạnh.
        g.strokeRect(x / 100 * c.width + net / 2, y / 100 * c.height + net / 2,
                     w / 100 * c.width - net, h / 100 * c.height - net);
        xong(c.toDataURL('image/jpeg', 0.92));
      } catch { xong(''); }
    };
    img.src = nen;
  });
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
