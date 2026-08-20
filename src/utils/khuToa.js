// Gom tòa thành nhóm mà người bán hàng gọi tên: "bên T", "bên P", "Park Hill", "G4".
//
// T18 LÀ Park 4 — mã P04 không tồn tại trong dữ liệu (đối chiếu 12.556 mã căn thật:
// P01,P02,P03,[không có P04],P05..P12 và T01..T11,T18). Giao diện đã hiện nhãn "T18 (P04)".
//
// Hệ quả: T18 nằm trong "bên T" VÀ trong "Park Hill", nhưng KHÔNG nằm trong "bên P".
// Đây là chủ ý, không phải sót:
//   - "bên T" / "bên P" hỏi theo MẶT CHỮ của mã căn — T18 đọc là chữ T.
//   - "Park Hill" hỏi theo KHU THẬT — Park 4 là nhà Park.
// Hai câu hỏi khác nhau nên một tòa nằm ở cả hai là bình thường.

const TIMES = ['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11'];

export const KHU_TOA = {
  Times:       TIMES,
  ParkHill:    ['P01','P02','P03','T18','P05','P06','P07','P08'],   // Park 1–8, Park 4 = T18
  ParkPremium: ['P09','P10','P11','P12'],                            // G4
  Park:        ['P01','P02','P03','T18','P05','P06','P07','P08','P09','P10','P11','P12'],
  BenT:        [...TIMES, 'T18'],
  BenP:        ['P01','P02','P03','P05','P06','P07','P08','P09','P10','P11','P12'],
};

// Nhãn hiện trên banner "Đang lọc". Ghi kèm dải tòa cho hai nhóm mặt chữ, vì đó chính là
// chỗ người dùng cần thấy T18 rơi vào đâu mà không phải mở code ra đọc.
export const KHU_LABEL = {
  Times:       'Khu Times',
  ParkHill:    'Khu Park Hill',
  ParkPremium: 'Khu Park Premium (G4)',
  Park:        'Khu Park Hill + Premium',
  BenT:        'Bên T (T01–T11, T18)',
  BenP:        'Bên P (P01–P12, không gồm T18)',
};

// Bỏ dấu, thường hoá, gộp khoảng trắng. GIỮ khoảng trắng để \b còn dùng được —
// xoá hết khoảng trắng thì "bên trong" thành "bentrong" và dính luôn luật "bên T".
function normQuery(s) {
  return String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

// "bên T", "bên chữ P", "bắt đầu bằng chữ T". \b ở cuối để "tòa T05" (→"toa t05")
// và "bên trong" (→"ben trong") không lọt.
const RX_MAT_CHU = /\b(?:ben|chu)\s*(?:chu\s*)?([tp])\b/;

// Đọc thẳng từ câu người dùng gõ trước, chỉ khi không ra mới tin giá trị AI trả về.
// Mấy cụm này cố định nên regex chắc hơn AI, và vẫn chạy kể cả khi AI trả Khu = null.
export function resolveKhu(khuFromAi, query = '') {
  const q = normQuery(query);

  const matChu = q.match(RX_MAT_CHU);
  if (matChu) return pack(matChu[1] === 't' ? 'BenT' : 'BenP');

  // Xét từ hẹp tới rộng: "park hill" chứa cả "park", nên "hill" phải được hỏi trước.
  if (/\bpremium\b|\bg4\b/.test(q)) return pack('ParkPremium');
  if (/\bhill\b/.test(q))           return pack('ParkHill');
  if (/\bpark\b/.test(q))           return pack('Park');
  if (/\btimes\b/.test(q))          return pack('Times');

  const key = Object.keys(KHU_TOA).find(k => k.toLowerCase() === String(khuFromAi || '').toLowerCase().replace(/\s+/g, ''));
  return key ? pack(key) : null;
}

function pack(key) {
  return { key, toaList: KHU_TOA[key], label: KHU_LABEL[key] };
}
