// Thu nhỏ ảnh Cloudinary NGAY TRÊN ĐƯỜNG DẪN, lúc hiển thị.
//
// Vì sao cần: ô ảnh trong bảng chỉ rộng 32px, nhưng thẻ <img> vẫn tải nguyên tấm gốc 3-8MB
// máy ảnh điện thoại chụp ra. Một trang 50 căn × 3 ảnh = ngốn hàng trăm MB băng thông mỗi
// lần mở. Gói miễn phí của Cloudinary tính chung một quỹ tín dụng cho CẢ dung lượng lưu trữ
// LẪN băng thông, nên đây rất có thể mới là thứ làm hiện cảnh báo "hết dung lượng".
//
// Cloudinary sinh ảnh nhỏ ngay khi có yêu cầu, chỉ cần chèn tham số vào giữa đường dẫn —
// không phải tải lại, không phải đổi dữ liệu trong sheet, không cần khoá API. Bỏ hàm này đi
// là mọi thứ trở về y như cũ.
//
//   f_auto  trình duyệt nào nhận được WebP/AVIF thì trả loại đó
//   q_auto  Cloudinary tự chọn mức nén vừa mắt
//   w_…     giới hạn chiều rộng
//   c_limit chỉ thu nhỏ, không phóng to và không cắt xén (phần cắt để CSS object-fit lo)

const TIEN_TO = 'https://res.cloudinary.com/';

// Đoạn ngay sau /upload/ đã là tham số biến đổi sẵn rồi hay chưa. Phải kiểm tra, không thì
// gọi hàm hai lần sẽ chèn chồng hai cụm tham số và Cloudinary trả 400.
// Số phiên bản ("v1712345678") KHÔNG tính là tham số — nó không có dấu gạch dưới.
const laThamSo = doan =>
  doan.split(',').every(p => /^[a-z]{1,3}_.+/.test(p));

// Trả về đường dẫn ảnh đã giới hạn chiều rộng `rong` pixel.
// Đường dẫn không phải ảnh Cloudinary (avatar Clerk, blob xem trước lúc chưa upload…) và
// video đều được trả nguyên vẹn — video phát trong thẻ <video>, đổi định dạng là hỏng.
export function anhCloudinary(url, rong) {
  if (typeof url !== 'string' || !url.startsWith(TIEN_TO)) return url;
  if (!Number.isInteger(rong) || rong <= 0) return url;

  const moc = url.indexOf('/image/upload/');
  if (moc === -1) return url;

  const dau = moc + '/image/upload/'.length;
  const con = url.slice(dau);
  if (laThamSo(con.split('/')[0])) return url;

  return `${url.slice(0, dau)}f_auto,q_auto,w_${rong},c_limit/${con}`;
}

// ẢNH ĐẠI DIỆN (một khung hình, JPG nhỏ) của video Cloudinary — dùng cho ô thu nhỏ.
//
// Vì sao cần: ô video trong bảng là thẻ <video> trỏ thẳng file video gốc chỉ để hiện
// một khung hình 32px — mỗi video trình duyệt kéo về cả MB dữ liệu mỗi lần mở tab, trên
// điện thoại 4G là nặng thấy rõ. Cloudinary trả ảnh khung hình nếu đổi đuôi đường dẫn
// video sang .jpg, kèm tham số thu nhỏ như ảnh thường.
// Không phải video Cloudinary (hoặc đã có tham số sẵn) → null, để chỗ gọi dùng <video>.
export function anhVideoCloudinary(url, rong) {
  if (typeof url !== 'string' || !url.startsWith(TIEN_TO)) return null;
  if (!Number.isInteger(rong) || rong <= 0) return null;
  const moc = url.indexOf('/video/upload/');
  if (moc === -1) return null;
  const dau = moc + '/video/upload/'.length;
  const [duong, hoi] = url.slice(dau).split('?');
  if (laThamSo(duong.split('/')[0])) return null;
  const cham = duong.lastIndexOf('.');
  const goc = cham > duong.lastIndexOf('/') ? duong.slice(0, cham) : duong;
  return `${url.slice(0, dau)}q_auto,w_${rong},c_limit/${goc}.jpg${hoi ? `?${hoi}` : ''}`;
}
