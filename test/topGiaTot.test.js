import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTopN, xepHangGiaTot } from '../src/utils/topGiaTot.js';

test('đọc được số sau "top"', () => {
  assert.equal(resolveTopN(null, 'top 10 căn 2PN giá tốt nhất'), 10);
  assert.equal(resolveTopN(null, 'top15 căn 2N có slot xe giá tốt'), 15);
  assert.equal(resolveTopN(null, 'lấy cho tôi TOP 5 căn rẻ nhất'), 5);
});

test('đọc được số đứng ngay trước "căn"', () => {
  assert.equal(resolveTopN(null, 'lấy cho tôi 15 căn giá tốt'), 15);
  assert.equal(resolveTopN(null, 'tìm 3 căn 2PN giá tốt nhất'), 3);
});

// Đây là cái bẫy chính: số phòng ngủ cũng là một con số nằm trong câu.
test('KHÔNG nhầm số phòng ngủ thành số căn cần lấy', () => {
  assert.equal(resolveTopN(null, '3PN giá tốt'), 10, '3 là số phòng ngủ, không phải top 3');
  assert.equal(resolveTopN(null, '2 ngủ giá tốt nhất'), 10);
  assert.equal(resolveTopN(null, 'căn 4PN bên P giá ngon'), 10);
  // "top 10" phải thắng, dù "2N" đứng sau
  assert.equal(resolveTopN(null, 'top 10 căn 2N giá tốt'), 10);
  assert.equal(resolveTopN(null, 'top 20 căn 3PN'), 20);
});

test('có tín hiệu nhưng không có số thì mặc định 10 căn', () => {
  assert.equal(resolveTopN(null, 'tìm 2PN giá tốt'), 10);
  assert.equal(resolveTopN(null, 'căn nào giá mềm bên Park Hill'), 10);
  assert.equal(resolveTopN(null, 'top căn 2PN'), 10);
});

// Không có tín hiệu xếp hạng thì tuyệt đối không được cắt danh sách.
test('câu tìm thường trả null, không cắt bớt kết quả', () => {
  ['2 ngủ có slot tài chính 4 tỷ', '3PN bên P từ 80 đến 100m', 'trục 12 tầng cao',
   'tìm căn tầng 20 tòa T05', '', null].forEach(q => {
    assert.equal(resolveTopN(null, q), null, `phải là null: ${JSON.stringify(q)}`);
  });
});

// "nội thất tốt" nói về nội thất, không phải giá — cắt còn 10 căn là sai ý.
test('không dính "nội thất tốt", "hướng tốt"', () => {
  assert.equal(resolveTopN(null, '2PN nội thất tốt nhất'), null);
  assert.equal(resolveTopN(null, '3PN hướng tốt'), null);
});

test('chỉ tin AI khi câu gõ không có tín hiệu nào', () => {
  assert.equal(resolveTopN(10, 'tìm 2PN'), 10, 'AI bắt được thì vẫn dùng');
  assert.equal(resolveTopN('15', 'tìm 2PN'), 15, 'AI trả chuỗi số');
  assert.equal(resolveTopN('nhiều', 'tìm 2PN'), null, 'AI trả rác thì bỏ');
  assert.equal(resolveTopN(0, 'tìm 2PN'), null);
  assert.equal(resolveTopN(-5, 'tìm 2PN'), null);
});

test('chặn trên 200 căn', () => {
  assert.equal(resolveTopN(null, 'top 5000 căn giá tốt'), 200);
  assert.equal(resolveTopN(99999, 'tìm 2PN'), 200);
});

const tr = it => it.tr;
const dt = it => it.dt;

test('xepHangGiaTot: xếp từ đơn giá thấp lên cao rồi cắt N', () => {
  const list = [
    { id: 'a', tr: 80, dt: 100 },
    { id: 'b', tr: 55, dt: 70 },
    { id: 'c', tr: 62, dt: 90 },
    { id: 'd', tr: 71, dt: 80 },
  ];
  assert.deepEqual(xepHangGiaTot(list, tr, dt, 2).map(x => x.id), ['b', 'c']);
  assert.deepEqual(xepHangGiaTot(list, tr, dt, 10).map(x => x.id), ['b', 'c', 'd', 'a'],
    'N lớn hơn số căn có thì trả hết, không lỗi');
});

// Căn thiếu diện tích -> trPerM2 null. Xếp nó xuống đáy thì vẫn lọt vào top 10 khi
// danh sách ngắn, chiếm mất chỗ của một căn có giá thật.
test('xepHangGiaTot: loại hẳn căn không tính được tr/m²', () => {
  const list = [
    { id: 'a', tr: null, dt: 100 },
    { id: 'b', tr: 55,   dt: 70 },
    { id: 'c', tr: null, dt: 90 },
  ];
  assert.deepEqual(xepHangGiaTot(list, tr, dt, 10).map(x => x.id), ['b']);
  assert.deepEqual(xepHangGiaTot([{ id: 'a', tr: null, dt: 1 }], tr, dt, 10), []);
});

test('xepHangGiaTot: cùng đơn giá thì căn diện tích lớn lên trước', () => {
  const list = [
    { id: 'nho', tr: 60, dt: 70 },
    { id: 'to',  tr: 60, dt: 110 },
  ];
  assert.deepEqual(xepHangGiaTot(list, tr, dt, 5).map(x => x.id), ['to', 'nho']);
});

test('xepHangGiaTot: không sửa mảng gốc', () => {
  const list = [{ id: 'a', tr: 80, dt: 1 }, { id: 'b', tr: 55, dt: 1 }];
  xepHangGiaTot(list, tr, dt, 5);
  assert.deepEqual(list.map(x => x.id), ['a', 'b']);
});
