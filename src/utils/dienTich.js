// Diện tích trong sheet là chữ tự do: "106m²", "106 m2", "106,5", và có khi ghi cộng gộp
// "75 + 25" = 100 (phần chính + logia). Cộng các phần lại chứ không nối chuỗi số —
// nối thì "75+25" thành 7525 và căn đó lọt vào mọi bộ lọc "trên 100m".
//
// Dấu phẩy là dấu thập phân ("106,5" = 106.5), không phải phân cách nghìn: căn hộ
// không có cái nào tới 1.000m².

// Trả về null khi không đọc được, KHÔNG phải 0. Ô trống mà thành 0 thì căn đó tự động
// khớp mọi bộ lọc "dưới X" — im lặng bịa ra dữ liệu mình không có.
// Đơn vị phải cắt TRƯỚC khi đọc số: "106m2" mà đọc số ngay thì chữ 2 của "m2" cũng là
// một số và bị cộng vào thành 108. Lệch 2m² ở mọi căn — sắp xếp thì không lộ, lọc thì lộ.
const DON_VI = /m²|m2|mét\s*vuông|met\s*vuong|mét|met|sqm|m\b/g;

export function parseDienTich(val) {
  const s = String(val == null ? '' : val).toLowerCase().replace(/,/g, '.').replace(DON_VI, ' ');
  const nums = s.match(/\d+(?:\.\d+)?/g);
  if (!nums) return null;
  return nums.reduce((sum, n) => sum + parseFloat(n), 0);
}

// min/max để null nghĩa là không chặn đầu đó ("trên 100m" -> min=100, max=null).
// Căn không đọc được diện tích thì bị loại, vì không biết thì không được đoán.
export function dienTichInRange(val, min, max) {
  const dt = parseDienTich(val);
  if (dt == null) return false;
  if (min != null && dt < min) return false;
  if (max != null && dt > max) return false;
  return true;
}

// Hiện lại cho gọn: 106 chứ không phải 106.0, 106.5 thì giữ nguyên.
export function formatDienTich(n) {
  if (n == null) return '';
  return String(Math.round(n * 10) / 10);
}
