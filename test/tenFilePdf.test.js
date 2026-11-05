import test from 'node:test';
import assert from 'node:assert/strict';
import { tenFilePdf } from '../src/utils/tenFilePdf.js';

test('tenFilePdf: Times City_ngày_tên khách', () => {
  assert.equal(tenFilePdf('2026-11-05', 'Linh Hoàng'), 'Times City_05-11-2026_Linh Hoàng.pdf');
});

// Giữ dấu tiếng Việt: tên khách đọc được mới có ích khi tìm lại file.
test('tenFilePdf: giữ nguyên dấu tiếng Việt', () => {
  assert.ok(tenFilePdf('2026-11-05', 'Nguyễn Thị Đào').includes('Nguyễn Thị Đào'));
});

test('tenFilePdf: không có tên khách thì bỏ phần đó', () => {
  assert.equal(tenFilePdf('2026-11-05', ''), 'Times City_05-11-2026.pdf');
  assert.equal(tenFilePdf('2026-11-05', '   '), 'Times City_05-11-2026.pdf');
});

// Windows cấm \ / : * ? " < > | trong tên file. Lọt một cái là trình duyệt lặng lẽ
// đổi tên hoặc không tải được, mà không báo gì.
test('tenFilePdf: bỏ ký tự Windows cấm', () => {
  const t = tenFilePdf('2026-11-05', 'A/B:C*D?E"F<G>H|I\\J');
  assert.equal(t, 'Times City_05-11-2026_ABCDEFGHIJ.pdf');
  [...'\\/:*?"<>|'].forEach(c => assert.ok(!t.includes(c), `còn sót "${c}"`));
});

test('tenFilePdf: gộp khoảng trắng thừa', () => {
  assert.equal(tenFilePdf('2026-11-05', '  Linh   Hoàng  '), 'Times City_05-11-2026_Linh Hoàng.pdf');
});

// Ngày sai dạng thì bỏ hẳn, không ghép ra tên file kỳ quặc.
test('tenFilePdf: ngày rỗng hoặc sai dạng thì bỏ', () => {
  assert.equal(tenFilePdf('', 'Linh'), 'Times City_Linh.pdf');
  assert.equal(tenFilePdf('hôm qua', 'Linh'), 'Times City_Linh.pdf');
  assert.equal(tenFilePdf('', ''), 'Times City.pdf');
});
