import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { C } from '../utils/theme';
import { fetchQuyCanThue, postQuyCanThue, parseThue, uploadToCloudinary, parseSearchQuery } from '../utils/api';
import ImportSheetModal from '../components/ImportSheetModal';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

function getTodayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

const RAINBOW_COLORS = [
  { label: 'Mặc định', value: '' },
  { label: 'Đỏ',       value: '#E53E3E' },
  { label: 'Cam',       value: '#DD6B20' },
  { label: 'Vàng',      value: '#D69E2E' },
  { label: 'Xanh lá',   value: '#38A169' },
  { label: 'Xanh dương',value: '#3182CE' },
  { label: 'Chàm',      value: '#5B21B6' },
  { label: 'Tím',       value: '#9F7AEA' },
];

// Màu "trạng thái" sao chép từ sheet công ty (lưu ké vào Mau_Ma_Can).
// LƯU Ý: các hex này phải KHÁC mọi giá trị trong RAINBOW_COLORS để phân biệt được
// màu trạng thái với màu Mã Căn user tự tô (pill ô Mã Căn).
// (Bỏ "Căn giá tốt" màu đỏ — không cần thể hiện lên bảng cá nhân.)
const STATUS_RENTED = '#9CA3AF'; // xám  -> Đã cho thuê
const STATUS_PAUSED = '#FFF000'; // vàng -> Dừng thuê
const STATUS_COLORS = new Set([STATUS_RENTED, STATUS_PAUSED]);
// Màu trạng thái CŨ đã bỏ (đỏ "Căn giá tốt") — coi như không màu để dữ liệu cũ hết đỏ.
const LEGACY_STATUS_COLORS = new Set(['#FF3B30']);

// Bỏ màu trạng thái đã loại bỏ khỏi dữ liệu cũ (hiển thị như bình thường).
function cleanMauMaCan(mau) {
  return LEGACY_STATUS_COLORS.has(mau) ? '' : (mau || '');
}

// Chuẩn hóa màu nền ô (fgColor.rgb) từ file công ty -> màu trạng thái, hoặc '' (bình thường/không dùng).
function canonicalStatusColor(rgb) {
  if (!rgb) return '';
  let h = rgb.toString().replace('#', '').toUpperCase();
  if (h.length === 8) h = h.slice(2);   // bỏ alpha AARRGGBB
  if (h.length !== 6) return '';
  if (h === 'FFFFFF') return '';         // trắng = bình thường
  if (h === 'FFFF00') return STATUS_PAUSED;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min <= 16 && min >= 0x60 && max <= 0xF0) return STATUS_RENTED; // dải xám trung tính
  return '';
}

// Nền mờ hiển thị theo màu trạng thái (dark theme).
function statusRowBg(mau) {
  if (mau === STATUS_RENTED) return 'rgba(148,163,184,0.16)';
  if (mau === STATUS_PAUSED) return 'rgba(250,204,21,0.16)';
  return undefined;
}

// Màu do user CHỦ ĐỘNG tô (qua ColorPicker) — khác màu trạng thái công ty và màu cũ đã bỏ.
function isUserPickedColor(c) {
  return !!c && !STATUS_COLORS.has(c) && !LEGACY_STATUS_COLORS.has(c);
}

// Khi import đè: màu user tự tô LUÔN THẮNG; màu trạng thái công ty chỉ là lớp dưới.
function resolveMauMaCan(incoming, existing) {
  const inc = incoming || '', ex = existing || '';
  if (isUserPickedColor(ex)) return ex; // user tự chọn -> giữ nguyên, bỏ qua status mới
  return inc || ex;                     // còn lại: lấy status mới (hoặc giữ status cũ)
}

const EMPTY_FORM = {
  Ma_Can: '', Thiet_Ke: '', Dien_Tich: '', Slot_Xe: 'Không',
  Huong_BC: '', Gia: '', Gia_Net: '', Phi_MG: '', Noi_That: 'Đồ cơ bản',
  Thoi_Gian_Vao: '', Ten_Chu: '', Lien_He: '', Hinh_Anh: '', Nguon: '', Ghi_Chu: '', Mau_Ma_Can: '',
};

function normalizeNoiThat(val) {
  const s = (val || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!s) return '';
  if (s.includes('full') || s.includes('day du') || s.includes('du do') || s.includes('co đo') || s.includes('đu đo') || s.includes('đay đu')) return 'Full đồ';
  if (s.includes('khong') || s.includes('trong') || s.includes('tho')) return 'Không đồ';
  return 'Đồ cơ bản';
}

// "2N" -> "2PN"; giữ nguyên nếu không phải dạng số + N.
function normalizeThietKe(val) {
  const s = (val || '').toString().trim();
  const m = s.match(/^(\d+)\s*n$/i);
  return m ? `${m[1]}PN` : s;
}

// Tách "tòa" và "tầng" từ Mã Căn (VD: P11-1205 -> {toa:'P11', tang:'12'};
// R6-1208 -> {toa:'R6', tang:'12'}; P0112A11 -> {toa:'P01', tang:'12'}).
function parseToaTang(maCan) {
  const s = (maCan || '').toString().toUpperCase().trim();
  const mToa = s.match(/^([A-Z]+\d{1,2})/);
  const toa = mToa ? mToa[1] : '';
  let tang = '';
  const rest = toa ? s.slice(toa.length).replace(/^[-\s]/, '') : s;
  // Lấy cụm số đầu tiên trong phần còn lại; 4 số -> 2 số đầu là tầng, 3 số -> 1 số đầu.
  const mNum = rest.match(/(\d{3,4})/);
  if (mNum) {
    const num = mNum[1];
    tang = num.length === 4 ? num.slice(0, 2) : num.slice(0, 1);
    tang = String(parseInt(tang, 10)); // bỏ số 0 đứng đầu
  }
  return { toa, tang };
}

// "2PN"/"2N"/"2 phòng ngủ" -> "2 phòng ngủ"; "Studio" giữ nguyên.
function thietKeText(val) {
  const s = normalizeThietKe(val);
  const m = s.match(/^(\d+)\s*PN$/i);
  return m ? `${m[1]} phòng ngủ` : s;
}

// Viết tắt hướng ban công -> tên đầy đủ. T=Tây, B=Bắc, N=Nam, Đ=Đông;
// 2 ký tự ghép lại: TB=Tây Bắc, ĐN=Đông Nam... Nếu đã là tên đầy đủ thì giữ nguyên.
const HUONG_MAP = { T: 'Tây', B: 'Bắc', N: 'Nam', D: 'Đông', Đ: 'Đông' };
function huongText(val) {
  const s = (val || '').toString().trim();
  if (!s) return '';
  const key = s.toUpperCase().replace(/[\s.]/g, '');
  // Chỉ đổi khi là chuỗi 1-2 ký tự trong tập hướng (T/B/N/Đ/D); còn lại giữ nguyên.
  if (/^[TBNDĐ]{1,2}$/.test(key)) {
    const words = key.split('').map(ch => HUONG_MAP[ch]).filter(Boolean);
    if (words.length) return words.join(' ');
  }
  return s;
}

// Ghép Nội Thất + Slot Xe thành câu "Hiện trạng".
function hienTrangText(item) {
  const nt = normalizeNoiThat(item.Noi_That);
  const parts = [];
  if (nt) parts.push(nt);
  if (item.Slot_Xe === 'Có') parts.push('có slot xe');
  else if (item.Slot_Xe === 'Không') parts.push('không có slot xe');
  return parts.join(', ');
}

// Viết đầy đủ giá cho tin nhắn: "15tr" -> "15 triệu/tháng"; "17,5 tr" -> "17,5 triệu/tháng";
// "1,2 tỷ" -> "1,2 tỷ"; số trần (VD "16") -> "16 triệu/tháng". Không nhận ra thì giữ nguyên.
function giaText(val) {
  const s = (val || '').toString().trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  // Đơn giá /m² (VD "115tr/m2", "115/m", "115tr/m²") -> giữ dạng "<số> triệu/m²",
  // KHÔNG đổi thành "triệu/tháng".
  if (/\/\s*m/.test(lower)) {
    const pm = lower.match(/([\d.,]+)/);
    if (pm) return `${pm[1]} triệu/m²`;
    return s;
  }
  // Có đơn vị "tỷ" -> giữ nguyên dạng tỷ (chỉ chuẩn hoá chữ).
  const ty = lower.match(/([\d.,]+)\s*t[ỷy]/);
  if (ty) return `${ty[1]} tỷ`;
  // Có "tr"/"triệu" hoặc chỉ là số -> quy về "<số> triệu/tháng".
  const tr = lower.match(/([\d.,]+)\s*(?:tr|triệu|trieu)?/);
  if (tr && tr[1]) return `${tr[1]} triệu/tháng`;
  return s;
}

// Tạo form tin nhắn gửi khách từ 1 căn (để copy vào clipboard).
function buildCustomerMessage(item) {
  const { toa, tang } = parseToaTang(item.Ma_Can);
  const header = toa
    ? `Em gửi chị căn hộ tòa ${toa}${tang ? ` – tầng ${tang}` : ''}:`
    : `Em gửi chị thông tin căn hộ ${item.Ma_Can || ''}:`;
  const lines = [header];
  const tk = thietKeText(item.Thiet_Ke);
  if (tk) lines.push(`- Thiết kế: ${tk}`);
  const dt = (item.Dien_Tich || '').replace(/\s*m²|m2|m$/i, '').trim();
  if (dt) lines.push(`- Diện tích: ${dt} m²`);
  const hbc = huongText(item.Huong_BC);
  if (hbc) lines.push(`- Hướng ban công: ${hbc}`);
  const ht = hienTrangText(item);
  if (ht) lines.push(`- Hiện trạng: ${ht}`);
  const gia = giaText(item.Gia_Net || item.Gia); // ưu tiên giá nét (giá đã làm với chủ) nếu có
  if (gia) lines.push(`- Giá: ${gia}`);
  return lines.join('\n');
}

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

// Ngày Update "mới": trong vòng 2 tháng trở lại tính từ hôm nay (dd/mm/yyyy).
function isRecentUpdate(val) {
  const m = (val || '').toString().trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return false;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(d)) return false;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
  return d >= from && d <= now;
}

// Thời Gian Vào "quan tâm": trong khoảng +-3 tháng so với tháng hiện tại (m/yyyy).
function isSoonMoveIn(val) {
  const m = (val || '').toString().match(/(\d{1,2})\s*\/\s*(\d{4})/);
  if (!m) return false;
  const month = +m[1], year = +m[2];
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const diff = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  return Math.abs(diff) <= 3;
}

// Cấu hình import cho bảng hàng công ty (tab Căn Thuê) -> schema Quỹ Căn Thuê.
const IMPORT_CONFIG_THUE = {
  title: 'Import bảng hàng công ty → Căn Thuê',
  tabMatch: /thu[eê]/i,
  keyField: 'Ma_Can',
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

const TABLE_HEADERS = [
  'Ngày Update', 'Mã Căn', 'Thiết Kế', 'DT', 'Slot Xe',
  'Hướng BC', 'Giá', 'Giá Nét', 'Phí MG', 'Nội Thất', 'Thời Gian Vào', 'Tên Chủ', 'Liên Hệ', 'Ảnh', 'Nguồn', 'Ghi Chú', '',
];
const COL_WIDTHS = [92, 100, 72, 66, 76, 85, 70, 70, 90, 110, 100, 100, 100, 80, 100, 270, 104];

export function QuyCanThueContent({ overrideUserId, overrideRole, isViewAs } = {}) {
  return <QuyCanThueInner overrideUserId={overrideUserId} overrideRole={overrideRole} isViewAs={isViewAs} />;
}

export default function QuyCanThue() {
  return <QuyCanThueInner />;
}

function formatTs(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mn = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm} ${hh}:${mn}`;
}

function QuyCanThueInner({ overrideUserId, overrideRole, isViewAs = false } = {}) {
  const { user } = useUser();
  const userId = overrideUserId || user?.id;
  const role   = overrideRole   || user?.publicMetadata?.role || 'staff';
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [importLog, setImportLog]   = useState(() => { try { return JSON.parse(localStorage.getItem('importLog_thue') || '[]'); } catch { return []; } });
  const [error, setError]           = useState('');
  const [aiQuery, setAiQuery]       = useState('');
  const [aiFilter, setAiFilter]     = useState(null);
  const [aiSearching, setAiSearching] = useState(false);

  // modal state: 'closed' | 'add' | 'edit'
  const [modalMode, setModalMode]   = useState('closed');
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });

  // AI parse
  const [rawText, setRawText]       = useState('');
  const [parsing, setParsing]       = useState(false);
  const [parsed, setParsed]         = useState(false);

  // image upload
  const [uploading, setUploading]   = useState(false);
  const [upProgress, setUpProgress] = useState(0);
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef                = useRef();

  const [toast, setToast]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dupTarget, setDupTarget]   = useState(null); // { existing, payload }
  const [showImport, setShowImport] = useState(false);
  const [lightbox, setLightbox]     = useState(null); // { urls:[], index:0 }
  const toastTimer                  = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ctSlideUp { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
      @keyframes ctToastIn  { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
      .ct-row:hover { background: rgba(255,255,255,0.06) !important; }
      .ct-btn:active { transform: scale(0.97); }
      .ct-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .ct-table-wrap::-webkit-scrollbar { height:6px; }
      .ct-table-wrap::-webkit-scrollbar-thumb { background:${C.textDim}; border-radius:3px; }
      @keyframes ctRowPulse { 0%,100%{background:transparent} 30%{background:rgba(56,178,116,0.22)} }
      .ct-row-highlight { animation: ctRowPulse 2s ease !important; outline: 2px solid rgba(56,178,116,0.6) !important; outline-offset:-2px; border-radius:4px; }
      @media(max-width:640px){
        .ct-modal-content { width:100%!important; height:100%!important; max-height:100%!important; border-radius:0!important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const data = await fetchQuyCanThue(userId, role, isViewAs);
      setItems(Array.isArray(data) ? data : []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId, role, isViewAs]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const iv = setInterval(() => fetchQuyCanThue(userId, role).then(d => setItems(Array.isArray(d)?d:[])).catch(()=>{}), 30000);
    return () => clearInterval(iv);
  }, []);

  function parseGiaValue(gia) {
    const s = (gia||'').toLowerCase().replace(/\s+/g,'');
    const ty = s.match(/([\d.]+)t[ỷy]/); if (ty) return parseFloat(ty[1]) * 1000;
    const tr = s.match(/([\d.]+)tr/); if (tr) return parseFloat(tr[1]);
    const n = s.match(/([\d.]+)/); return n ? parseFloat(n[1]) : null;
  }

  function buildFilterSummary(f) {
    if (f._exactMaCan) return `Mã căn: ${f._exactMaCan}`;
    const parts = [];
    if (f.Thiet_Ke) parts.push(f.Thiet_Ke);
    if (f.Slot_Xe) parts.push('Slot: ' + f.Slot_Xe);
    if (f.Gia_Min != null && f.Gia_Max != null) parts.push(`${f.Gia_Min}–${f.Gia_Max}tr`);
    else if (f.Gia_Max != null) parts.push(`≤ ${f.Gia_Max >= 1000 ? (f.Gia_Max/1000)+'tỷ' : f.Gia_Max+'tr'}`);
    else if (f.Gia_Min != null) parts.push(`≥ ${f.Gia_Min >= 1000 ? (f.Gia_Min/1000)+'tỷ' : f.Gia_Min+'tr'}`);
    if (f.Huong_BC) parts.push('Hướng ' + f.Huong_BC);
    if (f.Noi_That) parts.push(f.Noi_That);
    if (f.Toa) parts.push('Tòa ' + f.Toa);
    if (f.Toa_List) {
      const isParkAll = f.Toa_List.length === [...KHU_TOA.ParkHill, ...KHU_TOA.ParkPremium].length;
      parts.push(isParkAll ? 'Khu Park Hill + Premium' : 'Khu ' + (f.Khu || ''));
    } else if (f.Khu) parts.push('Khu ' + f.Khu);
    return parts.join(' · ');
  }

  const filtered = useMemo(() => {
    let list = [...items];
    if (aiFilter) {
      // Tìm exact mã căn — không fallback sang lọc tòa
      if (aiFilter._exactMaCan) {
        return list.filter(it => (it.Ma_Can||'').toUpperCase().replace(/\s+/g,'') === aiFilter._exactMaCan);
      }
      if (aiFilter.Thiet_Ke) list = list.filter(it => (it.Thiet_Ke||'').toUpperCase() === aiFilter.Thiet_Ke.toUpperCase());
      if (aiFilter.Slot_Xe)  list = list.filter(it => (it.Slot_Xe||'Không') === aiFilter.Slot_Xe);
      if (aiFilter.Gia_Max != null) list = list.filter(it => { const g = parseGiaValue(it.Gia); return g == null || g <= aiFilter.Gia_Max; });
      if (aiFilter.Gia_Min != null) list = list.filter(it => { const g = parseGiaValue(it.Gia); return g == null || g >= aiFilter.Gia_Min; });
      if (aiFilter.Huong_BC) list = list.filter(it => (it.Huong_BC||'').toLowerCase().includes(aiFilter.Huong_BC.toLowerCase()));
      if (aiFilter.Noi_That) { const target = normalizeNoiThat(aiFilter.Noi_That); list = list.filter(it => normalizeNoiThat(it.Noi_That) === target); }
      if (aiFilter.Toa_List) list = list.filter(it => aiFilter.Toa_List.some(t => (it.Ma_Can||'').toUpperCase().startsWith(t)));
      else if (aiFilter.Toa) list = list.filter(it => (it.Ma_Can||'').toUpperCase().startsWith(aiFilter.Toa.toUpperCase()));
    }
    return list;
  }, [items, aiFilter]);

  // Thứ tự tòa cố định: T01-T11, P01-P03, T18(=P04), P05-P12
  const TOA_ORDER = [
    'T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11',
    'P01','P02','P03','T18','P05','P06','P07','P08',
    'P09','P10','P11','P12',
  ];
  const TOA_LABEL = { T18: 'T18 (P04)' }; // T18 hiển thị là P04

  const grouped = useMemo(() => {
    function parsePN(thietKe) {
      const m = (thietKe || '').match(/(\d+)\s*[Pp][Nn]/);
      return m ? parseInt(m[1]) : 99;
    }
    function parseGia(gia) {
      const s = (gia || '').toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
      const ty = s.match(/([\d.]+)\s*t[ỷy]/);
      if (ty) return parseFloat(ty[1]) * 1000;
      const tr = s.match(/([\d.]+)\s*tr/);
      if (tr) return parseFloat(tr[1]);
      const n = s.match(/([\d.]+)/);
      return n ? parseFloat(n[1]) : 99999;
    }
    function parseDT(dt) {
      const n = (dt || '').replace(/[^\d.]/g, '');
      return n ? parseFloat(n) : 0;
    }
    // Giá dùng để sắp xếp: ưu tiên Giá Nét (giá đã làm với chủ); trống thì lấy Giá gốc.
    function effGia(item) {
      return parseGia((item.Gia_Net || '').trim() || item.Gia);
    }

    const map = new Map();
    for (const item of filtered) {
      const m = (item.Ma_Can||'').toUpperCase().match(/^([A-Z]+\d{1,2})/);
      const key = m ? m[1] : '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    const entries = Array.from(map.entries());
    entries.forEach(([, arr]) => {
      arr.sort((a, b) => {
        const pn = parsePN(a.Thiet_Ke) - parsePN(b.Thiet_Ke);
        if (pn !== 0) return pn;
        const gia = effGia(a) - effGia(b);
        if (gia !== 0) return gia;
        return parseDT(b.Dien_Tich) - parseDT(a.Dien_Tich);
      });
    });
    return entries.sort(([a],[b]) => {
      const ia = TOA_ORDER.indexOf(a);
      const ib = TOA_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [filtered]);

  // ── AI Search ──
  const KHU_TOA = {
    Times:        ['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11'],
    ParkHill:     ['P01','P02','P03','T18','P05','P06','P07','P08'],
    ParkPremium:  ['P09','P10','P11','P12'],
  };

  function normalizeFilter(f, originalQuery = '') {
    const r = { ...f };
    if (r.Slot_Xe != null) {
      const s = r.Slot_Xe.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      r.Slot_Xe = s.includes('co') && !s.includes('khong') ? 'Có' : 'Không';
    }
    if (r.Thiet_Ke != null) r.Thiet_Ke = r.Thiet_Ke.toUpperCase().replace(/\s+/g, '');
    if (r.Toa != null) r.Toa = r.Toa.toUpperCase().replace(/^([A-Z]+)(\d)$/, '$10$2');
    // Expand Khu → Toa_List — kiểm tra query gốc để phân biệt "Park" chung vs "Park Hill"/"Park Premium"
    if (r.Khu != null) {
      const qNorm = originalQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      const userSaidHill    = qNorm.includes('hill') || qNorm.includes('parkhill');
      const userSaidPremium = qNorm.includes('premium') || qNorm.includes('g4');
      const userSaidPark    = qNorm.includes('park');
      if (userSaidPark && !userSaidHill && !userSaidPremium) {
        // "Park" chung → gộp cả ParkHill + ParkPremium
        r.Toa_List = [...KHU_TOA.ParkHill, ...KHU_TOA.ParkPremium];
      } else {
        const key = Object.keys(KHU_TOA).find(k => k.toLowerCase() === r.Khu.toLowerCase());
        r.Toa_List = key ? KHU_TOA[key] : null;
      }
    }
    return r;
  }

  async function handleAiSearch() {
    if (!aiQuery.trim()) return;

    // Nếu query trông như mã căn đầy đủ (ví dụ T092012A, P0112A11) → tìm exact match, không dùng AI
    const q = aiQuery.trim().toUpperCase().replace(/\s+/g, '');
    const looksLikeFullCode = /^[A-Z]{1,2}\d{1,2}[\dA-Z\-]{2,}/.test(q);
    if (looksLikeFullCode) {
      const exactMatch = items.some(it => (it.Ma_Can||'').toUpperCase().replace(/\s+/g,'') === q);
      if (exactMatch) {
        setAiFilter({ _exactMaCan: q });
      } else {
        setAiFilter({ _exactMaCan: '__NO_MATCH__' });
        showToast(`Không tìm thấy căn ${q}`, 'error');
      }
      return;
    }

    setAiSearching(true);
    try {
      const raw = await parseSearchQuery(aiQuery);
      const f = normalizeFilter(raw, aiQuery);
      const hasAny = Object.values(f).some(v => v != null);
      if (!hasAny) return showToast('Không nhận ra tiêu chí, thử mô tả rõ hơn', 'error');
      setAiFilter(f);
    } catch(e) { showToast(e.message, 'error'); }
    finally { setAiSearching(false); }
  }

  // ── AI Parse ──
  async function handleParse() {
    if (!rawText.trim()) return showToast('Hãy paste tin Zalo vào trước', 'error');
    setParsing(true);
    setParsed(false);
    try {
      const result = await parseThue(rawText);
      const ghiChuNote = result.Ghi_Chu_NT?.trim() || '';
      setForm(prev => ({
        ...prev,
        Ma_Can:        (result.Ma_Can || prev.Ma_Can).toUpperCase(),
        Thiet_Ke:      result.Thiet_Ke      || prev.Thiet_Ke,
        Dien_Tich:     result.Dien_Tich     || prev.Dien_Tich,
        Slot_Xe:       result.Slot_Xe       || prev.Slot_Xe,
        Huong_BC:      result.Huong_BC      || prev.Huong_BC,
        Gia:           result.Gia           || prev.Gia,
        Phi_MG:        result.Phi_MG        || prev.Phi_MG,
        Noi_That:      result.Noi_That      || prev.Noi_That,
        Thoi_Gian_Vao: result.Thoi_Gian_Vao || prev.Thoi_Gian_Vao,
        Lien_He:       result.Lien_He       || prev.Lien_He,
        Ghi_Chu:       ghiChuNote ? (prev.Ghi_Chu ? prev.Ghi_Chu + ', ' + ghiChuNote : ghiChuNote) : prev.Ghi_Chu,
      }));
      setParsed(true);
      showToast('AI đã điền thông tin — kiểm tra lại trước khi lưu');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setParsing(false); }
  }

  // ── Media upload (ảnh + video) ──
  async function handleMediaFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    const existing = form.Hinh_Anh ? form.Hinh_Anh.split(',').map(u=>u.trim()).filter(Boolean) : [];
    const newUrls = [...existing];
    for (const file of Array.from(files)) {
      const isVid = file.type.startsWith('video/');
      const isImg = file.type.startsWith('image/');
      if (!isVid && !isImg) { showToast(`${file.name} không phải ảnh hoặc video`, 'error'); continue; }
      try {
        const url = await uploadToCloudinary(file, isVid ? 'video' : 'image', setUpProgress);
        newUrls.push(url);
      } catch(e) { showToast('Upload thất bại: ' + e.message, 'error'); }
    }
    setUploading(false); setUpProgress(0);
    setForm(prev => ({ ...prev, Hinh_Anh: newUrls.join(', ') }));
  }

  function removeImage(url) {
    const urls = form.Hinh_Anh.split(',').map(u=>u.trim()).filter(u => u && u !== url);
    setForm(prev => ({ ...prev, Hinh_Anh: urls.join(', ') }));
  }

  // ── Modal helpers ──
  function openAdd() {
    setRawText(''); setParsed(false);
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setModalMode('add');
  }

  function openEdit(item) {
    setRawText(''); setParsed(false);
    setEditItem(item);
    setForm({
      Ma_Can:        item.Ma_Can        || '',
      Thiet_Ke:      item.Thiet_Ke      || '',
      Dien_Tich:     item.Dien_Tich     || '',
      Slot_Xe:       item.Slot_Xe       || 'Không',
      Huong_BC:      item.Huong_BC      || '',
      Gia:           item.Gia           || '',
      Gia_Net:       item.Gia_Net       || '',
      Phi_MG:        item.Phi_MG        || '',
      Noi_That:      item.Noi_That      || '',
      Thoi_Gian_Vao: item.Thoi_Gian_Vao || '',
      Ten_Chu:       item.Ten_Chu       || '',
      Lien_He:       item.Lien_He       || '',
      Hinh_Anh:      item.Hinh_Anh      || '',
      Nguon:         item.Nguon         || '',
      Ghi_Chu:       item.Ghi_Chu       || '',
      Mau_Ma_Can:    item.Mau_Ma_Can    || '',
    });
    setModalMode('edit');
  }

  function closeModal() { setModalMode('closed'); setEditItem(null); }
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  function pushImportLog(maCan) {
    const entry = { Ma_Can: maCan, ts: new Date().toISOString() };
    setImportLog(prev => {
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem('importLog_thue', JSON.stringify(next));
      return next;
    });
  }

  // ── Save ──
  async function handleSave() {
    if (!form.Ma_Can.trim()) return showToast('Vui lòng nhập Mã căn', 'error');
    try {
      setSaving(true);
      const payload = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, typeof v==='string' ? v.trim() : v]));
      payload.Owner_Id = userId || '';
      if (modalMode === 'edit') {
        await postQuyCanThue({ action: 'update', _rowIndex: editItem._rowIndex, STT: editItem.STT, Owner_Id: editItem.Owner_Id || userId || '', ...payload });
        pushImportLog(payload.Ma_Can);
        showToast('Cập nhật thành công!');
        closeModal();
        await loadData();
      } else {
        const existing = items.find(i => (i.Ma_Can||'').toUpperCase() === payload.Ma_Can.toUpperCase());
        if (existing) {
          setSaving(false);
          setDupTarget({ existing, payload });
          return;
        }
        const maxSTT = items.reduce((m,i) => Math.max(m, Number(i.STT)||0), 0);
        await postQuyCanThue({ action: 'add', STT: maxSTT + 1, ...payload });
        pushImportLog(payload.Ma_Can);
        showToast('Thêm căn thành công!');
        closeModal();
        await loadData();
      }
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function confirmDup() {
    if (!dupTarget) return;
    try {
      setSaving(true);
      const { existing, payload } = dupTarget;
      const mergedHinh = payload.Hinh_Anh || existing.Hinh_Anh || '';
      await postQuyCanThue({ action: 'update', _rowIndex: existing._rowIndex, STT: existing.STT, Owner_Id: existing.Owner_Id || userId || '', ...payload, Hinh_Anh: mergedHinh, Gia_Net: payload.Gia_Net || existing.Gia_Net || '', Mau_Ma_Can: resolveMauMaCan(payload.Mau_Ma_Can, existing.Mau_Ma_Can) });
      pushImportLog(payload.Ma_Can);
      showToast('Đã cập nhật căn ' + payload.Ma_Can + '!');
      setDupTarget(null);
      closeModal();
      await loadData();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await postQuyCanThue({ action: 'delete', _rowIndex: deleteTarget._rowIndex });
      showToast('Đã xoá!');
      setDeleteTarget(null);
      await loadData();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function copyCustomerInfo(item) {
    const msg = buildCustomerMessage(item);
    try {
      await navigator.clipboard.writeText(msg);
      showToast(`Đã copy thông tin căn ${item.Ma_Can} — dán vào tin nhắn gửi khách`);
    } catch {
      // Fallback khi clipboard API bị chặn (http/không có quyền).
      const ta = document.createElement('textarea');
      ta.value = msg;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast(`Đã copy thông tin căn ${item.Ma_Can}`); }
      catch { showToast('Không copy được, vui lòng thử lại', 'error'); }
      document.body.removeChild(ta);
    }
  }

  // ── Import bảng hàng công ty ──
  // Chia payload theo Mã Căn trùng (cập nhật đè) / mới (thêm), ghi theo lô 1 request.
  const handleImportRows = useCallback(async (payloads, opts = {}) => {
    // mặc định giữ ghi chú/ngày cá nhân, chỉ ghi đè khi tick
    const { importGhiChu = false, importNgayUpdate = false } = opts;
    const byMa = new Map();
    items.forEach(it => { const k = (it.Ma_Can||'').trim().toUpperCase(); if (k) byMa.set(k, it); });
    let maxSTT = items.reduce((m,i) => Math.max(m, Number(i.STT)||0), 0);
    const adds = [], updates = [];
    for (const p of payloads) {
      const key = (p.Ma_Can||'').trim().toUpperCase();
      const existing = key ? byMa.get(key) : null;
      if (existing) {
        // Giữ ảnh cũ (sheet công ty không có ảnh); màu Mã Căn user tự tô thắng, xám chỉ lớp dưới
        updates.push({
          ...p,
          Hinh_Anh: p.Hinh_Anh || existing.Hinh_Anh || '',
          Gia_Net: existing.Gia_Net || '', // Giá Nét user tự nhập — import không đụng vào
          // Ghi Chú / Ngày Update: mặc định giữ dữ liệu cá nhân; chỉ ghi đè bằng bảng công ty khi tick.
          Ghi_Chu: importGhiChu ? (p.Ghi_Chu || '') : (existing.Ghi_Chu || ''),
          Ngay_Update: importNgayUpdate ? (p.Ngay_Update || '') : (existing.Ngay_Update || ''),
          Mau_Ma_Can: resolveMauMaCan(p.Mau_Ma_Can, existing.Mau_Ma_Can),
          _rowIndex: existing._rowIndex,
          STT: existing.STT,
          Owner_Id: existing.Owner_Id || userId || '',
        });
      } else {
        maxSTT += 1;
        adds.push({ ...p, STT: maxSTT, Owner_Id: userId || '' });
      }
    }
    const res = await postQuyCanThue({ action: 'bulk', adds, updates });
    payloads.slice(0, 5).forEach(p => pushImportLog(p.Ma_Can));
    await loadData();
    showToast(`Đã thêm ${res.added||adds.length}, cập nhật ${res.updated||updates.length} căn!`);
    return { added: res.added ?? adds.length, updated: res.updated ?? updates.length };
  }, [items, userId, loadData, showToast]);

  // ── Media helpers ──
  function isVideo(url) {
    return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url) || url.includes('/video/upload/');
  }
  function sortMedia(urls) {
    return [...urls.filter(isVideo), ...urls.filter(u => !isVideo(u))];
  }

  // ── Thumbnail cell ──
  function ThumbCell({ value }) {
    const urls = value ? value.split(',').map(u=>u.trim()).filter(Boolean) : [];
    if (!urls.length) return <span style={{color:'#8a9bb8', fontSize:16}} title="Xem mặt bằng">🗺</span>;
    const sorted = sortMedia(urls);
    return (
      <div style={{display:'flex',gap:3,justifyContent:'center'}}>
        {sorted.slice(0,2).map((u,i) => isVideo(u) ? (
          <div key={i} style={{position:'relative',width:32,height:32}}>
            <video src={u} style={{width:32,height:32,objectFit:'cover',borderRadius:4}} muted />
            <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,background:'rgba(0,0,0,0.35)',borderRadius:4}}>▶</span>
          </div>
        ) : (
          <img key={i} src={u} alt="" style={{width:32,height:32,objectFit:'cover',borderRadius:4}} />
        ))}
        {urls.length > 2 && <span style={{fontSize:11,color:'#8a9bb8',alignSelf:'center'}}>+{urls.length-2}</span>}
      </div>
    );
  }

  function scrollToRow(maCan) {
    const el = document.getElementById(`ct-row-${maCan}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ct-row-highlight');
    setTimeout(() => el.classList.remove('ct-row-highlight'), 2000);
  }

  return (
    <div style={{ fontFamily: F, color: '#e2e8f0' }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={openAdd} style={st.addBtn} className="ct-btn">+ Thêm Căn</button>
          <button onClick={() => setShowImport(true)} style={st.importBtn} className="ct-btn" title="Import bảng hàng công ty">⬇ Import</button>
          <button onClick={loadData} disabled={loading} style={st.reloadBtn} className="ct-btn" title="Tải lại">
            {loading ? '...' : '↻'}
          </button>
        </div>
        {/* Import Log — bên phải header */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', flex:1, justifyContent:'flex-end' }}>
          {importLog.length > 0 && (
            <>
              <span style={{ fontSize:10, color:'#8a9bb8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>📋</span>
              {importLog.slice(0,3).map((e,i) => (
                <span key={i} onClick={() => scrollToRow(e.Ma_Can)}
                  style={{
                    background:'rgba(255,255,255,0.05)', border:'1px solid #2d3240',
                    borderRadius:8, padding:'4px 10px', fontSize:11, whiteSpace:'nowrap',
                    display:'flex', gap:5, alignItems:'center', cursor:'pointer',
                    transition:'all 0.15s',
                  }}
                  onMouseEnter={ev => ev.currentTarget.style.borderColor='#38b274'}
                  onMouseLeave={ev => ev.currentTarget.style.borderColor='#2d3240'}
                  title={`Nhảy đến căn ${e.Ma_Can}`}
                >
                  <span style={{ color:'#38b274', fontWeight:700 }}>{e.Ma_Can}</span>
                  <span style={{ color:'#555e7a' }}>·</span>
                  <span style={{ color:'#8a9bb8', fontSize:10 }}>{formatTs(e.ts)}</span>
                </span>
              ))}
            </>
          )}
          <span style={{ fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{filtered.length} / {items.length} căn</span>
        </div>
      </div>

      {/* AI Search */}
      <div style={{ marginBottom: aiFilter ? 8 : 16 }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14 }}>✨</span>
          <input
            type="text"
            placeholder="VD: 2 ngủ có slot tài chính 19tr · 3PN tòa T18 không đồ hướng bắc..."
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
            style={{ ...st.searchInput, paddingRight: 90 }}
          />
          {aiFilter ? (
            <button onClick={() => { setAiFilter(null); setAiQuery(''); }} style={st.clearBtn}>&times;</button>
          ) : (
            <button
              onClick={handleAiSearch}
              disabled={aiSearching || !aiQuery.trim()}
              style={{
                position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                background: aiSearching || !aiQuery.trim() ? '#3a3f52' : 'linear-gradient(135deg,#38b274,#2a8a5a)',
                border:'none', borderRadius:8, padding:'6px 14px', color:'#fff',
                fontSize:12, fontWeight:700, cursor: aiSearching || !aiQuery.trim() ? 'default':'pointer', fontFamily:F,
              }}
            >{aiSearching ? '⟳ Đang tìm...' : '🔍 Tìm'}</button>
          )}
        </div>
        {aiFilter && (
          <div style={{ background:'rgba(56,178,116,0.12)', border:'1px solid rgba(56,178,116,0.3)', borderRadius:8, padding:'8px 14px', marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
            <span style={{ color:'#38b274' }}>
              ✅ Đang lọc: <strong>{buildFilterSummary(aiFilter)}</strong>
              <span style={{ color:'#8a9bb8', fontWeight:400, marginLeft:8 }}>· {filtered.length} căn phù hợp</span>
            </span>
            <button onClick={() => { setAiFilter(null); setAiQuery(''); }} style={{ background:'none', border:'none', color:'#8a9bb8', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
          </div>
        )}
      </div>

      {error && <div style={st.errorBox}>{error}</div>}
      {loading && <div style={st.loadingBox}>Đang tải dữ liệu...</div>}

      {/* Table */}
      {!loading && !error && (
        <div className="ct-table-wrap" style={st.tableWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                {TABLE_HEADERS.map((h,i) => <th key={h||`a${i}`} style={{...st.th, width:COL_WIDTHS[i], minWidth:COL_WIDTHS[i]}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={TABLE_HEADERS.length} style={st.emptyTd}>
                  {items.length === 0 ? 'Chưa có căn nào. Bấm "+ Thêm Căn" để bắt đầu.' : 'Không tìm thấy'}
                </td></tr>
              ) : grouped.map(([toa, toaItems]) => (
                <>
                  {/* Header tòa */}
                  <tr key={`header-${toa}`}>
                    <td colSpan={TABLE_HEADERS.length} style={st.toaHeader}>
                      <span style={st.toaLabel}>{toa}</span>
                    </td>
                  </tr>
                  {/* Các căn trong tòa */}
                  {toaItems.map(item => {
                    const mau = cleanMauMaCan(item.Mau_Ma_Can); // bỏ màu trạng thái đã loại (đỏ cũ)
                    const isStatus = STATUS_COLORS.has(mau);
                    // Dừng thuê (vàng): chỉ tô ô Mã Căn (giống bảng công ty).
                    const cellOnlyBg = mau === STATUS_PAUSED ? '#EAB308' : undefined; // vàng đậm
                    // Nền cả hàng CHỈ cho xám (Đã cho thuê).
                    const rowBg = cellOnlyBg ? undefined : statusRowBg(mau);
                    // Nền ô Mã Căn: trạng thái cell-only -> màu đậm; xám -> theo nền hàng; user tự tô -> hex.
                    const maCanBg = cellOnlyBg || (isStatus ? rowBg : (mau || 'transparent'));
                    const maCanWhiteText = !isStatus && mau; // chữ trắng khi có màu user
                    const isPaused = !!cellOnlyBg; // ô Mã Căn có màu đậm -> chữ trắng + bo góc
                    return (
                    <tr key={item._rowIndex} id={`ct-row-${item.Ma_Can}`} className="ct-row" style={st.tr}>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap', fontSize:12, background: isRecentUpdate(item.Ngay_Update) ? 'rgba(250, 204, 21, 0.22)' : undefined}}>{item.Ngay_Update}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:700, whiteSpace:'nowrap', background: maCanBg, color: (maCanWhiteText || isPaused) ? '#fff' : undefined, borderRadius: (isPaused || maCanWhiteText) ? 6 : 0}}>{item.Ma_Can}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>{item.Thiet_Ke}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>{(item.Dien_Tich||'').replace(/\s*m²|m2|m$/i,'').trim()}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>
                        <span style={{
                          background: item.Slot_Xe === 'Có' ? '#C6F6D5' : '#FED7D7',
                          color: item.Slot_Xe === 'Có' ? '#276749' : '#9B2C2C',
                          padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700,
                        }}>{item.Slot_Xe || 'Không'}</span>
                      </td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'normal', background: rowBg}}>{huongText(item.Huong_BC)}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:600, whiteSpace:'nowrap', background: rowBg}}>{item.Gia}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:700, whiteSpace:'nowrap', color:'#34D399', background: rowBg}}>{item.Gia_Net}</td>
                      <td style={{...st.td, textAlign:'center', fontSize:12, background: rowBg}}>{item.Phi_MG}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>{normalizeNoiThat(item.Noi_That)}</td>
                      <td style={{...st.td, textAlign:'center', fontSize:12, background: isSoonMoveIn(item.Thoi_Gian_Vao) ? 'rgba(34, 211, 238, 0.20)' : undefined}}>{item.Thoi_Gian_Vao}</td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'normal', wordBreak:'break-word', fontSize:12, background: rowBg}}>{item.Ten_Chu}</td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'normal', wordBreak:'break-word', fontSize:12, background: rowBg}}>{item.Lien_He}</td>
                      <td style={{...st.td, textAlign:'center', cursor:'pointer', background: rowBg}}
                        onClick={() => {
                          const urls = item.Hinh_Anh ? item.Hinh_Anh.split(',').map(u=>u.trim()).filter(Boolean) : [];
                          setLightbox({ urls: sortMedia(urls), index: 0, maCan: item.Ma_Can || 'media', defaultTab: urls.length ? 'anh' : 'matbang' });
                        }}
                      ><ThumbCell value={item.Hinh_Anh} /></td>
                      <td style={{...st.td, textAlign:'center', fontSize:12, background: rowBg}}>{item.Nguon}</td>
                      <td style={{...st.td, textAlign:'left', fontSize:12, color:'#94a3b8', background: rowBg}}>{item.Ghi_Chu}</td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap', borderRight:'none', background: rowBg}}>
                        <button onClick={() => copyCustomerInfo(item)} style={{...st.actionBtn, color:C.primary}} title="Copy thông tin gửi khách">&#128203;</button>
                        <button onClick={() => openEdit(item)} style={st.actionBtn} title="Sửa">&#9998;</button>
                        <button onClick={() => setDeleteTarget(item)} style={{...st.actionBtn, color:C.error}} title="Xoá">&#128465;</button>
                      </td>
                    </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL ── */}
      {modalMode !== 'closed' && (
        <div style={st.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="ct-modal-content" style={st.modal}>
            {/* Modal header */}
            <div style={st.modalHeader}>
              <div style={st.modalTitle}>
                {modalMode === 'add' ? '➕ Thêm Căn Thuê' : `✏️ Sửa căn ${editItem?.Ma_Can}`}
              </div>
              <button onClick={closeModal} style={st.modalClose}>&times;</button>
            </div>

            <div style={st.modalBody}>
              {/* ── AI Parse box (chỉ hiện khi thêm mới) ── */}
              {modalMode === 'add' && (
                <div style={{
                  background: parsed ? '#F0FFF4' : '#EBF8FF',
                  border: `1.5px solid ${parsed ? '#9AE6B4' : '#90CDF4'}`,
                  borderRadius: 12, padding: 16, marginBottom: 20,
                }}>
                  <div style={{ fontSize:12, fontWeight:700, color: parsed ? '#276749' : '#2B6CB0', marginBottom:8 }}>
                    {parsed ? '✅ AI đã parse — kiểm tra và chỉnh sửa bên dưới' : '🤖 Paste tin Zalo để AI tự điền'}
                  </div>
                  <textarea
                    value={rawText}
                    onChange={e => { setRawText(e.target.value); setParsed(false); }}
                    placeholder={`Ví dụ:\nCăn hộ:P0112a11\n- Thiết kế: 3n\n- Diện tích: 106m\n- Hướng ban công: Nam\n- Giá : 23tr phí đủ\n- Hiện trạng: full đồ\n- Thời gian vào: lun\n- Xem nhà lh : 0363560203`}
                    style={{
                      width:'100%', minHeight:110, padding:'10px 12px',
                      border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:13,
                      fontFamily:F, outline:'none', resize:'vertical', boxSizing:'border-box',
                      background:'#fff',
                    }}
                  />
                  <button
                    onClick={handleParse}
                    disabled={parsing || !rawText.trim()}
                    style={{
                      marginTop:10, padding:'9px 22px', borderRadius:8, border:'none',
                      background: parsing ? '#a0aec0' : '#3182CE',
                      color:'#fff', fontFamily:F, fontWeight:700, fontSize:14,
                      cursor: parsing||!rawText.trim() ? 'default':'pointer',
                      display:'flex', alignItems:'center', gap:8,
                    }}
                  >
                    {parsing ? (
                      <><span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⟳</span> Đang parse...</>
                    ) : '✨ Parse với AI'}
                  </button>
                </div>
              )}

              {/* ── Form fields ── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>

                {/* Mã căn */}
                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Mã Căn *" value={form.Ma_Can} onChange={v => set('Ma_Can', v.toUpperCase())} placeholder="VD: P0112A11, R6-1208" />
                </div>

                {/* Màu */}
                <div style={{ gridColumn:'1/-1' }}>
                  <ColorPicker value={form.Mau_Ma_Can} onChange={v => set('Mau_Ma_Can', v)} />
                </div>

                <FormField label="Thiết Kế" value={form.Thiet_Ke} onChange={v => set('Thiet_Ke', v)} placeholder="VD: 3PN, 2PN, Studio" />
                <FormField label="Diện Tích" value={form.Dien_Tich} onChange={v => set('Dien_Tich', v)} placeholder="VD: 106m²" />
                <FormField label="Hướng Ban Công" value={form.Huong_BC} onChange={v => set('Huong_BC', v)} placeholder="VD: Nam, Đông Nam" />

                {/* Slot xe */}
                <div>
                  <label style={st.fieldLabel}>Slot Xe</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['Có','Không'].map(opt => (
                      <button
                        key={opt} type="button"
                        onClick={() => set('Slot_Xe', opt)}
                        style={{
                          flex:1, padding:'9px 0', borderRadius:8, fontSize:14, fontWeight:700,
                          border:`1.5px solid ${form.Slot_Xe===opt ? (opt==='Có' ? '#38A169':'#E53E3E') : C.border}`,
                          background: form.Slot_Xe===opt ? (opt==='Có' ? '#C6F6D5':'#FED7D7') : '#fff',
                          color: form.Slot_Xe===opt ? (opt==='Có' ? '#276749':'#9B2C2C') : C.textMuted,
                          cursor:'pointer', fontFamily:F,
                        }}
                      >{opt}</button>
                    ))}
                  </div>
                </div>

                <FormField label="Giá" value={form.Gia} onChange={v => set('Gia', v)} placeholder="VD: 23 triệu" />
                <FormField label="Giá Nét" value={form.Gia_Net} onChange={v => set('Gia_Net', v)} placeholder="VD: 15 triệu (giá đã làm với chủ)" />
                <FormField label="Phí Môi Giới" value={form.Phi_MG} onChange={v => set('Phi_MG', v)} placeholder="VD: Phí đủ, 1 tháng" />

                {/* Nội Thất */}
                <div>
                  <label style={st.fieldLabel}>Nội Thất</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['Full đồ','Đồ cơ bản','Không đồ'].map(opt => (
                      <button key={opt} type="button" onClick={() => set('Noi_That', opt)}
                        style={{
                          flex:1, padding:'9px 0', borderRadius:8, fontSize:13, fontWeight:700,
                          border:`1.5px solid ${form.Noi_That===opt ? C.primary : C.border}`,
                          background: form.Noi_That===opt ? 'rgba(49,130,206,0.15)' : '#fff',
                          color: form.Noi_That===opt ? C.primary : C.textMuted,
                          cursor:'pointer', fontFamily:F,
                        }}
                      >{opt}</button>
                    ))}
                  </div>
                </div>

                <FormField label="Thời Gian Vào" value={form.Thoi_Gian_Vao} onChange={v => set('Thoi_Gian_Vao', v)} placeholder="VD: Luôn, Tháng 6/2025" />

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Tên Chủ" value={form.Ten_Chu} onChange={v => set('Ten_Chu', v)} placeholder="VD: Anh Nam, Chị Lan" />
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Liên Hệ (Chủ nhà / SĐT)" value={form.Lien_He} onChange={v => set('Lien_He', v)} placeholder="VD: 0363560203, Anh Nam" />
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Nguồn (Ai mang hàng về)" value={form.Nguon} onChange={v => set('Nguon', v)} placeholder="VD: Anh Phong, Chị Lan, Zalo nhóm..." />
                </div>

                {/* Ghi chú */}
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={st.fieldLabel}>Ghi Chú</label>
                  <textarea
                    value={form.Ghi_Chu}
                    onChange={e => set('Ghi_Chu', e.target.value)}
                    placeholder="Ghi chú thêm, ưu tiên khách ngoại, lưu ý..."
                    style={{ ...st.fieldInput, height:60, resize:'vertical' }}
                  />
                </div>
              </div>

              {/* ── Media upload (ảnh + video) ── */}
              <div style={{ marginTop:16 }}>
                <label style={st.fieldLabel}>Hình Ảnh / Video Căn</label>

                {/* Thumbnails */}
                {form.Hinh_Anh && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                    {form.Hinh_Anh.split(',').map(u=>u.trim()).filter(Boolean).map((url,i) => (
                      <div key={i} style={{ position:'relative' }}>
                        {isVideo(url) ? (
                          <div style={{ position:'relative', width:72, height:72 }}>
                            <video src={url} style={{ width:72, height:72, objectFit:'cover', borderRadius:8, border:'1px solid #3a3f52' }} muted />
                            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, background:'rgba(0,0,0,0.4)', borderRadius:8 }}>▶</span>
                          </div>
                        ) : (
                          <img src={url} alt="" style={{ width:72, height:72, objectFit:'cover', borderRadius:8, border:'1px solid #3a3f52' }} />
                        )}
                        <button
                          type="button" onClick={() => removeImage(url)}
                          style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:C.error, color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, lineHeight:'20px', textAlign:'center' }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropzone */}
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleMediaFiles(e.dataTransfer.files); }}
                  style={{
                    border:`2px dashed ${dragOver ? C.primary : uploading ? C.primary : '#3a3f52'}`,
                    borderRadius:10, padding:'16px 20px',
                    cursor: uploading ? 'default':'pointer',
                    textAlign:'center', color:'#8a9bb8', fontSize:13,
                    background: dragOver ? 'rgba(56,178,116,0.08)' : uploading ? 'rgba(56,178,116,0.05)' : '#1e2130',
                    transition:'all 0.15s',
                  }}
                >
                  {uploading
                    ? <><strong style={{color:'#e2e8f0'}}>Đang upload... {upProgress}%</strong><div style={{background:'#2d3240',borderRadius:4,height:4,marginTop:8}}><div style={{background:C.primary,width:`${upProgress}%`,height:'100%',borderRadius:4,transition:'width 0.3s'}}/></div></>
                    : form.Hinh_Anh ? '📷 Thêm ảnh / video (click hoặc kéo thả)' : '📷🎥 Click hoặc kéo thả ảnh, video vào đây'
                  }
                </div>
                <input
                  ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display:'none' }}
                  onChange={e => { handleMediaFiles(e.target.files); e.target.value=''; }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={st.modalFooter}>
              <button onClick={closeModal} style={st.cancelBtn} className="ct-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving||uploading} style={st.saveBtn} className="ct-btn">
                {saving ? 'Đang lưu...' : modalMode === 'edit' ? 'Cập nhật' : 'Lưu căn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={st.overlay} onClick={e => e.target===e.currentTarget && setDeleteTarget(null)}>
          <div style={st.confirmBox}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:12, color:C.text }}>Xác nhận xoá</div>
            <div style={{ fontSize:14, color:C.textMuted, marginBottom:20, lineHeight:1.5 }}>
              Xoá căn <strong>{deleteTarget.Ma_Can}</strong>? Hành động này không thể hoàn tác.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={st.cancelBtn} className="ct-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...st.saveBtn, background:C.error }} className="ct-btn">
                {saving ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import bảng hàng công ty */}
      <ImportSheetModal
        open={showImport}
        onClose={() => setShowImport(false)}
        config={IMPORT_CONFIG_THUE}
        existingItems={items}
        onImport={handleImportRows}
      />

      {/* Duplicate confirm */}
      {dupTarget && (
        <div style={st.overlay} onClick={e => e.target===e.currentTarget && setDupTarget(null)}>
          <div style={st.confirmBox}>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:12, color:C.text }}>Căn đã tồn tại</div>
            <div style={{ fontSize:14, color:C.textMuted, marginBottom:20, lineHeight:1.6 }}>
              Căn <strong style={{color:'#2d3748'}}>{dupTarget.existing.Ma_Can}</strong> đã có trên bảng hàng.<br/>
              Bạn có muốn cập nhật lại theo thông tin mới không?<br/>
              <span style={{fontSize:12}}>(Ảnh cũ sẽ được giữ lại nếu bạn chưa upload ảnh mới)</span>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setDupTarget(null)} style={st.cancelBtn} className="ct-btn">Huỷ</button>
              <button onClick={confirmDup} disabled={saving} style={st.saveBtn} className="ct-btn">
                {saving ? 'Đang cập nhật...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...st.toast, background: toast.type==='error' ? C.error : C.primary, animation:'ctToastIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}

      {lightbox && (
        <LightboxModal
          urls={lightbox.urls}
          startIndex={lightbox.index}
          maCan={lightbox.maCan}
          defaultTab={lightbox.defaultTab}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ──
function FormField({ label, value, onChange, type='text', placeholder='' }) {
  return (
    <div>
      <label style={st.fieldLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={st.fieldInput} />
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div>
      <label style={st.fieldLabel}>Màu mã căn</label>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {RAINBOW_COLORS.map(c => (
          <button key={c.value||'def'} type="button" onClick={() => onChange(c.value)} title={c.label}
            style={{
              width:30, height:30, borderRadius:7, background:c.value||'#333',
              border: value===c.value ? '3px solid #222':'2px solid #ddd',
              cursor:'pointer', transition:'all 0.15s',
              boxShadow: value===c.value ? `0 0 0 2px #fff, 0 0 0 4px ${c.value||'#333'}`:'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Lightbox ──
function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url) || url.includes('/video/upload/');
}

function extractBuilding(maCan) {
  // T181010 → T18 | P0112A11 → P01 | R6-1208 → R6
  const m = (maCan || '').toUpperCase().match(/^([A-Z]+\d{1,2})/);
  return m ? m[1] : null;
}

function FloorPlanTab({ maCan }) {
  const code = extractBuilding(maCan);
  const [src, setSrc] = useState(code ? `/mat-bang/${code}.jpg` : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (code) { setSrc(`/mat-bang/${code}.jpg`); setFailed(false); }
  }, [code]);

  if (!code) return <div style={lb.mbMsg}>Không xác định được mã tòa từ "{maCan}"</div>;
  if (failed)  return <div style={lb.mbMsg}>Chưa có ảnh mặt bằng cho tòa <strong>{code}</strong></div>;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      <div style={{ fontSize:13, color:'#8a9bb8' }}>Mặt bằng tòa <strong style={{color:'#e2e8f0'}}>{code}</strong></div>
      <img
        src={src} alt={`Mặt bằng ${code}`}
        style={{ maxWidth:'100%', maxHeight:'82vh', objectFit:'contain', borderRadius:10, boxShadow:'0 8px 40px rgba(0,0,0,0.7)' }}
        onError={() => {
          if (src?.endsWith('.jpg')) setSrc(`/mat-bang/${code}.png`);
          else setFailed(true);
        }}
      />
    </div>
  );
}

function LightboxModal({ urls, startIndex, maCan = 'anh', defaultTab = 'anh', onClose }) {
  const [tab, setTab]           = useState(defaultTab); // 'anh' | 'matbang'
  const [idx, setIdx]           = useState(startIndex);
  const [downloading, setDl]    = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (tab !== 'anh') { if (e.key === 'Escape') onClose(); return; }
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(urls.length - 1, i + 1));
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [urls.length, onClose, tab]);

  async function dlOne(url, name) {
    try {
      const blob = await fetch(url).then(r => r.blob());
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(blobUrl);
    } catch(e) {}
  }

  async function dlAll() {
    setDl(true);
    for (let i = 0; i < urls.length; i++) {
      await dlOne(urls[i], `${maCan}_${i + 1}.jpg`);
      if (i < urls.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    setDl(false);
  }

  return (
    <div style={lb.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={lb.container}>
        {/* Top bar */}
        <div style={lb.topBar}>
          {/* Tabs */}
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setTab('anh')}
              style={{ ...lb.tabBtn, ...(tab==='anh' ? lb.tabBtnActive : {}) }}>
              📷 Ảnh
            </button>
            <button onClick={() => setTab('matbang')}
              style={{ ...lb.tabBtn, ...(tab==='matbang' ? lb.tabBtnActive : {}) }}>
              🗺 Mặt Bằng
            </button>
          </div>
          {/* Right controls */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {tab === 'anh' && <>
              <span style={lb.counter}>{idx + 1} / {urls.length}</span>
              <button onClick={() => dlOne(urls[idx], `${maCan}_${idx+1}.jpg`)} style={lb.dlBtn}>⬇ Ảnh này</button>
              <button onClick={dlAll} disabled={downloading} style={lb.dlAllBtn}>
                {downloading ? '⏳ Đang tải...' : `⬇ Tất cả (${urls.length})`}
              </button>
            </>}
            <button onClick={onClose} style={lb.closeBtn}>✕</button>
          </div>
        </div>

        {tab === 'anh' ? (<>
          {/* Main image/video */}
          <div style={lb.imgWrap}>
            {idx > 0 && <button onClick={() => setIdx(i => i - 1)} style={lb.arrowLeft}>‹</button>}
            {isVideoUrl(urls[idx]) ? (
              <video key={urls[idx]} src={urls[idx]} controls autoPlay style={lb.img} />
            ) : (
              <img src={urls[idx]} alt="" style={lb.img} />
            )}
            {idx < urls.length - 1 && <button onClick={() => setIdx(i => i + 1)} style={lb.arrowRight}>›</button>}
          </div>

          {/* Thumbnail strip */}
          {urls.length > 1 && (
            <div style={lb.thumbRow}>
              {urls.map((u, i) => (
                <div key={i} onClick={() => setIdx(i)}
                  style={{ position:'relative', cursor:'pointer', borderRadius:7, overflow:'hidden', flexShrink:0,
                    width:58, height:58, border: i===idx ? '2px solid #38b274' : '2px solid transparent',
                    opacity: i===idx ? 1 : 0.55, transform: i===idx ? 'scale(1.08)':'scale(1)', transition:'all 0.15s',
                  }}
                >
                  {isVideoUrl(u) ? (
                    <>
                      <video src={u} style={{width:58,height:58,objectFit:'cover'}} muted />
                      <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,background:'rgba(0,0,0,0.4)'}}>▶</span>
                    </>
                  ) : (
                    <img src={u} alt="" style={{width:58,height:58,objectFit:'cover'}} />
                  )}
                </div>
              ))}
            </div>
          )}
        </>) : (
          <FloorPlanTab maCan={maCan} />
        )}
      </div>
    </div>
  );
}

const lb = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.93)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'12px' },
  container:   { display:'flex', flexDirection:'column', width:'100%', maxWidth:1200, gap:10, fontFamily:F },
  topBar:      { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px' },
  tabBtn:      { background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'7px 16px', color:'#8a9bb8', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:F, transition:'all 0.15s' },
  tabBtnActive:{ background:'rgba(56,178,116,0.2)', border:'1px solid #38b274', color:'#38b274' },
  counter:     { color:'#e2e8f0', fontSize:14, fontWeight:600 },
  mbMsg:       { textAlign:'center', padding:'60px 20px', color:'#8a9bb8', fontSize:14 },
  dlBtn:       { background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'7px 14px', color:'#e2e8f0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:F },
  dlAllBtn:    { background:'linear-gradient(135deg,#38b274,#2a8a5a)', border:'none', borderRadius:8, padding:'7px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:'0 2px 8px rgba(56,178,116,0.4)' },
  closeBtn:    { background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, width:36, height:36, color:'#e2e8f0', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 },
  imgWrap:     { position:'relative', display:'flex', alignItems:'center', justifyContent:'center' },
  img:         { maxWidth:'100%', maxHeight:'80vh', objectFit:'contain', borderRadius:10, boxShadow:'0 8px 40px rgba(0,0,0,0.7)' },
  arrowLeft:   { position:'absolute', left:0, background:'rgba(0,0,0,0.55)', border:'none', color:'#fff', fontSize:42, width:52, height:72, cursor:'pointer', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, zIndex:1 },
  arrowRight:  { position:'absolute', right:0, background:'rgba(0,0,0,0.55)', border:'none', color:'#fff', fontSize:42, width:52, height:72, cursor:'pointer', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, zIndex:1 },
  thumbRow:    { display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', paddingTop:4 },
  thumb:       { width:58, height:58, objectFit:'cover', borderRadius:7, cursor:'pointer', opacity:0.5, border:'2px solid transparent', transition:'all 0.15s' },
  thumbActive: { opacity:1, border:'2px solid #38b274', transform:'scale(1.08)' },
};

// ── Styles ──
const D = '1.5px solid rgba(255,255,255,0.22)';
const st = {
  addBtn:      { background:C.gradient, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:C.shadowGreen, whiteSpace:'nowrap' },
  importBtn:   { background:'#22263a', color:C.primaryLight, border:'1.5px solid #3a3f52', borderRadius:10, padding:'10px 16px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' },
  reloadBtn:   { background:'#22263a', border:'1.5px solid #3a3f52', borderRadius:10, width:40, height:40, fontSize:20, color:C.primary, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontFamily:F },
  searchInput: { width:'100%', padding:'10px 36px', border:'1.5px solid #3a3f52', borderRadius:10, fontSize:13, fontFamily:F, outline:'none', background:'#1e2130', color:'#e2e8f0', boxSizing:'border-box' },
  clearBtn:    { position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:18, color:'#8a9bb8', cursor:'pointer' },
  errorBox:    { background:'#FEF2F2', color:C.error, padding:'12px 16px', borderRadius:10, fontSize:13, marginBottom:16 },
  loadingBox:  { textAlign:'center', padding:40, color:'#8a9bb8', fontSize:14 },
  tableWrap:   { background:'#1a1d27', borderRadius:12, border:'1px solid #2d3240', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' },
  table:       { width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' },
  th:          { textAlign:'center', padding:'10px 8px', fontWeight:700, fontSize:11, textTransform:'uppercase', color:'#8a9bb8', borderBottom:'2px solid #2d3240', borderRight:D, whiteSpace:'nowrap', background:'#13151e' },
  tr:          { borderBottom:'1.5px solid rgba(255,255,255,0.22)', transition:'background 0.12s' },
  td:          { padding:'8px 8px', verticalAlign:'middle', fontSize:13, borderRight:D, color:'#e2e8f0' },
  emptyTd:     { textAlign:'center', padding:40, color:'#8a9bb8', fontSize:14 },
  toaHeader:   { background:'#EF4444', padding:'7px 0', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.18)', borderBottom:'1px solid rgba(255,255,255,0.18)' },
  toaLabel:    { fontWeight:700, fontSize:13, color:'#fff', letterSpacing:3, textTransform:'uppercase' },
  actionBtn:   { background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'4px 6px', borderRadius:6, color:C.textMuted },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'#fff', borderRadius:16, width:620, maxWidth:'100%', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:C.shadowLg, animation:'ctSlideUp 0.25s ease', overflow:'hidden' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${C.border}`, background:`linear-gradient(135deg, ${C.primary}, #2a5a8c)` },
  modalTitle:  { fontSize:16, fontWeight:700, color:'#fff' },
  modalClose:  { background:'none', border:'none', fontSize:22, color:'rgba(255,255,255,0.7)', cursor:'pointer', lineHeight:1 },
  modalBody:   { padding:'20px', overflowY:'auto', flex:1 },
  modalFooter: { display:'flex', gap:10, justifyContent:'flex-end', padding:'12px 20px', borderTop:`1px solid ${C.border}` },
  fieldLabel:  { display:'block', fontSize:11, fontWeight:700, color:C.textMuted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' },
  fieldInput:  { width:'100%', padding:'9px 12px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:F, outline:'none', boxSizing:'border-box', background:C.bgInput },
  cancelBtn:   { background:'none', border:`1.5px solid ${C.border}`, borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:F, color:C.textMuted },
  saveBtn:     { background:C.gradient, color:'#fff', border:'none', borderRadius:10, padding:'9px 28px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:C.shadowGreen },
  confirmBox:  { background:'#fff', borderRadius:16, padding:24, width:380, maxWidth:'100%', boxShadow:C.shadowLg, animation:'ctSlideUp 0.2s ease' },
  toast:       { position:'fixed', bottom:24, right:24, padding:'12px 20px', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, fontFamily:F, boxShadow:C.shadowMd, zIndex:2000 },
};
