import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNoteDate, noteDateFlag, toDayKey, noteDayKey } from '../src/utils/khachDate.js';

// Các chuỗi lấy nguyên từ cột Check In / Check Out đang dùng thật.
test('parseNoteDate: đọc được các kiểu gõ thực tế', () => {
  assert.deepEqual(parseNoteDate('12h30 10/8'), { d: 10, m: 8, y: null });
  assert.deepEqual(parseNoteDate('10h 9/8'), { d: 9, m: 8, y: null });
  assert.deepEqual(parseNoteDate('8/8'), { d: 8, m: 8, y: null });
  assert.deepEqual(parseNoteDate('14h 8/8'), { d: 8, m: 8, y: null });
  assert.deepEqual(parseNoteDate('1/9'), { d: 1, m: 9, y: null });
  assert.deepEqual(parseNoteDate('20/8/2026'), { d: 20, m: 8, y: 2026 });
  assert.deepEqual(parseNoteDate('15/04/2025'), { d: 15, m: 4, y: 2025 });
  assert.deepEqual(parseNoteDate('14:00 15/8'), { d: 15, m: 8, y: null });
  assert.deepEqual(parseNoteDate('10/8/25'), { d: 10, m: 8, y: 2025 });
});

test('parseNoteDate: không đoán bừa', () => {
  assert.equal(parseNoteDate(''), null);
  assert.equal(parseNoteDate(null), null);
  assert.equal(parseNoteDate('Tháng 5'), null);
  assert.equal(parseNoteDate('dài hạn'), null);
  assert.equal(parseNoteDate('8h'), null);
  assert.equal(parseNoteDate('8/2026'), null);   // tháng/năm, không phải ngày
  assert.equal(parseNoteDate('32/8'), null);
  assert.equal(parseNoteDate('10/13'), null);
  // Giờ viết liền không được hiểu thành ngày.
  assert.equal(parseNoteDate('12h30/8'), null);
});

const at = (y, m, d) => new Date(y, m - 1, d);

test('noteDateFlag: hôm nay đỏ, ngày mai xanh lime', () => {
  const now = at(2026, 8, 9);
  assert.equal(noteDateFlag('10h 9/8', now), 'today');
  assert.equal(noteDateFlag('9/8', now), 'today');
  assert.equal(noteDateFlag('12h30 10/8', now), 'soon');
  assert.equal(noteDateFlag('11/8', now), null);
  assert.equal(noteDateFlag('8/8', now), null);     // đã qua
  assert.equal(noteDateFlag('Tháng 5', now), null);
});

test('noteDateFlag: có ghi năm thì năm phải khớp', () => {
  const now = at(2026, 8, 9);
  assert.equal(noteDateFlag('9/8/2026', now), 'today');
  assert.equal(noteDateFlag('10/8/2026', now), 'soon');
  assert.equal(noteDateFlag('9/8/2025', now), null);
  assert.equal(noteDateFlag('20/8/2026', now), null);
});

test('noteDateFlag: qua mốc tháng và mốc năm', () => {
  assert.equal(noteDateFlag('1/9', at(2026, 8, 31)), 'soon');
  assert.equal(noteDateFlag('31/8', at(2026, 8, 31)), 'today');
  // Không ghi năm, đêm giao thừa: "1/1" là ngày mai chứ không phải 1/1 năm nay.
  assert.equal(noteDateFlag('1/1', at(2026, 12, 31)), 'soon');
  assert.equal(noteDateFlag('29/2', at(2028, 2, 28)), 'soon');   // năm nhuận
});

test('noteDayKey: khoá ngày để so khoảng', () => {
  const now = at(2026, 8, 9);
  assert.equal(noteDayKey('09/08/2026', now), '2026-08-09');
  assert.equal(noteDayKey('9/8/2026', now), '2026-08-09');
  assert.equal(noteDayKey('1/9', now), '2026-09-01');       // thiếu năm -> năm hiện tại
  assert.equal(noteDayKey('Tháng 5', now), null);
  assert.equal(noteDayKey('', now), null);
  // Khoá sắp xếp được bằng so chuỗi — đây là điều kiện để lọc khoảng ngày chạy đúng.
  assert.ok(noteDayKey('01/09/2026', now) > noteDayKey('31/08/2026', now));
  assert.ok(noteDayKey('01/01/2027', now) > noteDayKey('31/12/2026', now));
});

test('toDayKey khớp định dạng của input type=date', () => {
  assert.equal(toDayKey(at(2026, 8, 9)), '2026-08-09');
  assert.equal(toDayKey(at(2026, 12, 31)), '2026-12-31');
});

test('noteDateFlag: giờ trong ngày không ảnh hưởng', () => {
  assert.equal(noteDateFlag('12h 9/8', new Date(2026, 7, 9, 23, 59)), 'today');
  assert.equal(noteDateFlag('12h 9/8', new Date(2026, 7, 9, 0, 1)), 'today');
});
