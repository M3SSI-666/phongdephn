import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGiaThue } from '../src/utils/giaThue.js';

// Bản cũ đọc "13,5tr" ra 5 vì không đổi dấu phẩy trước khi dò số. Giá thuê trong sheet
// phần lớn có dấu phẩy nên lỗi này ảnh hưởng gần hết bảng.
test('dấu phẩy là dấu thập phân, không phải phân cách nghìn', () => {
  assert.equal(parseGiaThue('13,5tr'), 13.5);
  assert.equal(parseGiaThue('13.5tr'), 13.5);
  assert.equal(parseGiaThue('9,5 tr'), 9.5);
  assert.equal(parseGiaThue('16,5TR'), 16.5);
});

test('đọc được các cách ghi thường gặp', () => {
  assert.equal(parseGiaThue('15tr'),    15);
  assert.equal(parseGiaThue('15 tr'),   15);
  assert.equal(parseGiaThue('15'),      15, 'số trần = triệu/tháng');
  assert.equal(parseGiaThue(' 14tr '),  14);
  assert.equal(parseGiaThue('14tr/th'), 14);
  assert.equal(parseGiaThue(15),        15, 'sheet trả về số chứ không phải chuỗi');
});

test('đơn vị tỷ quy về triệu', () => {
  assert.equal(parseGiaThue('1,5 tỷ'), 1500);
  assert.equal(parseGiaThue('2ty'),    2000);
});

// null = không có giá. Trả 0 thì căn đó thành rẻ nhất và chiếm hạng 1 của "top 10 giá tốt".
test('không có giá thì null, không phải 0', () => {
  ['', '   ', 'Thỏa thuận', 'thoả thuận', 'liên hệ', 'LH', '0', '0tr', null, undefined]
    .forEach(v => assert.equal(parseGiaThue(v), null, `phải là null: ${JSON.stringify(v)}`));
});

// Giá ghi dạng khoảng: lấy đầu thấp, vì đó là con số dùng để chào khách.
test('giá ghi dạng khoảng thì lấy đầu thấp', () => {
  assert.equal(parseGiaThue('14-15tr'),   14);
  assert.equal(parseGiaThue('13,5-14tr'), 13.5);
});
