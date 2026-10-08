import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nhanNhomPhongNgu, soSanhNhomPhongNgu, NHOM_DAP_THONG, NHOM_CHUA_RO,
} from '../src/utils/nhomPhongNgu.js';

// Select ghi số trần ("2"), nhưng dữ liệu cũ và gõ tay có cả "2N"/"2PN". Cùng một dòng
// căn mà ra hai nhãn là bảng mọc ra hai dải riêng cho cùng một thứ.
test('nhanNhomPhongNgu: mọi cách ghi số phòng ngủ về cùng một dải', () => {
  ['2', '2N', '2PN', '2 n', ' 2 '].forEach(v =>
    assert.equal(nhanNhomPhongNgu(v), '2N', `phải ra 2N với "${v}"`));
  assert.equal(nhanNhomPhongNgu('1'), '1N');
  assert.equal(nhanNhomPhongNgu('6'), '6N');
});

// Hai lựa chọn này có sẵn trong dropdown Phòng ngủ và là nhu cầu thật của khách.
test('nhanNhomPhongNgu: loại không phải số phòng ngủ giữ nguyên chữ', () => {
  assert.equal(nhanNhomPhongNgu(NHOM_DAP_THONG), NHOM_DAP_THONG);
  assert.equal(nhanNhomPhongNgu('Shophouse'), 'Shophouse');
});

test('nhanNhomPhongNgu: ô trống thành dải "Chưa rõ"', () => {
  ['', '   ', null, undefined].forEach(v =>
    assert.equal(nhanNhomPhongNgu(v), NHOM_CHUA_RO, `phải ra Chưa rõ với "${v}"`));
});

test('soSanhNhomPhongNgu: 1N - 2N - 3N - 4N rồi mới tới Đập thông', () => {
  const sap = [NHOM_CHUA_RO, 'Shophouse', NHOM_DAP_THONG, '3N', '1N', '2N', '4N']
    .sort(soSanhNhomPhongNgu);
  assert.deepEqual(sap,
    ['1N', '2N', '3N', '4N', NHOM_DAP_THONG, 'Shophouse', NHOM_CHUA_RO]);
});

// So theo SỐ chứ không theo chữ: sắp chuỗi thì "10N" chen lên trước "2N".
test('soSanhNhomPhongNgu: 10N xếp sau 2N', () => {
  assert.ok(soSanhNhomPhongNgu('2N', '10N') < 0);
});
