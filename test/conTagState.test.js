import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyServerAck, applyTagChange, joinBangCon, nextTags, parseBangCon, validateTagName,
} from '../src/utils/conTagState.js';

const con = (Ma_Can, Bang_Con, _rowIndex) => ({ Ma_Can, Bang_Con, _rowIndex });

test('parseBangCon / joinBangCon khứ hồi, bỏ phần rỗng', () => {
  assert.deepEqual(parseBangCon('a, b ,, c'), ['a', 'b', 'c']);
  assert.deepEqual(parseBangCon(''), []);
  assert.deepEqual(parseBangCon(undefined), []);
  assert.equal(joinBangCon(['a', '', 'b']), 'a, b');
});

test('nextTags bật rồi tắt', () => {
  assert.deepEqual(nextTags([], '2 ngủ'), ['2 ngủ']);
  assert.deepEqual(nextTags(['1 ngủ'], '2 ngủ'), ['1 ngủ', '2 ngủ']);
  assert.deepEqual(nextTags(['1 ngủ', '2 ngủ'], '1 ngủ'), ['2 ngủ']);
});

test('tick thẻ lên căn CHƯA có dòng con -> chèn đúng 1 dòng, _rowIndex tạm null', () => {
  const items = [con('T010101', '1 ngủ', 5)];
  const addRow = { Ma_Can: 'T020202', Gia_Net: '5 tỷ' };
  const { next, mode } = applyTagChange(items, { key: 'T020202', tags: ['2 ngủ'], addRow });
  assert.equal(mode, 'add');
  assert.equal(next.length, 2);
  assert.equal(next[1].Bang_Con, '2 ngủ');
  assert.equal(next[1]._rowIndex, null);
  assert.equal(next[1].Gia_Net, '5 tỷ');
});

test('tick 2 thẻ liên tiếp lên cùng 1 căn -> đủ 2 thẻ, không mất thẻ đầu', () => {
  // Đây là lỗi cũ: 2 lần ghi cùng đọc 1 snapshot nên chỉ thẻ cuối sống sót.
  let items = [];
  const addRow = { Ma_Can: 'T010101' };
  let r = applyTagChange(items, { key: 'T010101', tags: ['1 ngủ'], addRow });
  items = r.next;
  const tags2 = nextTags(parseBangCon(items[0].Bang_Con), '2 ngủ');
  r = applyTagChange(items, { key: 'T010101', tags: tags2, addRow });
  assert.equal(r.mode, 'update');
  assert.equal(r.next.length, 1);
  assert.equal(r.next[0].Bang_Con, '1 ngủ, 2 ngủ');
});

test('bỏ thẻ cuối -> dòng biến mất VÀ mọi _rowIndex lớn hơn tụt đúng 1', () => {
  const items = [con('A001', 'x', 2), con('B002', 'y', 3), con('C003', 'z', 7)];
  const { next, mode, removed } = applyTagChange(items, { key: 'B002', tags: [] });
  assert.equal(mode, 'delete');
  assert.equal(removed._rowIndex, 3);
  assert.deepEqual(next.map(i => [i.Ma_Can, i._rowIndex]), [['A001', 2], ['C003', 6]]);
});

test('chỉ trừ theo SỐ DÒNG SHEET, không theo thứ tự trong mảng', () => {
  // A001 nằm sau trong mảng nhưng ở dòng sheet 9 (dưới dòng bị xoá) -> phải tụt.
  const items = [con('B002', 'y', 4), con('A001', 'x', 9), con('C003', 'z', 2)];
  const { next } = applyTagChange(items, { key: 'B002', tags: [] });
  assert.deepEqual(next.map(i => [i.Ma_Can, i._rowIndex]), [['A001', 8], ['C003', 2]]);
});

test('bỏ thẻ trên căn chưa có dòng con -> noop, không đẻ dòng rỗng', () => {
  const items = [con('A001', 'x', 2)];
  const { next, mode } = applyTagChange(items, { key: 'ZZZ999', tags: [] });
  assert.equal(mode, 'noop');
  assert.equal(next, items);
});

test('so khớp bỏ qua khoảng trắng và hoa thường', () => {
  const items = [con(' t01 0101 ', '1 ngủ', 2)];
  const { mode, next } = applyTagChange(items, { key: 'T010101', tags: ['1 ngủ', '2 ngủ'] });
  assert.equal(mode, 'update');
  assert.equal(next[0].Bang_Con, '1 ngủ, 2 ngủ');
});

test('applyServerAck vá _rowIndex null thành số thật', () => {
  const items = [con('A001', 'x', 2), con('B002', 'y', null)];
  const next = applyServerAck(items, { key: 'B002', mode: 'add', _rowIndex: 41 });
  assert.equal(next[1]._rowIndex, 41);
  assert.equal(next[0]._rowIndex, 2);
});

test('applyServerAck bỏ qua mode khác add', () => {
  const items = [con('A001', 'x', 2)];
  assert.equal(applyServerAck(items, { key: 'A001', mode: 'update', _rowIndex: 9 }), items);
  assert.equal(applyServerAck(items, { key: 'A001', mode: 'add', _rowIndex: null }), items);
});

test('validateTagName chặn dấu phẩy và ký tự công thức', () => {
  assert.equal(validateTagName('2 ngủ', []), '');
  assert.notEqual(validateTagName('', []), '');
  assert.notEqual(validateTagName('a, b', []), '');
  assert.notEqual(validateTagName('=SUM(A1)', []), '');
  assert.notEqual(validateTagName('-1', []), '');
  assert.notEqual(validateTagName('@x', []), '');
  assert.notEqual(validateTagName('2 NGỦ', ['2 ngủ']), '');
});
