import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  parseMaCan, tangToNumber, normalizeTruc, maCanTrucMatch, maCanTangInRange,
} from '../src/utils/maCan.js';

const require = createRequire(import.meta.url);
const dataCan = require('../src/data/dataCan.json');

test('parseMaCan: bốn dạng mã chuẩn', () => {
  assert.deepEqual(parseMaCan('T010301'),   { toa: 'T01', tang: '03',  truc: '01'  });
  assert.deepEqual(parseMaCan('T0112B11'),  { toa: 'T01', tang: '12B', truc: '11'  });
  assert.deepEqual(parseMaCan('T010312A'),  { toa: 'T01', tang: '03',  truc: '12A' });
  assert.deepEqual(parseMaCan('T0112A12A'), { toa: 'T01', tang: '12A', truc: '12A' });
});

// Chuỗi 5 ký tự sau mã tòa cắt ở đâu là chỗ dễ sai nhất: cùng độ dài, khác chỗ cắt.
test('parseMaCan: vị trí chữ cái quyết định chỗ cắt', () => {
  assert.deepEqual(parseMaCan('T0112B11'), { toa: 'T01', tang: '12B', truc: '11'  });
  assert.deepEqual(parseMaCan('T011112B'), { toa: 'T01', tang: '11',  truc: '12B' });
});

test('parseMaCan: chuẩn hoá khoảng trắng và chữ thường', () => {
  assert.deepEqual(parseMaCan(' t0112b11 '), { toa: 'T01', tang: '12B', truc: '11' });
});

// Shophouse và rác phải bị loại hẳn, không được đoán bừa thành tầng "SH0" hay "DT".
test('parseMaCan: loại mã không theo cấu trúc', () => {
  ['P01SH0102', 'P02S11', 'SHCDT18', 'P12S12A', '46298', '', null, undefined, 'T0103']
    .forEach(c => assert.equal(parseMaCan(c), null, `phải loại: ${c}`));
});

test('tangToNumber: 12A là tầng 13, 12B là tầng 14', () => {
  assert.equal(tangToNumber('12'),  12);
  assert.equal(tangToNumber('12A'), 13);
  assert.equal(tangToNumber('12B'), 14);
  assert.equal(tangToNumber('15'),  15);
  assert.equal(tangToNumber('02'),  2);
  assert.equal(tangToNumber('SH0'), null);
});

test('tangToNumber: 12 -> 12A -> 12B -> 15 là dãy liền mạch', () => {
  assert.deepEqual(['12', '12A', '12B', '15'].map(tangToNumber), [12, 13, 14, 15]);
});

test('normalizeTruc: đệm số 0 và viết hoa', () => {
  assert.equal(normalizeTruc('5'),   '05');
  assert.equal(normalizeTruc(5),     '05');
  assert.equal(normalizeTruc('12'),  '12');
  assert.equal(normalizeTruc('12a'), '12A');
  assert.equal(normalizeTruc('abc'), null);
  assert.equal(normalizeTruc(''),    null);
});

// Quyết định sản phẩm: 12, 12A, 12B là ba trục riêng, không gộp.
test('maCanTrucMatch: trục 12 không kéo theo 12A/12B', () => {
  assert.equal(maCanTrucMatch('T010312',  '12'), true);
  assert.equal(maCanTrucMatch('T010312A', '12'), false);
  assert.equal(maCanTrucMatch('T010312B', '12'), false);
  assert.equal(maCanTrucMatch('T010312A', '12A'), true);
});

test('maCanTrucMatch: gõ trục 1 chữ số vẫn khớp mã đệm 0', () => {
  assert.equal(maCanTrucMatch('T010301', '1'), true);
  assert.equal(maCanTrucMatch('T010301', '01'), true);
});

test('maCanTrucMatch: trục không đụng vào phần tầng', () => {
  // Tầng 12B, trục 11 — tìm trục 12B phải KHÔNG ra căn này.
  assert.equal(maCanTrucMatch('T0112B11', '12B'), false);
  assert.equal(maCanTrucMatch('T0112B11', '11'),  true);
});

test('maCanTangInRange: khoảng tầng bao trùm 12A/12B', () => {
  assert.equal(maCanTangInRange('T010312',  12, 15), false); // tầng 03, trục 12 -> ngoài
  assert.equal(maCanTangInRange('T011201',  12, 15), true);  // tầng 12
  assert.equal(maCanTangInRange('T0112A01', 12, 15), true);  // 12A = 13
  assert.equal(maCanTangInRange('T0112B01', 12, 15), true);  // 12B = 14
  assert.equal(maCanTangInRange('T011501',  12, 15), true);
  assert.equal(maCanTangInRange('T011601',  12, 15), false);
});

test('maCanTangInRange: tầng 3 tới 5 loại đúng 12A/12B', () => {
  assert.equal(maCanTangInRange('T0112A01', 3, 5), false);
  assert.equal(maCanTangInRange('T010401',  3, 5), true);
});

test('maCanTangInRange: để trống một đầu là không chặn đầu đó', () => {
  assert.equal(maCanTangInRange('T013001', 20, null), true);
  assert.equal(maCanTangInRange('T010301', 20, null), false);
  assert.equal(maCanTangInRange('T010301', null, 5),  true);
  assert.equal(maCanTangInRange('T013001', null, 5),  false);
});

test('maCanTangInRange: mã hỏng thì loại, không lọt lưới', () => {
  assert.equal(maCanTangInRange('P01SH0102', null, null), false);
});

// Chốt chặn thật sự: chạy trên toàn bộ mã căn đang dùng, không phải mã tự nghĩ ra.
test('đối chiếu 12.556 mã căn thật trong dataCan.json', () => {
  const codes = Object.keys(dataCan.byCode || {});
  assert.ok(codes.length > 12000, 'dataCan.json phải còn dữ liệu');

  let parsed = 0;
  const tangThay = new Set();
  for (const code of codes) {
    const p = parseMaCan(code);
    if (p == null) continue;
    parsed++;
    tangThay.add(p.tang);
    // Ghép ngược lại phải ra đúng mã ban đầu — chứng minh không nuốt/đẻ ký tự.
    assert.equal(p.toa + p.tang + p.truc, code.toUpperCase());
  }

  // 185 mã shophouse/rác bị loại, phần còn lại phải parse hết.
  assert.equal(parsed, codes.length - 185);

  // Nếu 12A/12B thật sự là 13/14 thì không đâu được có tầng 13 hay 14 viết thẳng.
  assert.equal(tangThay.has('13'), false, 'không được tồn tại tầng 13');
  assert.equal(tangThay.has('14'), false, 'không được tồn tại tầng 14');
  assert.equal(tangThay.has('12A'), true);
  assert.equal(tangThay.has('12B'), true);
});
