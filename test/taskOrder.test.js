import test from 'node:test';
import assert from 'node:assert/strict';
import { sapXepTask, keoTask, thuTuTiepTheo } from '../src/utils/taskOrder.js';

const t = (Id, Thu_Tu, Xong = '') => ({ Id, Thu_Tu: String(Thu_Tu), Xong });
const ids = list => list.map(x => x.Id);

// Tick Xong không được làm dòng nhảy đi chỗ khác ngay dưới con trỏ người dùng.
test('việc đã xong vẫn đứng nguyên chỗ', () => {
  const list = [t('a', 1, '1'), t('b', 2), t('c', 3)];
  assert.deepEqual(ids(sapXepTask(list)), ['a', 'b', 'c']);
});

test('trong cùng nhóm thì xếp theo Thu_Tu', () => {
  const list = [t('c', 3), t('a', 1), t('b', 2)];
  assert.deepEqual(ids(sapXepTask(list)), ['a', 'b', 'c']);
});

// Task gõ tay thẳng vào sheet thì cột Thu_Tu trống -> tất cả cùng bằng 0. Không giữ thứ tự
// dòng gốc thì danh sách nhảy loạn mỗi lần render.
test('cùng Thu_Tu thì giữ nguyên thứ tự dòng gốc', () => {
  const list = [t('x', ''), t('y', ''), t('z', '')];
  assert.deepEqual(ids(sapXepTask(list)), ['x', 'y', 'z']);
});

test('sapXepTask không sửa mảng gốc', () => {
  const list = [t('b', 2), t('a', 1)];
  sapXepTask(list);
  assert.deepEqual(ids(list), ['b', 'a']);
});

test('keoTask: kéo lên trên', () => {
  const list = [t('a', 1), t('b', 2), t('c', 3)];
  assert.deepEqual(ids(keoTask(list, 2, 0).list), ['c', 'a', 'b']);
});

test('keoTask: kéo xuống dưới', () => {
  const list = [t('a', 1), t('b', 2), t('c', 3)];
  assert.deepEqual(ids(keoTask(list, 0, 2).list), ['b', 'c', 'a']);
});

// Đánh số lại toàn bộ: sót một task là nó mang số cũ và nhảy về chỗ khác sau khi tải lại.
test('keoTask: đánh số lại 1..n cho MỌI task', () => {
  const list = [t('a', 7), t('b', 30), t('c', 99)];
  const r = keoTask(list, 2, 0);
  assert.deepEqual(r.list.map(x => x.Thu_Tu), ['1', '2', '3']);
  assert.deepEqual(r.orders, [
    { Id: 'c', Thu_Tu: '1' }, { Id: 'a', Thu_Tu: '2' }, { Id: 'b', Thu_Tu: '3' },
  ]);
});

test('keoTask: không sửa mảng gốc', () => {
  const list = [t('a', 1), t('b', 2)];
  keoTask(list, 0, 1);
  assert.deepEqual(ids(list), ['a', 'b']);
  assert.equal(list[0].Thu_Tu, '1');
});

// Thả đúng chỗ cũ / chỉ số rác -> null, để phía gọi khỏi ghi một lượt vô nghĩa lên sheet.
test('keoTask: trả null khi không có gì đổi', () => {
  const list = [t('a', 1), t('b', 2)];
  [[0, 0], [-1, 1], [0, 5], [null, 1], [0, undefined], [1.5, 0]]
    .forEach(([f, to]) => assert.equal(keoTask(list, f, to), null, `phải null: ${f} -> ${to}`));
  assert.equal(keoTask([], 0, 1), null);
});

// list.length sai ngay sau lần xoá đầu tiên: 3 task đánh số 1,2,3, xoá 1 còn 2 task ->
// task mới lấy length+1 = 3, trùng số với task đang đứng cuối.
test('thuTuTiepTheo: lấy theo số lớn nhất, không phải số lượng', () => {
  assert.equal(thuTuTiepTheo([t('a', 1), t('b', 3)]), 4);
  assert.equal(thuTuTiepTheo([]), 1);
  assert.equal(thuTuTiepTheo([t('a', ''), t('b', '')]), 1);
});
