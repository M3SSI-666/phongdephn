import test from 'node:test';
import assert from 'node:assert/strict';
import { KHUNG_THUE, KHUNG_BAN, khungConTrong } from '../src/utils/quyCanShared.js';

test('khung mới mở ra là khung trống', () => {
  assert.equal(khungConTrong(KHUNG_THUE), true);
  assert.equal(khungConTrong(KHUNG_BAN), true);
  assert.equal(khungConTrong(''), true);
  assert.equal(khungConTrong(null), true);
  // Xoá hết chỉ còn khoảng trắng / dòng trống cũng là trống.
  assert.equal(khungConTrong('   \n\n  '), true);
});

test('điền bất kỳ dòng nào thì hết trống', () => {
  assert.equal(khungConTrong(KHUNG_THUE.replace('Căn hộ:', 'Căn hộ: P0112A11')), false);
  // Điền dòng cuối cũng phải nhận ra, không chỉ dòng đầu.
  assert.equal(khungConTrong(KHUNG_THUE.replace('Liên hệ:', 'Liên hệ: 0363560203')), false);
  assert.equal(khungConTrong(KHUNG_BAN.replace('Tên chủ:', 'Tên chủ: Anh Nam')), false);
});

test('dán tin Zalo đè lên (dòng không có dấu hai chấm) vẫn tính là có nội dung', () => {
  assert.equal(khungConTrong('Căn P0112a11 giá 23tr full đồ'), false);
  assert.equal(khungConTrong('Căn hộ P0112a11\n3 ngủ\n23tr'), false);
});

test('nhãn trong khung phải là nhãn AI đọc được', () => {
  // Chốt lại danh sách nhãn: đổi ở đây là phải đổi prompt trong api/parse-tc.js.
  assert.deepEqual(KHUNG_THUE.split('\n'), [
    'Căn hộ:', 'Thiết kế:', 'Diện tích:', 'Hướng ban công:', 'Slot xe:',
    'Giá:', 'Phí mg:', 'Nội thất:', 'Thời gian vào:', 'Liên hệ:',
  ]);
  assert.deepEqual(KHUNG_BAN.split('\n'), [
    'Căn hộ:', 'Thiết kế:', 'Diện tích:', 'Hướng ban công:', 'Slot xe:',
    'Giá:', 'Phí:', 'Nội thất:', 'SĐT:', 'Tên chủ:',
  ]);
});
