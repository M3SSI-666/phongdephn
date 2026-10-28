import { useState } from 'react';
import { anhVideoCloudinary } from '../utils/anhCloudinary';

/**
 * Ô thu nhỏ của một VIDEO (trong bảng, form sửa, dải ảnh ở khung xem lớn).
 *
 * Video Cloudinary → hiện ẢNH ĐẠI DIỆN JPG nhỏ (một khung hình), tải dần khi cuộn tới —
 * không kéo file video gốc về chỉ để lấy một khung hình 32px. Ảnh đại diện lỗi, hoặc
 * video không nằm trên Cloudinary → lùi về <video> như cũ, nhưng chỉ tải phần đầu
 * (preload="metadata") thay vì để trình duyệt tự quyết.
 *
 * rong — bề ngang ảnh cần tải (px thật, thường gấp đôi kích thước hiển thị cho màn nét).
 */
export default function VideoNho({ src, rong, style }) {
  const [hongAnh, setHongAnh] = useState(false);
  const anh = hongAnh ? null : anhVideoCloudinary(src, rong);
  if (anh) {
    return (
      <img src={anh} alt="" loading="lazy" decoding="async" style={style}
        onError={() => setHongAnh(true)} />
    );
  }
  return <video src={src} style={style} muted preload="metadata" />;
}
