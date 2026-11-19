import test from 'node:test';
import assert from 'node:assert/strict';
import { maCanTelegram, tinMaCan, themSo0, mediaTelegram, RONG_ANH_TELEGRAM } from '../src/utils/telegramCan.js';

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

// Trái tim chỉ gắn vào chuỗi GỬI ĐI, không gắn vào mã trần dùng trong app.
test('tinMaCan: trái tim đứng trước mã căn', () => {
  assert.equal(tinMaCan('T081903'), '❤️ T081903');
  assert.equal(tinMaCan('t092612a'), '❤️ T092612A');
});

test('tinMaCan: không có mã thì không trả về mỗi trái tim', () => {
  ['', '   ', null, undefined].forEach(v =>
    assert.equal(tinMaCan(v), '', `phải rỗng với "${v}"`));
});

test('maCanTelegram vẫn trả mã trần, không dính trái tim', () => {
  assert.equal(maCanTelegram('T081903'), 'T081903');
});

// "❤️ MÃ - SĐT - TÊN CHỦ" trên một dòng.
test('tinMaCan: mã căn - SĐT - tên chủ', () => {
  assert.equal(tinMaCan('P110312A', '0971 524 525', 'A Hoan'),
    '❤️ P110312A - 0971 524 525 - A Hoan');
});

// Ô SĐT hay chứa hai số xuống dòng — gộp lại, không thì tin vỡ bố cục.
test('tinMaCan: gộp xuống dòng trong ô SĐT', () => {
  assert.equal(tinMaCan('P110312A', '0967883663\n0899997888', ''),
    '❤️ P110312A - 0967883663 0899997888');
});

// Thiếu phần nào thì bỏ hẳn, không để dấu gạch mồ côi.
test('tinMaCan: thiếu SĐT hoặc tên chủ', () => {
  assert.equal(tinMaCan('P110312A', '', 'A Hoan'), '❤️ P110312A - A Hoan');
  assert.equal(tinMaCan('P110312A', '0971524525', ''), '❤️ P110312A - 0971524525');
  assert.equal(tinMaCan('P110312A', '', ''), '❤️ P110312A');
});

test('tinMaCan: không có mã thì rỗng dù có SĐT', () => {
  assert.equal(tinMaCan('', '0971 524 525', 'A Hoan'), '');
});

// Ô SĐT trong Google Sheet hay bị hiểu là SỐ nên mất số 0 đầu (gặp thật 11/11:
// "T071606 - 937738788"). Tin gửi đi phải tự bù số 0.
test('themSo0: SĐT mất số 0 đầu thì thêm vào', () => {
  assert.equal(themSo0('937738788'), '0937738788');
  assert.equal(themSo0(937738788), '0937738788');          // ô sheet trả về kiểu số
  assert.equal(themSo0('0937738788'), '0937738788');       // đủ số 0 thì giữ nguyên
  assert.equal(themSo0('0971 524 525'), '0971 524 525');   // dạng có cách giữ nguyên
  assert.equal(themSo0('967883663\n899997888'), '0967883663\n0899997888');
  assert.equal(themSo0('+84937738788'), '0937738788');
  assert.equal(themSo0('84937738788'), '0937738788');
  assert.equal(themSo0(''), '');
  assert.equal(themSo0(null), '');
});

test('themSo0: không đụng dãy số không phải SĐT di động', () => {
  assert.equal(themSo0('123456789'), '123456789');         // đầu 1 không phải đầu số di động
  assert.equal(themSo0('9377387881'), '9377387881');       // 10 chữ số, không phải thiếu 0
  assert.equal(themSo0('A Hoan'), 'A Hoan');
});

test('tinMaCan: SĐT thiếu số 0 được bù, đủ 3 phần mã - SĐT - tên chủ', () => {
  assert.equal(tinMaCan('T071606', '937738788', 'Chị Lan'), '❤️ T071606 - 0937738788 - Chị Lan');
  assert.equal(tinMaCan('T071606', 937738788, ''), '❤️ T071606 - 0937738788');
});
