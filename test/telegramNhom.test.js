import test from 'node:test';
import assert from 'node:assert/strict';
import { doiViTriNhom } from '../src/utils/telegramCan.js';
import { xepNhomTheoThuTu } from '../api/telegram.js';

// ── Kéo thả đổi thứ tự nhóm trong hộp "Gửi sang Telegram" ──────────────────

const DS = ['T - 3PN', 'B - 1PN', 'B - 2PN', 'B - 3PN'];

test('doiViTriNhom: kéo xuống, thả DƯỚI nhóm đích', () => {
  assert.deepEqual(doiViTriNhom(DS, 0, 2, true), ['B - 1PN', 'B - 2PN', 'T - 3PN', 'B - 3PN']);
});

test('doiViTriNhom: kéo xuống, thả TRÊN nhóm đích', () => {
  assert.deepEqual(doiViTriNhom(DS, 0, 2, false), ['B - 1PN', 'T - 3PN', 'B - 2PN', 'B - 3PN']);
});

test('doiViTriNhom: kéo lên đầu danh sách', () => {
  assert.deepEqual(doiViTriNhom(DS, 3, 0, false), ['B - 3PN', 'T - 3PN', 'B - 1PN', 'B - 2PN']);
});

test('doiViTriNhom: kéo xuống cuối danh sách', () => {
  assert.deepEqual(doiViTriNhom(DS, 1, 3, true), ['T - 3PN', 'B - 2PN', 'B - 3PN', 'B - 1PN']);
});

test('doiViTriNhom: thả về đúng chỗ cũ → null (khỏi lưu)', () => {
  assert.equal(doiViTriNhom(DS, 1, 1, false), null);
  assert.equal(doiViTriNhom(DS, 1, 1, true), null);
  assert.equal(doiViTriNhom(DS, 1, 0, true), null);   // dưới nhóm 0 = chính chỗ của nhóm 1
});

test('doiViTriNhom: không sửa mảng gốc', () => {
  const goc = [...DS];
  doiViTriNhom(goc, 0, 3, true);
  assert.deepEqual(goc, DS);
});

// ── Ghi thứ tự mới vào sheet Telegram_Nhom ───────────────────────────────────

const ROWS = [['T - 3PN', '-1001'], ['B - 1PN', '-1002'], ['', ''], ['B - 2PN', '-1003']];

test('xepNhomTheoThuTu: xếp đúng thứ tự, Chat_Id đi theo tên nhóm', () => {
  const { moi } = xepNhomTheoThuTu(ROWS, ['B - 2PN', 'T - 3PN', 'B - 1PN']);
  assert.deepEqual(moi, [['B - 2PN', '-1003'], ['T - 3PN', '-1001'], ['B - 1PN', '-1002']]);
});

test('xepNhomTheoThuTu: phủ kín số dòng cũ (dòng trống do xoá nhóm) để không sót dòng thừa', () => {
  const { values } = xepNhomTheoThuTu(ROWS, ['B - 2PN', 'T - 3PN', 'B - 1PN']);
  assert.equal(values.length, ROWS.length);
  assert.deepEqual(values[3], ['', '']);
});

test('xepNhomTheoThuTu: nhóm người khác vừa thêm (không có trong thứ tự) được GIỮ, xuống cuối', () => {
  const { moi } = xepNhomTheoThuTu([...ROWS, ['B - 4PN', '-1004']], ['B - 1PN', 'T - 3PN', 'B - 2PN']);
  assert.deepEqual(moi.map(n => n[0]), ['B - 1PN', 'T - 3PN', 'B - 2PN', 'B - 4PN']);
});

test('xepNhomTheoThuTu: tên lạ trong thứ tự (nhóm đã bị xoá) thì bỏ qua, không đẻ dòng', () => {
  const { moi } = xepNhomTheoThuTu(ROWS, ['Nhóm đã xoá', 'B - 2PN']);
  assert.deepEqual(moi.map(n => n[0]), ['B - 2PN', 'T - 3PN', 'B - 1PN']);
});

// Nhóm thường bị nâng lên siêu nhóm: Telegram từ chối mã cũ và trả kèm mã mới.
test('đọc mã nhóm mới khi nhóm đã nâng lên siêu nhóm', async () => {
  const { maNhomMoi } = await import('../api/telegram.js');
  const tuChoi = {
    ok: false, error_code: 400,
    description: 'Bad Request: group chat was upgraded to a supergroup chat',
    parameters: { migrate_to_chat_id: -1001340370079 },
  };
  assert.equal(maNhomMoi(tuChoi), '-1001340370079');
  assert.equal(maNhomMoi({ ok: false, description: 'Bad Request: chat not found' }), null);
  assert.equal(maNhomMoi({}), null);
  assert.equal(maNhomMoi(null), null);
});

// sendMediaGroup đòi 2–10 món: không album nào được lẻ 1 ảnh (trừ căn chỉ có 1 ảnh).
test('chiaAlbum: chia đều, không album nào 1 ảnh', async () => {
  const { chiaAlbum } = await import('../api/telegram.js');
  const ds = n => Array.from({ length: n }, (_, i) => 'a' + i);
  const co = n => chiaAlbum(ds(n)).map(a => a.length);
  assert.deepEqual(co(0), []);
  assert.deepEqual(co(1), [1]);
  assert.deepEqual(co(10), [10]);
  assert.deepEqual(co(11), [6, 5]);
  assert.deepEqual(co(21), [7, 7, 7]);
  assert.deepEqual(co(24), [8, 8, 8]);
  for (let n = 2; n <= 60; n++) {
    const a = co(n);
    assert.ok(a.every(k => k >= 2 && k <= 10), `n=${n}: ${a}`);
    assert.equal(a.reduce((s, k) => s + k, 0), n, `n=${n} mat anh`);
  }
  assert.deepEqual(chiaAlbum(ds(11)).flat(), ds(11));   // giữ đúng thứ tự
});
