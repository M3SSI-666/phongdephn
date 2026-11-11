import test from 'node:test';
import assert from 'node:assert/strict';
import { veKhoanhDo, matBangSach, khungTrucCan, trucCuaCan, coBanDo } from '../src/utils/matBangTruc.js';

test('tòa đã đo -> có khung và có mặt bằng nền', () => {
  assert.equal(matBangSach('T011201'), '/mat-bang/truc/T01.jpg');
  assert.ok(khungTrucCan('T011201'));
  assert.equal(trucCuaCan('T011201').truc, '01');
});

test('mọi tầng cùng trục cho cùng một khung', () => {
  const k = JSON.stringify(khungTrucCan('T010501'));
  for (const ma of ['T011201', 'T012701', 'T0112A01']) {
    assert.equal(JSON.stringify(khungTrucCan(ma)), k, ma);
  }
});

test('trục 12A và 12B là ba căn riêng với trục 12', () => {
  const a = JSON.stringify(khungTrucCan('T010312'));
  const b = JSON.stringify(khungTrucCan('T010312A'));
  const c = JSON.stringify(khungTrucCan('T010312B'));
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
});

test('tòa T1 không có trục 13, 14', () => {
  assert.equal(khungTrucCan('T010313'), null);
  assert.equal(khungTrucCan('T010314'), null);
});

test('tòa chưa đo thì trả null để rơi về mặt bằng tòa như cũ', () => {
  assert.equal(matBangSach('P110312A'), null);
  assert.equal(khungTrucCan('P110312A'), null);
  assert.equal(coBanDo('P11'), false);
  assert.equal(coBanDo('T01'), true);
});

test('mã căn hỏng không làm văng', () => {
  for (const x of [null, undefined, '', '   ', 'abc', '46298', 'P01SH0102', 'P062X16']) {
    assert.equal(khungTrucCan(x), null);
    assert.equal(matBangSach(x), null);
    assert.equal(trucCuaCan(x), null);
  }
});

test('khung ra đơn vị %, nằm gọn trong ảnh', () => {
  const k = khungTrucCan('T011201');
  assert.deepEqual(Object.keys(k).sort(), ['height', 'left', 'top', 'width']);
  for (const v of Object.values(k)) assert.match(v, /^\d+(\.\d+)?%$/);
  const so = s => parseFloat(s);
  assert.ok(so(k.left) + so(k.width) <= 100.01, 'khung tràn ngang');
  assert.ok(so(k.top) + so(k.height) <= 100.01, 'khung tràn dọc');
});

test('18 trục của T1 đều có khung, không khung nào rỗng', () => {
  const trucs = ['01','02','03','04','05','06','07','08','09','10','11','12','12A','12B','15','16','17','18'];
  for (const t of trucs) {
    const k = khungTrucCan(`T0103${t}`);
    assert.ok(k, `thiếu trục ${t}`);
    assert.ok(parseFloat(k.width) > 1 && parseFloat(k.height) > 1, `trục ${t} khung rỗng`);
  }
});

test('ngoài trình duyệt thì veKhoanhDo trả rỗng chứ không văng', async () => {
  assert.equal(await veKhoanhDo('T011201'), '');
  assert.equal(await veKhoanhDo('P110312A'), '');
  assert.equal(await veKhoanhDo(''), '');
});
