// Đọc thông tin slot xe từ chữ tự do trong bảng hàng công ty.
//
// Không phải sheet nào cũng có cột "Xe" riêng: Park Hill, G4, Hàng Đầu Tư, Đập Thông đều
// không có, slot nằm lẫn trong ô Ghi Chú do nhiều người gõ tay, mỗi người một kiểu —
// "2 slot xe", "có slot", "full đồ + slot", "không có slot xe", "k slot".
//
// Bản cũ chỉ nhận đúng hai dạng: có SỐ đứng trước ("2 slot"), hoặc chữ "slot" dính liền "xe"
// ("slot xe"). Sai cả hai chiều trên dữ liệu thật:
//   "Full đồ, có slot"  -> Không   căn CÓ slot mà bảng ghi không, lọc "có slot" không ra căn
//   "không có slot xe"  -> Có      căn KHÔNG có slot mà tin nhắn chào khách lại quảng cáo có
// Vế thứ hai nguy hơn nhiều: nó nói sai với khách.
//
// Và ô cột "Xe" trước đây chỉ được hỏi "có chữ hay không", nên sheet nào gõ thẳng "không"
// vào ô đó cũng thành CÓ slot.

const boDau = s => (s || '').toString().toLowerCase()
  .replace(/đ/g, 'd')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Mỗi mệnh đề nói về một thứ. Tách ra để chữ "không" của mệnh đề bên cạnh
// ("không đồ, 2 slot") không bị hiểu thành phủ định cho slot.
const TACH = /[,;/+\n]|\s-\s/;

// "slot" viết đúng và hai kiểu gõ thiếu hay gặp. Số slot, nếu có, đứng ngay trước.
const SLOT_RE = /(?:(\d+)\s*)?s(?:lot|ot|lt)\b/g;

// Phủ định phải đứng NGAY TRƯỚC chữ slot. Không quét cả mệnh đề: "không đồ 2 slot"
// (người gõ quên dấu phẩy) là căn KHÔNG có đồ nhưng CÓ 2 slot.
const PHU_DINH = /(?:^|[\s,;/+-])(khong|ko|k|chua)\s*(?:co\s*)?$/;

// { co, so } — có slot hay không, và số slot nếu ghi chú có ghi số.
function docSlot(ghiChu) {
  for (const doan of boDau(ghiChu).split(TACH)) {
    SLOT_RE.lastIndex = 0;
    let m;
    while ((m = SLOT_RE.exec(doan))) {
      // "slt"/"sot" lọt vào giữa một từ khác thì không tính là slot.
      if (m.index > 0 && /[a-z]/.test(doan[m.index - 1])) continue;
      if (PHU_DINH.test(doan.slice(0, m.index))) return { co: false, so: null };
      const so = m[1] ? parseInt(m[1], 10) : null;
      return so === 0 ? { co: false, so: null } : { co: true, so };
    }
  }
  // Ghi chú không nhắc gì tới slot -> coi như không có. Đoán "có" thì tin chào khách
  // sẽ hứa một chỗ đỗ xe không tồn tại, sai kiểu đó đắt hơn nhiều.
  return { co: false, so: null };
}

// Ô Ghi Chú -> "Có" / "Không". Dùng cho sheet Bán không có cột Xe.
export function slotTuGhiChu(ghiChu) {
  return docSlot(ghiChu).co ? 'Có' : 'Không';
}

// Ô Ghi Chú -> SỐ slot ("2"), hoặc "Có" khi ghi chú xác nhận có mà không nói mấy cái,
// hoặc "Không". Đập Thông là căn gộp từ 2 căn nên số slot mới là thứ người mua hỏi.
export function soSlotTuGhiChu(ghiChu) {
  const { co, so } = docSlot(ghiChu);
  if (!co) return 'Không';
  return so != null ? String(so) : 'Có';
}

// Ô cột "Xe" / "Slot xe" của file công ty -> "Có" / "Không", hoặc '' khi ô trống.
// Trả '' chứ không phải "Không" để chỗ gọi phân biệt được "ô trống, đi hỏi Ghi Chú"
// với "ô ghi rõ là không".
export function slotTuOXe(val) {
  const s = boDau(val).trim();
  if (!s) return '';
  return /^(khong|ko|k|0|-|n\/a)$/.test(s) ? 'Không' : 'Có';
}
