import test from 'node:test';
import assert from 'node:assert/strict';
import { maCanTelegram, mediaTelegram, RONG_ANH_TELEGRAM } from '../src/utils/telegramCan.js';

// Mã căn gửi vào nhóm phải trùng kiểu đã gõ tay bấy lâu, không thì tìm trong Telegram
// ra hai kiểu mã cho cùng một căn.
test('maCanTelegram: chèn gạch sau tòa', () => {
  assert.equal(maCanTelegram('T081903'),  'T08-1903');
  assert.equal(maCanTelegram('T092612A'), 'T09-2612A');
  assert.equal(maCanTelegram('P010204'),  'P01-0204');
  assert.equal(maCanTelegram('t081903'),  'T08-1903');  // tự viết hoa
});

// Mã lạ thì giữ nguyên, chèn gạch bừa vào là tạo ra mã không tồn tại.
test('maCanTelegram: mã không khớp dạng thì giữ nguyên', () => {
  ['', 'ABC', 'T0', '1234'].forEach(v =>
    assert.equal(maCanTelegram(v), v.toUpperCase().trim(), `phải giữ nguyên "${v}"`));
});

test('maCanTelegram: giá trị rác không làm vỡ', () => {
  [null, undefined].forEach(v => assert.equal(maCanTelegram(v), ''));
});

test('mediaTelegram: tách URL và thu nhỏ ảnh', () => {
  const a = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg';
  const b = 'https://res.cloudinary.com/demo/image/upload/v1/b.jpg';
  const kq = mediaTelegram(`${a}, ${b}`);
  assert.equal(kq.length, 2);
  kq.forEach(u => assert.ok(u.includes(`w_${RONG_ANH_TELEGRAM}`), `phải có w_: ${u}`));
});

// Video phải đi qua nguyên vẹn — chèn tham số ảnh vào URL video là Cloudinary trả 400.
test('mediaTelegram: video giữ nguyên', () => {
  const v = 'https://res.cloudinary.com/demo/video/upload/v1/c.mp4';
  assert.deepEqual(mediaTelegram(v), [v]);
});

test('mediaTelegram: ô rỗng trả mảng rỗng', () => {
  ['', null, undefined, '  ,  ,'].forEach(v =>
    assert.deepEqual(mediaTelegram(v), [], `phải rỗng với "${v}"`));
});
