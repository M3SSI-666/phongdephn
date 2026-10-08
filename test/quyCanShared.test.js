import test from 'node:test';
import assert from 'node:assert/strict';
import {
  phiBaoPhi, mapPhi, normalizeThietKe,
  nhanNhomThietKe, soSanhNhomThietKe, NHOM_DAP_THONG, NHOM_CHUA_RO,
} from '../src/utils/quyCanShared.js';

test('phiBaoPhi: bốn mức phí theo số phòng ngủ', () => {
  assert.equal(phiBaoPhi('1PN'), 100);
  assert.equal(phiBaoPhi('2PN'), 150);
  assert.equal(phiBaoPhi('3PN'), 200);
  assert.equal(phiBaoPhi('4PN'), 300);
});

test('phiBaoPhi: đọc được mọi cách ghi số phòng ngủ', () => {
  assert.equal(phiBaoPhi('2N'),        150);
  assert.equal(phiBaoPhi('2 PN'),      150);
  assert.equal(phiBaoPhi('2pn'),       150);
  assert.equal(phiBaoPhi(' 3PN '),     200);
  assert.equal(phiBaoPhi('3PN + 1'),   200, 'lấy số ĐẦU TIÊN, "+1" là phòng đa năng');
  assert.equal(phiBaoPhi('3PN2WC'),    200);
});

// 5PN trở lên là căn hiếm, không có mức phí riêng -> lấy mức cao nhất đang biết.
test('phiBaoPhi: 5PN trở lên lấy mức 4PN', () => {
  assert.equal(phiBaoPhi('5PN'),  300);
  assert.equal(phiBaoPhi('6PN'),  300);
  assert.equal(phiBaoPhi('10PN'), 300);
});

// null = KHÔNG trừ gì cả, cột tr/m² giữ nguyên công thức Giá/m² như trước.
// Đoán bừa một mức phí lên căn không rõ thiết kế thì sai số nằm thẳng trong con số
// người dùng nhìn để định giá.
test('phiBaoPhi: không đọc được số phòng ngủ thì null, không đoán bừa', () => {
  ['Studio', 'studio', '', '   ', 'chưa rõ', 'Duplex', '0PN', null, undefined]
    .forEach(v => assert.equal(phiBaoPhi(v), null, `phải là null: ${JSON.stringify(v)}`));
});

// trPerM2 gọi mapPhi(item.Phi) chứ không so thẳng item.Phi === 'Bao phí',
// vì file công ty import vào ghi tắt "BP"/"TV".
test('mapPhi: viết tắt trong file import phải ra đúng nhãn', () => {
  assert.equal(mapPhi('BP'), 'Bao phí');
  assert.equal(mapPhi('bp'), 'Bao phí');
  assert.equal(mapPhi(' TV '), 'Thu về');
  assert.equal(mapPhi('Bao phí'), 'Bao phí');
  assert.equal(mapPhi('Thu về'), 'Thu về');
  assert.equal(mapPhi(''), '');
});

test('normalizeThietKe: "2N" là cách ghi khác của "2PN"', () => {
  assert.equal(normalizeThietKe('2N'),  '2PN');
  assert.equal(normalizeThietKe('2 n'), '2PN');
  assert.equal(normalizeThietKe('2PN'), '2PN');
  assert.equal(normalizeThietKe('Studio'), 'Studio');
  assert.equal(normalizeThietKe(''), '');
});

test('nhanNhomThietKe: mọi cách ghi số phòng ngủ về cùng một dải', () => {
  assert.equal(nhanNhomThietKe('2PN'), '2N');
  assert.equal(nhanNhomThietKe('2N'),  '2N');
  assert.equal(nhanNhomThietKe('2 pn'), '2N');
  assert.equal(nhanNhomThietKe('1PN'), '1N');
  assert.equal(nhanNhomThietKe('5PN'), '5N');
});

// Thiết kế không đọc ra số phòng ngủ phải giữ nguyên chữ — gom "2N1VS" vào "2N" là
// nói sai căn đó có gì. Hai giá trị này đang có thật trong sheet.
test('nhanNhomThietKe: thiết kế lạ giữ nguyên chữ', () => {
  assert.equal(nhanNhomThietKe('Duplex'), 'Duplex');
  assert.equal(nhanNhomThietKe('2N1VS'), '2N1VS');
  assert.equal(nhanNhomThietKe(NHOM_DAP_THONG), NHOM_DAP_THONG);
});

test('nhanNhomThietKe: ô trống thành dải "Chưa rõ"', () => {
  ['', '   ', null, undefined].forEach(v =>
    assert.equal(nhanNhomThietKe(v), NHOM_CHUA_RO, `phải ra Chưa rõ với "${v}"`));
});

test('soSanhNhomThietKe: 1N - 2N - 3N - 4N rồi mới tới Đập thông', () => {
  const sap = ['Chưa rõ', 'Duplex', NHOM_DAP_THONG, '3N', '1N', '10N', '2N', '4N']
    .sort(soSanhNhomThietKe);
  assert.deepEqual(sap,
    ['1N', '2N', '3N', '4N', '10N', NHOM_DAP_THONG, 'Duplex', NHOM_CHUA_RO]);
});

// So theo SỐ chứ không theo chữ: sắp chuỗi thì "10N" chen lên trước "2N".
test('soSanhNhomThietKe: 10N xếp sau 2N', () => {
  assert.ok(soSanhNhomThietKe('2N', '10N') < 0);
});
