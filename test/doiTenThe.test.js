import test from 'node:test';
import assert from 'node:assert/strict';
import { doiTenTrongBangCon } from '../src/utils/conTagState.js';
import { doiViTri } from '../src/utils/doiViTri.js';

test('doiTenTrongBangCon: đổi đúng thẻ, giữ thứ tự các thẻ khác', () => {
  assert.equal(doiTenTrongBangCon('1 ngủ, 2 ngủ, 3 ngủ', '2 ngủ', '2N'), '1 ngủ, 2N, 3 ngủ');
  assert.equal(doiTenTrongBangCon('2 ngủ', '2 ngủ', '2N'), '2N');
});

// Dòng không mang thẻ cũ thì trả null để chỗ gọi khỏi ghi lại một dòng không đổi gì.
test('doiTenTrongBangCon: dòng không có thẻ đó trả null', () => {
  assert.equal(doiTenTrongBangCon('1 ngủ, 3 ngủ', '2 ngủ', '2N'), null);
  assert.equal(doiTenTrongBangCon('', '2 ngủ', '2N'), null);
});

// Đổi sang tên đã tồn tại trên cùng dòng thì GỘP, không để hai thẻ trùng nhau.
test('doiTenTrongBangCon: gộp khi trùng tên đã có', () => {
  assert.equal(doiTenTrongBangCon('2 ngủ, 3 ngủ', '2 ngủ', '3 ngủ'), '3 ngủ');
  assert.equal(doiTenTrongBangCon('1 ngủ, 2 ngủ, 3 ngủ', '3 ngủ', '1 ngủ'), '1 ngủ, 2 ngủ');
});

test('doiViTri: kéo thẻ sang phải và sang trái', () => {
  const ds = ['1 ngủ', '2 ngủ', '3 ngủ', '4 ngủ'];
  assert.deepEqual(doiViTri(ds, 0, 2, true),  ['2 ngủ', '3 ngủ', '1 ngủ', '4 ngủ']);
  assert.deepEqual(doiViTri(ds, 3, 0, false), ['4 ngủ', '1 ngủ', '2 ngủ', '3 ngủ']);
  assert.equal(doiViTri(ds, 1, 1, false), null, 'thả đúng chỗ cũ thì khỏi lưu');
});
