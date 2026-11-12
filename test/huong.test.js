import test from 'node:test';
import assert from 'node:assert/strict';
import { maHuong, khopHuong } from '../src/utils/huong.js';

test('ký hiệu viết tắt trong sheet', () => {
  assert.equal(maHuong('N'), 'N');
  assert.equal(maHuong('ĐB'), 'ĐB');
  assert.equal(maHuong('TN'), 'TN');
  assert.equal(maHuong('Đ-N'), 'ĐN');
  assert.equal(maHuong('Đ·N'), 'ĐN');
  assert.equal(maHuong('dn'), 'ĐN');
  assert.equal(maHuong('Đ·'), 'Đ');   // có 1 căn gõ lỡ dấu chấm sau Đ
});

test('chữ đầy đủ khách gõ', () => {
  assert.equal(maHuong('Nam'), 'N');
  assert.equal(maHuong('nam'), 'N');
  assert.equal(maHuong('Đông Nam'), 'ĐN');
  assert.equal(maHuong('dong nam'), 'ĐN');
  assert.equal(maHuong('Tây Bắc'), 'TB');
  assert.equal(maHuong('BẮC'), 'B');
});

test('không đọc ra hướng thì null', () => {
  for (const x of [null, undefined, '', '  ', 'view hồ', 'xyz']) assert.equal(maHuong(x), null, String(x));
});

test('tìm "Nam" ra căn N — lỗi 0 căn vì sheet lưu ký hiệu', () => {
  assert.equal(khopHuong('N', 'Nam'), true);
  assert.equal(khopHuong('N', 'nam'), true);
});

test('Nam không lẫn sang Đông Nam / Tây Nam', () => {
  assert.equal(khopHuong('ĐN', 'Nam'), false);
  assert.equal(khopHuong('TN', 'Nam'), false);
  assert.equal(khopHuong('ĐN', 'Đông Nam'), true);
  assert.equal(khopHuong('Đ-N', 'Đông Nam'), true);
});

test('căn chưa có hướng thì không khớp', () => {
  assert.equal(khopHuong('', 'Nam'), false);
  assert.equal(khopHuong(null, 'Nam'), false);
});
