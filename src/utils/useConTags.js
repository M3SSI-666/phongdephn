import { useCallback, useEffect, useRef, useState } from 'react';
import { applyServerAck, applyTagChange, conKey, nextTags, parseBangCon } from './conTagState';

// Ngày hôm nay dd/mm/yyyy theo máy user (server Vercel chạy UTC nên phải tính ở client).
const todayVN = () => new Date().toLocaleDateString('vi-VN');

// Quản lý việc gắn/gỡ thẻ bảng hàng con cho Quỹ Căn Bán / Đập Thông / Căn Thuê.
//
// Ba thứ hook này chịu trách nhiệm, và là ba lỗi cũ:
//   1. Checkbox lật NGAY (optimistic) — trước đây phải chờ 2 lượt mạng nên rất lag.
//   2. Các lần ghi xếp hàng TUẦN TỰ tuyệt đối — trước đây tick nhanh là chạy chồng nhau,
//      cùng đọc 1 snapshot cũ nên đẻ dòng trùng hoặc chỉ thẻ cuối sống sót.
//   3. Số dòng thật do server trả về — client không còn tự đoán _rowIndex.
//
// buildAddRow(item) -> payload đủ cột để server thêm dòng con mới (khi căn chưa có).
export function useConTags({ conItems, setConItems, postConFn, loadConData, showToast, userId, buildAddRow }) {
  // Gương của conItems: việc trong hàng đợi phải đọc bản mới nhất, không phải bản
  // bị đóng băng trong closure lúc render popover.
  const itemsRef  = useRef(conItems);
  // Nối chuỗi promise -> mọi lần ghi thẻ chạy lần lượt, không bao giờ chồng nhau.
  const queueRef  = useRef(Promise.resolve());
  const pendRef   = useRef(0);
  const failedRef = useRef(null);
  // TimesCity.jsx unmount cả trang khi đổi tab -> chặn setState sau unmount.
  const aliveRef  = useRef(true);
  // Bỏ thẻ cuối là xoá dòng con (mất Giá Nét / Ghi Chú / ảnh riêng). Giữ lại bản sao
  // để nếu user tick thẻ khác ngay sau đó thì dựng lại đúng dòng đó, không phải dòng gốc.
  const removedRef = useRef({});
  const [pending, setPending] = useState(0);

  useEffect(() => { itemsRef.current = conItems; }, [conItems]);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const bump = useCallback((d) => {
    pendRef.current += d;
    if (aliveRef.current) setPending(pendRef.current);
  }, []);

  const setConTag = useCallback((sourceItem, tag) => {
    const maCan = sourceItem?.Ma_Can || '';
    const key = conKey(maCan);
    if (!key || !userId) return;

    const cur     = itemsRef.current.find(it => conKey(it.Ma_Can) === key);
    const curTags = parseBangCon(cur?.Bang_Con);
    const tags    = nextTags(curTags, tag);

    // Mỗi căn chỉ thuộc 1 thẻ -> tick thẻ mới là gỡ thẻ cũ. Hỏi trước vì căn sẽ
    // biến khỏi màn hình đang xem nếu user đang đứng ở thẻ cũ.
    if (curTags.length && !curTags.includes(tag)) {
      const ok = window.confirm(
        `Căn ${maCan} đang ở thẻ "${curTags.join(', ')}".\n` +
        `Mỗi căn chỉ thuộc 1 thẻ. Chuyển sang "${tag}"?`
      );
      if (!ok) return;
    }

    if (cur && !tags.length) {
      const ok = window.confirm(
        `Bỏ thẻ cuối cùng sẽ xoá căn ${maCan} khỏi bảng hàng con.\n` +
        'Giá Nét, Ghi Chú và ảnh riêng của bản con sẽ mất. Xoá?'
      );
      if (!ok) return;
    }

    // Dựng dòng mới từ: dòng con đang có > dòng vừa bị xoá > dòng bảng chính.
    // KHÔNG lấy thẳng sourceItem khi đã từng có bản con — ở tab "Tất cả" sourceItem
    // là dòng bảng chính nguyên bản, dùng nó sẽ nuốt mất Giá Nét / Ghi Chú của user.
    const base = cur || removedRef.current[key] || sourceItem;
    const row  = buildAddRow(base);

    const { next, mode, removed } = applyTagChange(itemsRef.current, { key, tags, addRow: row });
    if (mode === 'noop') return;
    if (removed) removedRef.current[key] = removed;
    else delete removedRef.current[key];

    itemsRef.current = next;
    setConItems(next);

    bump(1);
    queueRef.current = queueRef.current.then(async () => {
      // Một việc hỏng -> mọi việc xếp sau đều dựa trên trạng thái chưa từng xảy ra. Xả sạch.
      if (failedRef.current) { bump(-1); return; }
      try {
        const r = await postConFn({
          action: 'settag', Owner_Id: userId, Ma_Can: maCan, tags, row, today: todayVN(),
        });
        if (aliveRef.current && r?._rowIndex) {
          itemsRef.current = applyServerAck(itemsRef.current, { key, mode: r.mode, _rowIndex: r._rowIndex });
          setConItems(itemsRef.current);
        }
        if (aliveRef.current && r?.duplicates > 0) {
          showToast(`Căn ${maCan} đang có ${r.duplicates + 1} dòng trùng trong bảng con — vào Sheet dọn giúp`, 'error');
        }
      } catch (e) {
        failedRef.current = e.message || 'Lưu thẻ thất bại';
      } finally {
        bump(-1);
        // Hàng đợi cạn. Sạch thì khỏi tải lại (server đã trả _rowIndex thật).
        if (pendRef.current === 0 && failedRef.current) {
          const msg = failedRef.current;
          failedRef.current = null;
          removedRef.current = {};
          if (aliveRef.current) { showToast(msg, 'error'); loadConData(); }
        }
      }
    });
  }, [userId, postConFn, loadConData, showToast, setConItems, buildAddRow, bump]);

  // Dữ liệu từ mạng (poll 30s / reload) chỉ được đè lên state khi không còn việc đang bay,
  // nếu không sẽ nuốt mất thẻ user vừa tick.
  const canApplyRemote = useCallback(() => pendRef.current === 0, []);

  return { setConTag, pending, canApplyRemote };
}
