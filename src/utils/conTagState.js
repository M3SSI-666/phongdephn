// Logic thuần cho việc gắn/gỡ thẻ bảng hàng con — KHÔNG import gì, KHÔNG đụng React.
// Tách riêng để chạy được bằng `node --test` (src/utils/api.js đọc import.meta.env ở
// top level nên không thể để chung với hook).

// Khoá so khớp 1 căn. PHẢI khớp conKey() ở src/utils/quyCanShared.js và 3 file api/.
// Lặp lại ở đây để module này không phải import gì cả.
export const conKey = s => (s || '').trim().toUpperCase().replace(/\s+/g, '');

// Cột Bang_Con lưu các thẻ ngăn nhau bằng dấu phẩy.
export const parseBangCon = v => (v || '').split(',').map(s => s.trim()).filter(Boolean);
export const joinBangCon  = tags => (tags || []).filter(Boolean).join(', ');

// MỖI CĂN CHỈ THUỘC 1 THẺ. Tick thẻ mới là CHUYỂN, không cộng dồn.
// Bỏ tick thì chỉ gỡ đúng thẻ đó: dữ liệu cũ (trước khi có luật này) có thể còn ô
// nhiều thẻ, gỡ 1 thẻ không được xoá lây các thẻ kia.
export function nextTags(cur, tag) {
  const list = Array.isArray(cur) ? cur : parseBangCon(cur);
  return list.includes(tag) ? list.filter(t => t !== tag) : [tag];
}

// Áp thay đổi thẻ vào danh sách bảng con NGAY (optimistic) — checkbox lật tức thì,
// không chờ mạng. Trả { next, mode, removed }.
//   mode 'delete' -> bỏ hết thẻ, dòng con biến mất
//   mode 'update' -> vá ô Bang_Con của dòng đang có
//   mode 'add'    -> chưa có dòng, chèn dòng mới (_rowIndex tạm null)
//   mode 'noop'   -> chưa có dòng mà cũng không có thẻ nào
export function applyTagChange(conItems, { key, tags, addRow }) {
  const items = conItems || [];
  const idx = items.findIndex(it => conKey(it.Ma_Can) === key);
  const tagStr = joinBangCon(tags);

  if (idx === -1) {
    if (!tagStr) return { next: items, mode: 'noop', removed: null };
    return {
      next: [...items, { ...addRow, Bang_Con: tagStr, _rowIndex: null }],
      mode: 'add',
      removed: null,
    };
  }

  const removed = items[idx];
  if (!tagStr) {
    // Server sẽ deleteDimension -> MỌI dòng phía dưới trong sheet tụt đúng 1.
    // Không trừ theo thì các _rowIndex đang giữ ở client thành sai hết.
    const gone = removed._rowIndex;
    const next = items
      .filter((_, i) => i !== idx)
      .map(it =>
        gone && it._rowIndex && it._rowIndex > gone ? { ...it, _rowIndex: it._rowIndex - 1 } : it
      );
    return { next, mode: 'delete', removed };
  }

  const next = items.slice();
  next[idx] = { ...removed, Bang_Con: tagStr };
  return { next, mode: 'update', removed: null };
}

// Vá _rowIndex thật sau khi server trả về, để lần sửa/xoá tiếp theo trỏ đúng dòng
// mà không phải tải lại cả bảng.
export function applyServerAck(conItems, { key, mode, _rowIndex }) {
  if (mode !== 'add' || !_rowIndex) return conItems;
  const items = conItems || [];
  const idx = items.findIndex(it => conKey(it.Ma_Can) === key);
  if (idx === -1) return items;
  const next = items.slice();
  next[idx] = { ...next[idx], _rowIndex };
  return next;
}

// Tên thẻ do user tự gõ. Trả chuỗi lỗi, hoặc '' nếu hợp lệ.
export function validateTagName(name, existing) {
  const t = (name || '').trim();
  if (!t) return 'Tên thẻ trống';
  // parseBangCon cắt theo dấu phẩy nên thẻ có dấu phẩy sẽ tự tách làm đôi.
  if (t.includes(',')) return 'Tên thẻ không được chứa dấu phẩy';
  // Google Sheets biến ô mở đầu bằng các ký tự này thành công thức.
  if (/^[=+\-@]/.test(t)) return 'Tên thẻ không được bắt đầu bằng = + - @';
  if ((existing || []).some(x => x.toLowerCase() === t.toLowerCase())) return 'Thẻ này đã có';
  return '';
}
