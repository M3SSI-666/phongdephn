import test from 'node:test';
import assert from 'node:assert/strict';
import { maCanTelegram, mediaTelegram, RONG_ANH_TELEGRAM } from '../src/utils/telegramCan.js';

// Mã gửi lên Telegram phải trùng khít mã trong sheet: ghi liền, không gạch nối.
test('maCanTelegram: giữ nguyên mã, không chèn gạch', () => {
  assert.equal(maCanTelegram('T081903'),  'T081903');
  assert.equal(maCanTelegram('T092612A'), 'T092612A');
  assert.equal(maCanTelegram('P010204'),  'P010204');
  assert.equal(maCanTelegram('t081903'),  'T081903');   // tự viết hoa
  assert.equal(maCanTelegram('  T081903  '), 'T081903'); // tự cắt khoảng trắng
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
