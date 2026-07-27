// Cấu hình + logic import bảng hàng công ty cho 3 module Quỹ Căn.
//
// Bảng hàng công ty là MỘT file Excel nhiều tab. Trước đây admin phải mở file đó
// 3 lần (mỗi trang import 1 lần). Gom về đây để chọn file 1 lần -> ghi cả 3 sheet
// chính (Quy_Can_Thue / Quy_Can_Ban / Quy_Dap_Thong). Bảng con (*_Con) không bị đụng.

import {
  normHeader, canonicalStatusColor, normalizeThietKe, mapPhi,
  isDateSerialGia, INVEST_COLOR,
} from './quyCanShared';
import {
  fetchQuyCanThue, postQuyCanThue,
  fetchQuyCanBan, postQuyCanBan,
  fetchQuyDapThong, postQuyDapThong,
} from './api';

// ── Helper riêng cho import ──

// Chuẩn hoá cột "TT" của bảng công ty -> Nội Thất.
// "Full"/"Có đồ"/typo -> Full đồ; "K đồ"/"Ko đồ"/"Không đồ" -> Không đồ; còn lại để trống.
function importNoiThat(val) {
  const s = (val || '').toString().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
  if (!s) return '';
  if (/^k\b|^ko\b|khong|trong/.test(s)) return 'Không đồ';
  if (s.includes('ful') || s.includes('fil') || s.includes('co do') || s.includes('day du') || s.includes('du do')) return 'Full đồ';
  return '';
}

// Giá bán từ bảng công ty là số tỷ (VD "6.7"). Gắn " tỷ" để đơn vị rõ ràng.
// Nếu đã có chữ "tỷ"/"tr" thì giữ nguyên.
function formatGiaTy(val) {
  const s = (val || '').toString().trim();
  if (!s) return '';
  if (isDateSerialGia(s)) return ''; // ô Giá là serial ngày Excel -> bỏ
  if (/t[ỷy]|tr|triệu/i.test(s)) return s;
  const n = s.match(/^[\d.,]+$/);
  if (!n) return s;
  return `${s} tỷ`;
}

// Sheet Đập Thông không có cột Xe riêng — số slot xe nằm trong Ghi Chú (VD "Có đồ, 2 slot xe").
// Trích số slot: "1 slot" -> "1", "2 slot xe" -> "2". Bắt cả biến thể gõ thiếu (sot/slt/slot).
function parseSlotXe(ghiChu) {
  const s = (ghiChu || '').toString().toLowerCase();
  const m = s.match(/(\d+)\s*s(?:lot|ot|lt)/);
  return m ? m[1] : 'Không';
}

// Sheet Hàng Đầu Tư (và một số sheet Bán) không có cột Xe riêng — slot xe ghi trong Ghi Chú.
// Trả về "Có"/"Không" (khác Đập Thông trả về số slot). Nhận diện "slot"/"sot"/"slt".
function hasSlotXe(ghiChu) {
  const s = (ghiChu || '').toString().toLowerCase();
  return /\d+\s*s(?:lot|ot|lt)|s(?:lot|ot|lt)\s*xe/.test(s) ? 'Có' : 'Không';
}

// Tên sheet -> mảng token đã bỏ dấu. Dùng để so khớp THEO TỪ thay vì regex "chứa chuỗi":
// normHeader('Bảng hàng') = 'bang hang', regex /ban/ khớp nhầm -> tách token thì không.
export function sheetTokens(name) {
  return normHeader(name).split(/[^a-z0-9]+/).filter(Boolean);
}

// ── 3 cấu hình import ──

// Bảng hàng công ty (tab Căn Thuê) -> schema Quỹ Căn Thuê.
const IMPORT_CONFIG_THUE = {
  keyField: 'Ma_Can',
  matchSheet: t => t.includes('thue'),
  previewCols: [
    { key: 'Ma_Can', label: 'Mã Căn' },
    { key: 'Thiet_Ke', label: 'Thiết Kế' },
    { key: 'Dien_Tich', label: 'DT' },
    { key: 'Huong_BC', label: 'Hướng BC' },
    { key: 'Gia', label: 'Giá' },
    { key: 'Phi_MG', label: 'Phí MG' },
    { key: 'Noi_That', label: 'Nội Thất' },
    { key: 'Slot_Xe', label: 'Slot' },
    { key: 'Thoi_Gian_Vao', label: 'TG Vào' },
    { key: 'Ten_Chu', label: 'Tên Chủ' },
    { key: 'Lien_He', label: 'Liên Hệ' },
    { key: 'Nguon', label: 'Nguồn' },
    { key: 'Ngay_Update', label: 'Ngày CN' },
  ],
  // r: object khoá theo header đã chuẩn hoá (không dấu, thường).
  // extra.statusRgb: màu nền ô Mã Căn (fgColor.rgb) từ file công ty.
  mapRow(r, extra = {}) {
    const g = (...keys) => {
      for (const k of keys) { if (r[k] != null && r[k] !== '') return r[k].toString().trim(); }
      return '';
    };
    const thang = g('thang');
    const nam = g('nam');
    const tgVao = thang && nam ? `${thang}/${nam}` : (thang || nam || '');
    const slot = g('slot xe');
    return {
      Ma_Can:        g('ma can').toUpperCase(),
      Thiet_Ke:      normalizeThietKe(g('pn')),
      Dien_Tich:     g('dt (m2)', 'dt', 'dt m2'),
      Huong_BC:      g('bc'),
      Gia:           g('gia'),
      Phi_MG:        g('phi mg'),
      Noi_That:      importNoiThat(g('tt')),
      Slot_Xe:       slot ? 'Có' : 'Không',
      Thoi_Gian_Vao: tgVao,
      Ten_Chu:       g('ten chu', 'ten chu '),
      Lien_He:       g('sdt chu', 'sdt chu '),
      Nguon:         g('nguon'),
      Ghi_Chu:       g('ghi chu'),
      Ngay_Update:   g('ngay cap nhat'),
      Hinh_Anh:      '',
      Mau_Ma_Can:    canonicalStatusColor(extra.statusRgb),
    };
  },
};

// Bảng hàng công ty (tab Bán / Hàng Đầu Tư) -> schema Quỹ Căn Bán.
// Gộp nhiều tên header vì các sheet (T / Park Hill / G4 / Hàng Đầu Tư) đặt tên lệch nhau.
const IMPORT_CONFIG_BAN = {
  keyField: 'Ma_Can',
  matchSheet: t => t.includes('ban') || (t.includes('dau') && t.includes('tu')),
  previewCols: [
    { key: 'Ma_Can', label: 'Mã Căn' },
    { key: 'Thiet_Ke', label: 'Thiết Kế' },
    { key: 'Dien_Tich', label: 'DT' },
    { key: 'Huong_BC', label: 'BC' },
    { key: 'Huong_Cua', label: 'Cửa' },
    { key: 'Gia', label: 'Giá (tỷ)' },
    { key: 'Phi', label: 'Phí' },
    { key: 'Slot_Xe', label: 'Xe' },
    { key: 'Ten_Chu', label: 'Tên Chủ' },
    { key: 'SDT', label: 'SDT' },
    { key: 'Nguon', label: 'Nguồn' },
    { key: 'Ngay_Update', label: 'Ngày CN' },
  ],
  mapRow(r, extra = {}) {
    const g = (...keys) => {
      for (const k of keys) { if (r[k] != null && r[k] !== '') return r[k].toString().trim(); }
      return '';
    };
    // Căn từ sheet "Hàng Đầu Tư" -> đánh dấu hồng nhạt (nếu ô không có màu trạng thái riêng).
    const t = sheetTokens(extra.sheetName || '');
    const isDauTu = t.includes('dau') && t.includes('tu');
    const statusColor = canonicalStatusColor(extra.statusRgb);
    return {
      Ma_Can:      g('ma can').toUpperCase(),
      Thiet_Ke:    normalizeThietKe(g('so pn', 'pn')),
      Dien_Tich:   g('m2', 'dt (m2)', 'dt m2', 'dt'),
      Huong_BC:    g('bc'),
      Huong_Cua:   g('cua'),
      Gia:         formatGiaTy(g('gia ty', 'gia tỷ', 'gia')),
      Phi:         mapPhi(g('phi', 'tv or bp')),
      // Có cột Xe -> dùng luôn; sheet không có cột Xe (Park Hill/G4/Đầu Tư) -> suy từ Ghi Chú.
      Slot_Xe:     g('xe') ? 'Có' : hasSlotXe(g('ghi chu')),
      Noi_That:    '',
      SDT:         g('sdt chu nha', 'sdt chu', 'sdt', 'sđt'),
      Ten_Chu:     g('ten chu nha', 'ten chu', 'tên chủ'),
      Nguon:       g('nguon'),
      Ghi_Chu:     g('ghi chu'),
      Ngay_Update: g('ngay cap nhat'),
      Hinh_Anh:    '',
      Mau_Ma_Can:  statusColor || (isDauTu ? INVEST_COLOR : ''),
    };
  },
};

// Sheet "Quỹ Đập Thông" -> tab Quỹ Đập Thông (căn đập thông = gộp 2 căn).
// Cùng schema Quỹ Căn Bán nhưng header phí là "PHÍ BP TV" và sheet không có cột "Xe".
const IMPORT_CONFIG_DAPTHONG = {
  keyField: 'Ma_Can',
  matchSheet: t => t.includes('dap') && t.includes('thong'),
  previewCols: [
    { key: 'Ma_Can', label: 'Mã Căn' },
    { key: 'Thiet_Ke', label: 'Thiết Kế' },
    { key: 'Dien_Tich', label: 'DT' },
    { key: 'Huong_BC', label: 'BC' },
    { key: 'Huong_Cua', label: 'Cửa' },
    { key: 'Gia', label: 'Giá (tỷ)' },
    { key: 'Phi', label: 'Phí' },
    { key: 'Ten_Chu', label: 'Tên Chủ' },
    { key: 'SDT', label: 'SDT' },
    { key: 'Nguon', label: 'Nguồn' },
    { key: 'Ngay_Update', label: 'Ngày CN' },
  ],
  mapRow(r, extra = {}) {
    const g = (...keys) => {
      for (const k of keys) { if (r[k] != null && r[k] !== '') return r[k].toString().trim(); }
      return '';
    };
    return {
      Ma_Can:      g('ma can').toUpperCase(),
      Thiet_Ke:    normalizeThietKe(g('so pn', 'pn')),
      Dien_Tich:   g('m2', 'dt (m2)', 'dt m2', 'dt'),
      Huong_BC:    g('bc'),
      Huong_Cua:   g('cua'),
      Gia:         formatGiaTy(g('gia ty', 'gia tỷ', 'gia')),
      Phi:         mapPhi(g('phi bp tv', 'phi', 'tv or bp')),
      Slot_Xe:     parseSlotXe(g('ghi chu')),
      Noi_That:    '',
      SDT:         g('sdt chu nha', 'sdt chu', 'sdt', 'sđt'),
      Ten_Chu:     g('ten chu nha', 'ten chu', 'tên chủ'),
      Nguon:       g('nguon'),
      Ghi_Chu:     g('ghi chu'),
      Ngay_Update: g('ngay cap nhat'),
      Hinh_Anh:    '',
      Mau_Ma_Can:  canonicalStatusColor(extra.statusRgb),
    };
  },
};

// Thứ tự mảng = thứ tự "giành" tab: bảng nào khớp trước thì ăn tab đó.
// 'ban' để cuối vì bộ lọc của nó tham nhất (khớp cả "Hàng Đầu Tư").
export const IMPORT_TARGETS = [
  { key: 'dapthong', label: 'Quỹ Đập Thông', config: IMPORT_CONFIG_DAPTHONG, fetchFn: fetchQuyDapThong, postFn: postQuyDapThong, logKey: 'importLog_dapthong' },
  { key: 'thue',     label: 'Quỹ Căn Thuê',  config: IMPORT_CONFIG_THUE,     fetchFn: fetchQuyCanThue,  postFn: postQuyCanThue,  logKey: 'importLog_thue', withSTT: true },
  { key: 'ban',      label: 'Quỹ Căn Bán',   config: IMPORT_CONFIG_BAN,      fetchFn: fetchQuyCanBan,   postFn: postQuyCanBan,   logKey: 'importLog_ban' },
];

// Chia tab của workbook cho từng bảng. Mỗi tab chỉ thuộc về ĐÚNG 1 bảng.
// Trả về { claims: { [key]: [tên sheet] }, unclaimed: [tên sheet] }.
export function claimSheets(sheetNames, overrides = {}) {
  const claims = {};
  const taken = new Set();

  // Lượt 1: tab user ép chọn bằng dropdown — giữ chỗ TRƯỚC để bảng tự động
  // (chạy sớm hơn trong mảng) không giành mất.
  for (const t of IMPORT_TARGETS) {
    const forced = overrides[t.key];
    if (forced === undefined) continue;
    claims[t.key] = forced ? [forced] : [];   // '' = user ép "bỏ qua"
    if (forced) taken.add(forced);
  }

  // Lượt 2: tự nhận theo token, tab nào đã bị giành thì bỏ qua.
  for (const t of IMPORT_TARGETS) {
    if (claims[t.key]) continue;
    const hit = sheetNames.filter(n => !taken.has(n) && t.config.matchSheet(sheetTokens(n)));
    hit.forEach(n => taken.add(n));
    claims[t.key] = hit;
  }

  return { claims, unclaimed: sheetNames.filter(n => !taken.has(n)) };
}

// Tab "Tất cả" = phản chiếu bảng hàng công ty: ghi đè FULL (kể cả Ghi Chú, Ngày Update),
// KHÔNG giữ Giá Nét / màu user / tag; và XÓA căn không còn trong bảng công ty.
// `fresh` phải là bản vừa GET để _rowIndex không lệch (sheet chính dùng chung).
export function buildDiff(payloads, fresh, { withSTT = false } = {}) {
  const byMa = new Map();
  fresh.forEach(it => { const k = (it.Ma_Can || '').trim().toUpperCase(); if (k) byMa.set(k, it); });
  let maxSTT = fresh.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);

  const adds = [], updates = [];
  const importedKeys = new Set();
  for (const p of payloads) {
    const key = (p.Ma_Can || '').trim().toUpperCase();
    if (key) importedKeys.add(key);
    const base = {
      ...p,
      Gia_Net: '',                     // Giá Nét chỉ tồn tại ở bảng con
      Bang_Con: '',                    // tag chỉ ở sheet con
      Mau_Ma_Can: p.Mau_Ma_Can || '',  // chỉ giữ màu trạng thái công ty, bỏ màu user
      Ghi_Chu: p.Ghi_Chu || '',
      Ngay_Update: p.Ngay_Update || '',
    };
    const existing = key ? byMa.get(key) : null;
    if (existing) {
      updates.push({
        ...base,
        Hinh_Anh: p.Hinh_Anh || existing.Hinh_Anh || '', // giữ ảnh cũ (sheet công ty không có ảnh)
        _rowIndex: existing._rowIndex,
        ...(withSTT ? { STT: existing.STT } : {}),
      });
    } else {
      adds.push({ ...base, ...(withSTT ? { STT: ++maxSTT } : {}) });
    }
  }

  // Căn có trong sheet chính nhưng vắng mặt trong bảng công ty import -> xoá.
  const deletes = fresh
    .filter(it => { const k = (it.Ma_Can || '').trim().toUpperCase(); return k && !importedKeys.has(k); })
    .map(it => ({ _rowIndex: it._rowIndex }));

  return { adds, updates, deletes };
}

// Ghi nhật ký import cho module KHÔNG được mount (TimesCity chỉ render 1 trang tại 1 thời điểm,
// nên không gọi được setImportLog của 2 trang kia). Trang đó tự đọc lại localStorage khi mount.
export function writeImportLog(logKey, maCans) {
  try {
    const prev = JSON.parse(localStorage.getItem(logKey) || '[]');
    const ts = new Date().toISOString();
    const next = [...maCans.map(Ma_Can => ({ Ma_Can, ts })), ...prev].slice(0, 20);
    localStorage.setItem(logKey, JSON.stringify(next));
  } catch { /* localStorage đầy / bị chặn -> bỏ qua, không ảnh hưởng import */ }
}
