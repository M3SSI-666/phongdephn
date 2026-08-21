// "top 10 căn 2PN giá tốt nhất" -> lấy 10 căn có đơn giá tr/m² thấp nhất.
//
// Đọc thẳng từ câu người dùng gõ trước, chỉ khi không ra mới tin giá trị AI trả về —
// giống resolveKhu. Mấy cụm này cố định nên regex chắc hơn AI, và "top 10" vẫn ăn
// kể cả khi model bỏ sót trường Top_N.

function norm(s) {
  return String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

// Phải có tín hiệu XẾP HẠNG thì mới cắt danh sách. Không có thì trả null và bộ lọc
// chạy bình thường — người gõ "2PN 4 tỷ" không hề muốn bị cắt còn 10 căn.
//
// Cố tình KHÔNG bắt "tốt nhất" trơ trọi: "nội thất tốt nhất" là nói về nội thất,
// không phải giá. Câu "top 10 ... tốt nhất" đã có "top" bắt hộ rồi.
const RX_TIN_HIEU = /\btop\b|gia (tot|re|ngon|hoi|mem)|(re|ngon|hoi) nhat/;

// Số lượng chỉ được đọc ở hai chỗ dính liền ý "lấy bao nhiêu căn": sau "top", hoặc
// ngay trước "căn". Nếu quét số bừa trong câu thì "3PN giá tốt" thành top 3 —
// con số 3 đó là số phòng ngủ.
const RX_SAU_TOP  = /\btop\s*(\d+)/;
const RX_TRUOC_CAN = /\b(\d+)\s*can\b/;

// Người dùng chốt: gõ "giá tốt" mà không kèm số thì mặc định lấy 10 căn.
const MAC_DINH = 10;

// Chặn trên: "top 5000 căn" thì cắt cũng như không, mà còn làm người dùng tưởng
// bộ lọc hỏng. 200 là quá đủ cho một lần chào khách.
const TOI_DA = 200;

export function resolveTopN(topFromAi, query = '') {
  const q = norm(query);

  if (RX_TIN_HIEU.test(q)) {
    const m = q.match(RX_SAU_TOP) || q.match(RX_TRUOC_CAN);
    return m ? clamp(parseInt(m[1], 10)) : MAC_DINH;
  }

  // AI có thể trả số, hoặc chuỗi "10". Rác thì bỏ hẳn.
  const n = typeof topFromAi === 'number' ? topFromAi : parseInt(topFromAi, 10);
  return Number.isFinite(n) ? clamp(n) : null;
}

function clamp(n) {
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, TOI_DA);
}

// Xếp hạng theo đơn giá tr/m² từ thấp -> cao rồi cắt N căn đầu.
//
// Căn không tính được tr/m² (thiếu diện tích, ô Giá là chữ) bị LOẠI hẳn khỏi bảng
// xếp hạng chứ không xếp xuống đáy: không biết giá thì không thể nói nó tốt hay xấu,
// mà để nó lọt vào top 10 thì chiếm mất chỗ của một căn có giá thật.
export function xepHangGiaTot(list, trPerM2, dienTichOf, n) {
  return list
    .map(it => ({ it, tr: trPerM2(it) }))
    .filter(x => x.tr != null)
    // Cùng đơn giá thì căn to lên trước: cùng tiền một mét vuông, ai cũng chọn căn rộng hơn.
    .sort((a, b) => a.tr - b.tr || dienTichOf(b.it) - dienTichOf(a.it))
    .slice(0, n)
    .map(x => x.it);
}
