import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDienTich, dienTichInRange, formatDienTich } from '../src/utils/dienTich.js';

test('parseDienTich: các cách ghi đơn vị', () => {
  assert.equal(parseDienTich('106m²'), 106);
  assert.equal(parseDienTich('106 m2'), 106);
  assert.equal(parseDienTich('106m'),  106);
  assert.equal(parseDienTich(' 106 '), 106);
  assert.equal(parseDienTich(106),     106);
});

// Đây là lý do không dùng replace(/[^\d.]/g,'') — cách đó biến "75 + 25" thành 7525.
test('parseDienTich: cộng gộp phần chính + logia', () => {
  assert.equal(parseDienTich('75 + 25'),   100);
  assert.equal(parseDienTich('75+25m2'),   100);
  assert.equal(parseDienTich('80 + 12.5'), 92.5);
});

test('parseDienTich: dấu phẩy là thập phân', () => {
  assert.equal(parseDienTich('106,5'),   106.5);
  assert.equal(parseDienTich('106,5m²'), 106.5);
});

// Ô trống phải là null chứ không phải 0, nếu không thì mọi căn thiếu diện tích
// sẽ tự khớp bộ lọc "dưới 80m".
test('parseDienTich: không đọc được thì null, không phải 0', () => {
  [null, undefined, '', '   ', 'chưa rõ', 'm²'].forEach(v =>
    assert.equal(parseDienTich(v), null, `phải là null: ${JSON.stringify(v)}`));
  assert.equal(parseDienTich('0'), 0, 'số 0 viết thẳng vẫn là 0');
});

test('dienTichInRange: trên / dưới / khoảng', () => {
  assert.equal(dienTichInRange('106m²', 100, null), true);   // trên 100
  assert.equal(dienTichInRange('94m²',  100, null), false);
  assert.equal(dienTichInRange('94m²',  null, 100), true);   // dưới 100
  assert.equal(dienTichInRange('106m²', null, 100), false);
  assert.equal(dienTichInRange('94m²',  80,   100), true);   // từ 80 đến 100
  assert.equal(dienTichInRange('106m²', 80,   100), false);
});

test('dienTichInRange: hai đầu là bao gồm', () => {
  assert.equal(dienTichInRange('100m²', 100, null), true);
  assert.equal(dienTichInRange('100m²', null, 100), true);
  assert.equal(dienTichInRange('100m²', 100, 100),  true);
});

test('dienTichInRange: căn cộng gộp so theo TỔNG', () => {
  assert.equal(dienTichInRange('75 + 25', 100, null), true);
  assert.equal(dienTichInRange('75 + 25', null, 80),  false);
});

test('dienTichInRange: không đọc được thì loại, không lọt lưới', () => {
  assert.equal(dienTichInRange('',         null, 200), false);
  assert.equal(dienTichInRange('chưa rõ',  null, 200), false);
  assert.equal(dienTichInRange(null,       null, null), false);
});

test('formatDienTich', () => {
  assert.equal(formatDienTich(106),     '106');
  assert.equal(formatDienTich(106.5),   '106.5');
  assert.equal(formatDienTich(92.55),   '92.6');
  assert.equal(formatDienTich(null),    '');
});
