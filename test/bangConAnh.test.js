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
