import test from 'node:test';
import assert from 'node:assert/strict';
import { anhTrucCan, anhTrucCanTuyetDoi, matBangSach, khungTrucCan, trucCuaCan, coBanDo } from '../src/utils/matBangTruc.js';

test('đường dẫn gửi Telegram phải tuyệt đối', () => {
  assert.equal(anhTrucCanTuyetDoi('T011201', 'https://phongdephn.vercel.app'),
    'https://phongdephn.vercel.app/mat-bang/truc/T01-01.jpg');
  // thừa dấu / ở cuối không đẻ ra //
  assert.equal(anhTrucCanTuyetDoi('T011201', 'https://phongdephn.vercel.app/'),
    'https://phongdephn.vercel.app/mat-bang/truc/T01-01.jpg');
});

test('không có gốc http thì trả rỗng, không gửi đường dẫn Telegram không mở được', () => {
  for (const g of [undefined, null, '', '/', 'phongdephn.vercel.app', 'file:///C:/x'])
    assert.equal(anhTrucCanTuyetDoi('T011201', g), '');
  assert.equal(anhTrucCanTuyetDoi('P110312A', 'https://phongdephn.vercel.app'), '');
});

test('mã căn tòa đã cắt -> ảnh đúng trục', () => {
  assert.equal(anhTrucCan('T011201'), '/mat-bang/truc/T01-01.jpg');
  assert.equal(anhTrucCan('T010518'), '/mat-bang/truc/T01-18.jpg');
});

test('mọi tầng cùng trục dùng chung một ảnh', () => {
  const a = anhTrucCan('T010501');
  assert.equal(anhTrucCan('T011201'), a);
  assert.equal(anhTrucCan('T012701'), a);
  assert.equal(anhTrucCan('T0112A01'), a);   // tầng 12A cũng vậy
});

test('trục 12A và 12B là hai căn riêng, không gộp vào trục 12', () => {
  assert.equal(anhTrucCan('T010312'),  '/mat-bang/truc/T01-12.jpg');
  assert.equal(anhTrucCan('T010312A'), '/mat-bang/truc/T01-12A.jpg');
  assert.equal(anhTrucCan('T010312B'), '/mat-bang/truc/T01-12B.jpg');
});

test('tòa T1 không có trục 13, 14', () => {
  assert.equal(anhTrucCan('T010313'), null);
  assert.equal(anhTrucCan('T010314'), null);
});

test('tòa chưa cắt thì trả null để rơi về mặt bằng tòa', () => {
  assert.equal(anhTrucCan('P110312A'), null);
  assert.equal(matBangSach('P110312A'), null);
  assert.equal(coBanDo('P11'), false);
  assert.equal(coBanDo('T01'), true);
});

test('mã căn hỏng không làm văng', () => {
  for (const x of [null, undefined, '', '   ', 'abc', '46298', 'P01SH0102', 'P062X16']) {
    assert.equal(anhTrucCan(x), null);
    assert.equal(khungTrucCan(x), null);
    assert.equal(trucCuaCan(x), null);
  }
});

test('mặt bằng sạch là ảnh riêng, không phải file tòa cũ', () => {
  assert.equal(matBangSach('T011201'), '/mat-bang/truc/T01.jpg');
});

test('khung đỏ ra đơn vị %, nằm gọn trong ảnh', () => {
  const k = khungTrucCan('T011201');
  assert.deepEqual(Object.keys(k).sort(), ['height', 'left', 'top', 'width']);
  for (const v of Object.values(k)) assert.match(v, /^\d+(\.\d+)?%$/);
  const so = s => parseFloat(s);
  assert.ok(so(k.left) + so(k.width)  <= 100.01, 'khung tràn ngang');
  assert.ok(so(k.top)  + so(k.height) <= 100.01, 'khung tràn dọc');
});

test('18 trục của T1 đều có khung và không khung nào rỗng', () => {
  const trucs = ['01','02','03','04','05','06','07','08','09','10','11','12','12A','12B','15','16','17','18'];
  for (const t of trucs) {
    const k = khungTrucCan(`T0103${t}`);
    assert.ok(k, `thiếu trục ${t}`);
    assert.ok(parseFloat(k.width) > 1 && parseFloat(k.height) > 1, `trục ${t} khung rỗng`);
  }
});
