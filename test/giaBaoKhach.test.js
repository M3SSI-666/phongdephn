import test from 'node:test';
import assert from 'node:assert/strict';
import { giaBaoKhach, DON_VI_BAN, DON_VI_THUE } from '../src/utils/giaBaoKhach.js';

// Ca chính: sales gõ mỗi con số, đơn vị tự thêm.
test('giaBaoKhach: số trần được thêm đơn vị', () => {
  assert.equal(giaBaoKhach('6.5', DON_VI_BAN), '6.5 tỷ');
  assert.equal(giaBaoKhach('6,5', DON_VI_BAN), '6,5 tỷ');
  assert.equal(giaBaoKhach('7', DON_VI_BAN), '7 tỷ');
  assert.equal(giaBaoKhach('15', DON_VI_THUE), '15 triệu/tháng');
});

// Giữ đúng dấu thập phân đã gõ — "6,5" là cách viết của người Việt.
test('giaBaoKhach: không đổi dấu phẩy thành dấu chấm', () => {
  assert.equal(giaBaoKhach('6,5', DON_VI_BAN), '6,5 tỷ');
  assert.ok(!giaBaoKhach('6,5', DON_VI_BAN).includes('.'));
});

// Đã gõ kèm chữ nghĩa là đã nói rõ ý, không được tự sửa.
test('giaBaoKhach: có chữ thì giữ nguyên', () => {
  ['6,5 tỷ bao phí', '6.5 tỷ thu về', 'thương lượng', '13,5tr'].forEach(v =>
    assert.equal(giaBaoKhach(v, DON_VI_BAN), v, `phải giữ nguyên "${v}"`));
});

test('giaBaoKhach: rỗng trả rỗng để chỗ gọi rơi về giá của bảng hàng', () => {
  ['', '   ', null, undefined].forEach(v =>
    assert.equal(giaBaoKhach(v, DON_VI_BAN), '', `phải rỗng với "${v}"`));
});

// Giá mặc định đã kèm loại phí, nên giá gõ tay cũng phải kèm — không thì hai căn
// cạnh nhau trong cùng một file ghi hai kiểu.
test('giaBaoKhach: số trần kèm luôn loại phí của căn', () => {
  assert.equal(giaBaoKhach('6.7', DON_VI_BAN, 'thu về'), '6.7 tỷ thu về');
  assert.equal(giaBaoKhach('6.7', DON_VI_BAN, 'bao phí'), '6.7 tỷ bao phí');
});

// Đã gõ trọn câu giá thì không nối thêm gì, kẻo ra "6,5 tỷ bao phí thu về".
test('giaBaoKhach: có chữ thì không nối đuôi phí', () => {
  assert.equal(giaBaoKhach('6,5 tỷ bao phí', DON_VI_BAN, 'thu về'), '6,5 tỷ bao phí');
  assert.equal(giaBaoKhach('thương lượng', DON_VI_BAN, 'thu về'), 'thương lượng');
});

// Căn chưa ghi loại phí thì chỉ có đơn vị, không thừa khoảng trắng cuối.
test('giaBaoKhach: không có loại phí thì chỉ thêm đơn vị', () => {
  assert.equal(giaBaoKhach('6.7', DON_VI_BAN, ''), '6.7 tỷ');
  assert.equal(giaBaoKhach('15', DON_VI_THUE), '15 triệu/tháng');
});
