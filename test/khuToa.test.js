import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { KHU_TOA, KHU_LABEL, resolveKhu } from '../src/utils/khuToa.js';

const require = createRequire(import.meta.url);
const dataCan = require('../src/data/dataCan.json');

const keyOf = (q, ai = null) => (resolveKhu(ai, q) || {}).key;

test('bên T gồm T18, bên P thì không', () => {
  assert.deepEqual(keyOf('2 ngủ bên T'), 'BenT');
  assert.deepEqual(keyOf('2 ngủ bên P'), 'BenP');
  assert.ok(KHU_TOA.BenT.includes('T18'));
  assert.equal(KHU_TOA.BenP.includes('T18'), false);
});

// Đây là quyết định sản phẩm dễ bị "sửa nhầm cho gọn" nhất: T18 là Park 4 nên
// nó PHẢI ở trong Park Hill, dù mã bắt đầu bằng chữ T.
test('T18 vừa ở bên T vừa ở Park Hill, đó là chủ ý', () => {
  assert.ok(KHU_TOA.BenT.includes('T18'), 'bên T đọc theo mặt chữ');
  assert.ok(KHU_TOA.ParkHill.includes('T18'), 'T18 là Park 4');
  assert.ok(KHU_TOA.Park.includes('T18'));
  assert.equal(KHU_TOA.Times.includes('T18'), false, 'Times là T01-T11, không có T18');
});

test('các cách gõ khác của nhóm mặt chữ', () => {
  assert.equal(keyOf('bên chữ T'), 'BenT');
  assert.equal(keyOf('các tòa bắt đầu bằng chữ P'), 'BenP');
  assert.equal(keyOf('BÊN t'), 'BenT');
});

// Chỗ dễ sai nhất của regex: mấy chữ "bên …" thông thường không được thành bộ lọc tòa.
test('không dính "bên trong", "bên phải", "tòa T05"', () => {
  assert.equal(keyOf('căn góc bên trong'), undefined);
  assert.equal(keyOf('ban công bên phải'), undefined);
  assert.equal(keyOf('bên trái toà'),      undefined);
  assert.equal(keyOf('3PN tòa T05'),       undefined);
  assert.equal(keyOf('2 ngủ trục 12'),     undefined);
});

test('khu vực: hẹp thắng rộng', () => {
  assert.equal(keyOf('park hill'),     'ParkHill');
  assert.equal(keyOf('park premium'),  'ParkPremium');
  assert.equal(keyOf('bên G4'),        'ParkPremium'); // "bên G4" không phải nhóm mặt chữ
  assert.equal(keyOf('khu park'),      'Park');
  assert.equal(keyOf('bên Times'),     'Times');
});

test('AI trả Khu khi câu gõ không có từ khoá nào', () => {
  assert.equal(keyOf('nhà đẹp', 'ParkHill'),     'ParkHill');
  assert.equal(keyOf('nhà đẹp', 'ParkPremium'),  'ParkPremium');
  // AI hay trả "Park Hill" có khoảng trắng thay vì "ParkHill" — vẫn phải nhận.
  assert.equal(keyOf('nhà đẹp', 'Park Hill'),    'ParkHill');
  assert.equal(keyOf('nhà đẹp', 'park premium'), 'ParkPremium');
  assert.equal(keyOf('nhà đẹp', null),            undefined);
  assert.equal(keyOf('nhà đẹp', 'linh tinh'),     undefined);
});

test('mọi nhóm đều có nhãn hiển thị', () => {
  Object.keys(KHU_TOA).forEach(k => assert.ok(KHU_LABEL[k], `thiếu nhãn: ${k}`));
});

// Nhóm nào cũng phải ra căn thật, nếu không thì lọc xong là bảng trắng.
test('mọi mã tòa trong nhóm đều tồn tại trong dataCan.json', () => {
  const thay = new Set();
  for (const c of Object.keys(dataCan.byCode || {})) {
    const m = c.toUpperCase().match(/^([A-Z]+\d{1,2})/);
    if (m) thay.add(m[1]);
  }
  assert.ok(thay.size > 20, 'dataCan.json phải còn dữ liệu');
  assert.equal(thay.has('P04'), false, 'P04 không tồn tại — chính vì thế T18 mới là Park 4');

  for (const [nhom, ds] of Object.entries(KHU_TOA)) {
    for (const toa of ds) assert.ok(thay.has(toa), `${nhom} có tòa không tồn tại: ${toa}`);
  }
});

// BenT và Park cùng có 12 tòa. Trước đây banner phân biệt nhóm bằng cách đếm số tòa,
// nên hai nhóm này sẽ bị hiện nhầm tên nhau — test này khoá lại lý do phải bỏ cách đó.
test('đếm số tòa KHÔNG phân biệt được nhóm', () => {
  assert.equal(KHU_TOA.BenT.length, KHU_TOA.Park.length);
  assert.notDeepEqual(KHU_TOA.BenT, KHU_TOA.Park);
  assert.notEqual(KHU_LABEL.BenT, KHU_LABEL.Park);
});

test('bên T + bên P phủ đúng toàn bộ tòa, không trùng nhau', () => {
  const gop = [...KHU_TOA.BenT, ...KHU_TOA.BenP];
  assert.equal(new Set(gop).size, gop.length, 'không tòa nào ở cả hai bên');
  assert.equal(gop.length, 23);
});
