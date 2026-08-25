import test from 'node:test';
import assert from 'node:assert/strict';
import { anhCloudinary } from '../src/utils/anhCloudinary.js';

const ANH = 'https://res.cloudinary.com/dhhdnqixb/image/upload/v1712345678/phongdephn/abc.jpg';
const VIDEO = 'https://res.cloudinary.com/dhhdnqixb/video/upload/v1712345678/phongdephn/abc.mp4';

test('chèn tham số ngay sau /upload/, giữ nguyên phần đuôi', () => {
  assert.equal(
    anhCloudinary(ANH, 64),
    'https://res.cloudinary.com/dhhdnqixb/image/upload/f_auto,q_auto,w_64,c_limit/v1712345678/phongdephn/abc.jpg',
  );
});

// Gọi hai lần (ô ảnh nằm trong component render lại nhiều lần) không được chèn chồng —
// Cloudinary trả 400 khi có hai cụm tham số, tức là ảnh biến mất sạch.
test('gọi lại lần nữa không chèn chồng', () => {
  const mot = anhCloudinary(ANH, 64);
  assert.equal(anhCloudinary(mot, 160), mot);
});

// Video phát trong thẻ <video>: ép f_auto/w_ vào là hỏng luồng phát.
test('video giữ nguyên', () => {
  assert.equal(anhCloudinary(VIDEO, 64), VIDEO);
});

test('đường dẫn ngoài Cloudinary giữ nguyên', () => {
  const ngoai = 'https://img.clerk.com/abc.png';
  assert.equal(anhCloudinary(ngoai, 64), ngoai);
  assert.equal(anhCloudinary('blob:http://localhost/xyz', 64), 'blob:http://localhost/xyz');
});

// Ô Hinh_Anh trong sheet có thể rỗng / gõ tay linh tinh; đừng để nổ giữa lúc render bảng.
test('giá trị rác trả về nguyên trạng', () => {
  assert.equal(anhCloudinary('', 64), '');
  assert.equal(anhCloudinary(null, 64), null);
  assert.equal(anhCloudinary(undefined, 64), undefined);
});

test('chiều rộng không hợp lệ thì không đụng vào đường dẫn', () => {
  [0, -10, 1.5, '64', null, undefined, NaN].forEach(w =>
    assert.equal(anhCloudinary(ANH, w), ANH, `phải giữ nguyên với rộng = ${w}`));
});

// Ảnh upload không kèm số phiên bản: đoạn ngay sau /upload/ là tên thư mục, không phải
// tham số. Nhầm nó thành tham số là ảnh không bao giờ được thu nhỏ.
test('đường dẫn không có số phiên bản vẫn được thu nhỏ', () => {
  assert.equal(
    anhCloudinary('https://res.cloudinary.com/dhhdnqixb/image/upload/phongdephn/abc.jpg', 160),
    'https://res.cloudinary.com/dhhdnqixb/image/upload/f_auto,q_auto,w_160,c_limit/phongdephn/abc.jpg',
  );
});
