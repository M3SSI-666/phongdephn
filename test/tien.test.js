import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTienVnd, formatVnd } from '../src/utils/tien.js';

test('parseTienVnd: số trần là nghìn đồng', () => {
  assert.equal(parseTienVnd('300'), 300_000);
  assert.equal(parseTienVnd('500'), 500_000);
  assert.equal(parseTienVnd('250'), 250_000);
  assert.equal(parseTienVnd('1100'), 1_100_000);
  assert.equal(parseTienVnd('0'), 0);
});

test('parseTienVnd: có đuôi thì theo đuôi', () => {
  assert.equal(parseTienVnd('1tr'), 1_000_000);
  assert.equal(parseTienVnd('2.5tr'), 2_500_000);
  assert.equal(parseTienVnd('2,5tr'), 2_500_000);
  assert.equal(parseTienVnd('1 triệu'), 1_000_000);
  assert.equal(parseTienVnd('300k'), 300_000);
  assert.equal(parseTienVnd('1 tỷ'), 1_000_000_000);
});

test('parseTienVnd: dấu chấm phân nhóm nghìn', () => {
  assert.equal(parseTienVnd('1.000'), 1_000_000);      // 1000 nghìn
  assert.equal(parseTienVnd('1.100'), 1_100_000);
});

test('parseTienVnd: không đoán bừa', () => {
  assert.equal(parseTienVnd(''), null);
  assert.equal(parseTienVnd(null), null);
  assert.equal(parseTienVnd('chưa thu'), null);
  assert.equal(parseTienVnd('-'), null);
});

test('parseTienVnd: không ăn nhầm chữ cái của từ kế tiếp', () => {
  // "ti" trong "tiền" không được hiểu là tỉ.
  assert.equal(parseTienVnd('300 tiền'), 300_000);
  assert.equal(parseTienVnd('300 trả sau'), 300_000);
  // "triệu" không bị khớp cụt thành "tr".
  assert.equal(parseTienVnd('2 triệu'), 2_000_000);
});

test('formatVnd', () => {
  assert.equal(formatVnd(0), '0 đ');
  assert.equal(formatVnd(300_000), '300.000 đ');
  assert.equal(formatVnd(25_300_000), '25.300.000 đ');
  assert.equal(formatVnd(1_000_000_000), '1.000.000.000 đ');
});
