import test from 'node:test';
import assert from 'node:assert/strict';
import { slotTuGhiChu, soSlotTuGhiChu, slotTuOXe } from '../src/utils/slotXe.js';

// Ca đã gặp trên dữ liệu thật: chủ nhà viết "có slot" mà không viết thêm chữ "xe",
// bản cũ đọc ra "Không" -> bảng ghi không có slot trong khi căn có.
test('"có slot" không kèm chữ "xe" vẫn là có slot', () => {
  assert.equal(slotTuGhiChu('Full đồ, có slot'), 'Có');
  assert.equal(slotTuGhiChu('có slot'), 'Có');
  assert.equal(slotTuGhiChu('full đồ + slot'), 'Có');
});

test('các cách ghi có slot khác', () => {
  ['2 slot xe', 'Có đồ, 2 slot xe', '1 slot', 'slot xe', '2 slt', 'có sot xe']
    .forEach(s => assert.equal(slotTuGhiChu(s), 'Có', `phải ra Có với "${s}"`));
});

// Chiều ngược lại nguy hơn: bản cũ đọc "không có slot xe" thành CÓ, tức là tin nhắn
// chào khách quảng cáo một chỗ đỗ xe không tồn tại.
test('phủ định ngay trước chữ slot thì là không có', () => {
  ['không có slot xe', 'ko slot', 'full đồ, k slot', 'chưa có slot', '0 slot']
    .forEach(s => assert.equal(slotTuGhiChu(s), 'Không', `phải ra Không với "${s}"`));
});

// Chữ "không" của mệnh đề bên cạnh không được kéo sang phủ định slot — kể cả khi
// người gõ quên dấu phẩy.
test('"không" nói về thứ khác thì không phủ định slot', () => {
  assert.equal(slotTuGhiChu('không đồ, 2 slot'), 'Có');
  assert.equal(slotTuGhiChu('không đồ 2 slot'), 'Có');
  assert.equal(slotTuGhiChu('2 slot, không đồ'), 'Có');
});

// Ghi chú không nhắc tới slot -> Không. Đoán "có" là hứa với khách một thứ không có.
test('không nhắc tới slot thì trả Không', () => {
  ['', null, undefined, 'nhà sửa đẹp, view hồ', 'chính chủ'].forEach(s =>
    assert.equal(slotTuGhiChu(s), 'Không', `phải ra Không với "${s}"`));
});

// Đập Thông là căn gộp -> cần biết MẤY slot, không chỉ có hay không.
test('Đập Thông lấy được số slot', () => {
  assert.equal(soSlotTuGhiChu('Có đồ, 2 slot xe'), '2');
  assert.equal(soSlotTuGhiChu('1 slot'), '1');
  assert.equal(soSlotTuGhiChu('có slot'), 'Có');       // xác nhận có, không nói mấy cái
  assert.equal(soSlotTuGhiChu('không có slot xe'), 'Không');
  assert.equal(soSlotTuGhiChu('nhà đẹp'), 'Không');
});

// Ô cột Xe: bản cũ chỉ hỏi "có chữ hay không", nên ô gõ "không" cũng thành Có.
test('ô cột Xe đọc theo giá trị, không phải theo rỗng/không rỗng', () => {
  assert.equal(slotTuOXe('không'), 'Không');
  assert.equal(slotTuOXe('Ko'), 'Không');
  assert.equal(slotTuOXe('0'), 'Không');
  assert.equal(slotTuOXe('-'), 'Không');
  assert.equal(slotTuOXe('có'), 'Có');
  assert.equal(slotTuOXe('1'), 'Có');
  assert.equal(slotTuOXe('x'), 'Có');
});

// Ô trống trả '' chứ không phải 'Không', để chỗ gọi biết là phải đi hỏi Ghi Chú.
test('ô Xe trống trả chuỗi rỗng', () => {
  ['', '   ', null, undefined].forEach(v =>
    assert.equal(slotTuOXe(v), '', `phải rỗng với "${v}"`));
});
