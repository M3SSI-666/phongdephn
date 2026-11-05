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
