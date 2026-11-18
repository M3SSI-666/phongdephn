import test from 'node:test';
import assert from 'node:assert/strict';
import { buAnhBangCon } from '../src/utils/bangConAnh.js';

const chinh = [
  { Ma_Can: 'P051510', Hinh_Anh: 'a.jpg,b.jpg' },
  { Ma_Can: 'P053410', Hinh_Anh: '' },
];

test('dòng con chưa có ảnh thì mượn ảnh bảng chính', () => {
  const con = [{ Ma_Can: 'P051510', Hinh_Anh: '', Gia_Net: '6.3 tỷ' }];
  const ra = buAnhBangCon(con, chinh);
  assert.equal(ra[0].Hinh_Anh, 'a.jpg,b.jpg');
  assert.equal(ra[0].Gia_Net, '6.3 tỷ');          // không đụng các cột khác
  assert.equal(con[0].Hinh_Anh, '');              // không sửa mảng gốc
});

test('dòng con đã có ảnh riêng thì giữ nguyên', () => {
  const con = [{ Ma_Can: 'P051510', Hinh_Anh: 'rieng.jpg' }];
  assert.equal(buAnhBangCon(con, chinh)[0].Hinh_Anh, 'rieng.jpg');
});

test('khớp mã căn bất kể hoa thường, khoảng trắng', () => {
  const con = [{ Ma_Can: ' p05 1510 ', Hinh_Anh: '' }];
  assert.equal(buAnhBangCon(con, chinh)[0].Hinh_Anh, 'a.jpg,b.jpg');
});

test('bảng chính cũng không có ảnh, hoặc không có căn đó: để trống', () => {
  const con = [{ Ma_Can: 'P053410', Hinh_Anh: '' }, { Ma_Can: 'T999999', Hinh_Anh: '' }];
  const ra = buAnhBangCon(con, chinh);
  assert.equal(ra[0].Hinh_Anh, '');
  assert.equal(ra[1].Hinh_Anh, '');
});

test('không đổi gì thì trả lại đúng mảng cũ', () => {
  const con = [{ Ma_Can: 'P051510', Hinh_Anh: 'rieng.jpg' }];
  assert.equal(buAnhBangCon(con, chinh), con);
  assert.equal(buAnhBangCon(con, []), con);
});

// P03-0611: bảng con còn sót rác trong ô Ảnh -> phải bù, không thì Telegram gửi 0 ảnh.
test('ô Ảnh bản con chỉ có video cũ hoặc dấu phẩy thừa thì vẫn bù', () => {
  const chinh2 = [{ Ma_Can: 'P030611', Hinh_Anh: 'p1.jpg, p2.jpg' }];
  for (const rac of [' , ', ',', 'https://res.cloudinary.com/x/video/upload/v1/a.mp4']) {
    const ra = buAnhBangCon([{ Ma_Can: 'P030611', Hinh_Anh: rac }], chinh2);
    assert.equal(ra[0].Hinh_Anh, 'p1.jpg, p2.jpg', JSON.stringify(rac));
  }
});

test('bảng chính chỉ có video thì không đem về', () => {
  const ra = buAnhBangCon([{ Ma_Can: 'A', Hinh_Anh: '' }], [{ Ma_Can: 'A', Hinh_Anh: 'x/video/upload/a.mp4' }]);
  assert.equal(ra[0].Hinh_Anh, '');
});
