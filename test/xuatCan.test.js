import test from 'node:test';
import assert from 'node:assert/strict';
import { dongXuatCan, xuatDanhSach } from '../src/utils/xuatCan.js';

test('dongXuatCan: đủ thông tin', () => {
  assert.equal(
    dongXuatCan({ maCan: 'T081903', dienTich: '53 m²', huong: 'Nam',
                  gia: '4.55 tỷ thu về', lienHe: 'A Hoan 0962862895' }),
    'T081903 - 53m - Hướng: Nam - Giá: 4.55 tỷ thu về - Liên hệ: A Hoan 0962862895');
});

test('dongXuatCan: mọi cách ghi diện tích về "53m"', () => {
  ['53 m²', '53m2', '53m', '53', ' 53 '].forEach(v =>
    assert.ok(dongXuatCan({ maCan: 'X', dienTich: v }).includes('53m'), `hỏng với "${v}"`));
});

// Đập thông ghi diện tích dạng tổng. Ép về một số là ghi sai căn.
test('dongXuatCan: diện tích dạng tổng giữ nguyên', () => {
  assert.ok(dongXuatCan({ maCan: 'X', dienTich: '75+25' }).includes('75+25m'));
});

// Nhãn cụt kiểu "Hướng: " trong danh sách dán ra ngoài trông như mất dữ liệu.
test('dongXuatCan: phần rỗng bị bỏ hẳn, không để nhãn cụt', () => {
  const d = dongXuatCan({ maCan: 'T081903', dienTich: '', huong: '', gia: '5 tỷ', lienHe: '' });
  assert.equal(d, 'T081903 - Giá: 5 tỷ');
  assert.ok(!d.includes('Hướng'));
  assert.ok(!d.includes('Liên hệ'));
});

test('dongXuatCan: mã căn tự viết hoa', () => {
  assert.ok(dongXuatCan({ maCan: 't081903' }).startsWith('T081903'));
});

test('dongXuatCan: không có gì thì trả chuỗi rỗng', () => {
  assert.equal(dongXuatCan({}), '');
});

test('xuatDanhSach: tiêu đề rồi tới từng dòng', () => {
  assert.equal(
    xuatDanhSach('Danh sách căn 2 ngủ', ['T081903 - 53m', 'T092612A - 53m']),
    'Danh sách căn 2 ngủ:\nT081903 - 53m\nT092612A - 53m');
});

test('xuatDanhSach: bỏ dòng rỗng, không để dòng trắng', () => {
  assert.equal(xuatDanhSach('A', ['x', '', '  ', 'y']), 'A:\nx\ny');
});

test('xuatDanhSach: không tiêu đề thì chỉ có các dòng', () => {
  assert.equal(xuatDanhSach('', ['x', 'y']), 'x\ny');
});

test('dongXuatCan: ghi chú nằm cuối dòng', () => {
  assert.equal(
    dongXuatCan({ maCan: 'T081903', dienTich: '53', gia: '5 tỷ',
                  lienHe: 'A Hoan 0962862895', ghiChu: 'Có đồ, net 8 tỷ' }),
    'T081903 - 53m - Giá: 5 tỷ - Liên hệ: A Hoan 0962862895 - Ghi chú: Có đồ, net 8 tỷ');
});

// Ô ghi chú gõ xuống dòng được, mà ở đây mỗi căn đúng một dòng.
test('dongXuatCan: ghi chú nhiều dòng bị gộp thành một dòng', () => {
  const d = dongXuatCan({ maCan: 'X', ghiChu: 'Dòng một\nDòng hai\n\n  thừa   cách ' });
  assert.equal(d, 'X - Ghi chú: Dòng một Dòng hai thừa cách');
  assert.ok(!d.includes('\n'));
});

test('dongXuatCan: ghi chú rỗng thì không có nhãn', () => {
  assert.equal(dongXuatCan({ maCan: 'X', ghiChu: '   ' }), 'X');
});
