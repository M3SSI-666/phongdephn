import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { C } from '../utils/theme';
import {
  fetchQuyCanBan, postQuyCanBan, fetchQuyCanBanCon, postQuyCanBanCon,
  fetchQuyDapThong, postQuyDapThong, fetchQuyDapThongCon, postQuyDapThongCon,
  parseBan, uploadToCloudinary, parseSearchQuery,
} from '../utils/api';
import {
  normalizeThietKe, mapPhi, isDateSerialGia, conKey, expectOf,
  STATUS_GRAY, STATUS_PAUSED, INVEST_COLOR,
} from '../utils/quyCanShared';
import { parseBangCon, validateTagName } from '../utils/conTagState';
import { useConTags } from '../utils/useConTags';
import ImportSheetModal from '../components/ImportSheetModal';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

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

const EMPTY_FORM = {
  Ma_Can: '', Thiet_Ke: '', Dien_Tich: '', Slot_Xe: 'Không',
  Huong_BC: '', Huong_Cua: '', Gia: '', Gia_Net: '', Phi: 'Thu về',
  Noi_That: 'Đồ cơ bản', SDT: '', Ten_Chu: '', Hinh_Anh: '', Nguon: '', Ghi_Chu: '', Mau_Ma_Can: '',
};

// Bảng hàng con (tag) cho Quỹ Căn Bán.
const DEFAULT_TAGS_BAN = [
  '1 ngủ', '2 ngủ', '2 ngủ slot', '3 ngủ', '3 ngủ slot', '4 ngủ',
];
// Quỹ Đập Thông dùng chung giao diện nhưng chia theo khu, không theo số phòng ngủ.
const DEFAULT_TAGS_DAPTHONG = ['Khu T', 'Khu P'];

function normalizeNoiThat(val) {
  const s = (val || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!s) return '';
  if (s.includes('full') || s.includes('day du') || s.includes('du do') || s.includes('co đo') || s.includes('đu đo') || s.includes('đay đu')) return 'Full đồ';
  if (s.includes('khong') || s.includes('trong') || s.includes('tho')) return 'Không đồ';
  return 'Đồ cơ bản';
}

// ── Trạng thái căn qua màu nền ô Mã Căn (import từ bảng công ty) ──
const STATUS_SOLD   = STATUS_GRAY; // xám -> Đã bán (bên Thuê cùng màu này = Đã cho thuê)
const STATUS_COLORS = new Set([STATUS_SOLD, STATUS_PAUSED]);

// Nền mờ hàng theo màu trạng thái (dark theme).
function statusRowBg(mau) {
  if (mau === STATUS_SOLD)   return 'rgba(148,163,184,0.16)';
  if (mau === STATUS_PAUSED) return 'rgba(250,204,21,0.16)';
  return undefined;
}

// Viết tắt hướng ban công -> tên đầy đủ. T=Tây, B=Bắc, N=Nam, Đ=Đông;
// 2 ký tự ghép lại: TB=Tây Bắc, ĐN=Đông Nam... Nếu đã là tên đầy đủ thì giữ nguyên.
const HUONG_MAP = { T: 'Tây', B: 'Bắc', N: 'Nam', D: 'Đông', Đ: 'Đông' };
function huongText(val) {
  const s = (val || '').toString().trim();
  if (!s) return '';
  const key = s.toUpperCase().replace(/[\s.]/g, '');
  if (/^[TBNDĐ]{1,2}$/.test(key)) {
    const words = key.split('').map(ch => HUONG_MAP[ch]).filter(Boolean);
    if (words.length) return words.join(' ');
  }
  return s;
}

// Tách "tòa" và "tầng" từ Mã Căn (VD: P11-1205 -> {toa:'P11', tang:'12'};
// T01305 -> {toa:'T01', tang:'3'}). 4 số -> 2 số đầu là tầng; 3 số -> 1 số đầu.
function parseToaTang(maCan) {
  const s = (maCan || '').toString().toUpperCase().trim();
  const mToa = s.match(/^([A-Z]+\d{1,2})/);
  const toa = mToa ? mToa[1] : '';
  let tang = '';
  const rest = toa ? s.slice(toa.length).replace(/^[-\s]/, '') : s;
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

// Ghép Nội Thất + Slot Xe thành câu "Hiện trạng".
function hienTrangText(item) {
  const nt = normalizeNoiThat(item.Noi_That);
  const parts = [];
  if (nt) parts.push(nt);
  if (item.Slot_Xe === 'Có') parts.push('có slot xe');
  else if (item.Slot_Xe === 'Không') parts.push('không có slot xe');
  return parts.join(', ');
}

// Viết đầy đủ giá bán cho tin nhắn: "13" -> "13 tỷ"; "13 tỷ" giữ nguyên;
// đơn giá /m² (VD "115tr/m2") -> "115 triệu/m²". Không nhận ra thì giữ nguyên.
function giaTextBan(val) {
  const s = (val || '').toString().trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  // Đơn giá /m² (VD "115tr/m2") -> giữ dạng triệu/m²; xét TRƯỚC guard serial ngày
  // (bỏ chữ, "115tr/m2" -> "1152" >= 1000 sẽ bị nhầm là serial).
  if (/\/\s*m/.test(lower)) {
    const pm = lower.match(/([\d.,]+)/);
    if (pm) return `${pm[1]} triệu/m²`;
    return s;
  }
  if (isDateSerialGia(s)) return ''; // ô Giá là serial ngày Excel -> bỏ
  const ty = lower.match(/([\d.,]+)\s*t[ỷy]/);
  if (ty) return `${ty[1]} tỷ`;
  const tr = lower.match(/([\d.,]+)\s*(?:tr|triệu|trieu)/);
  if (tr) return `${tr[1]} triệu`;
  // Số trần không đơn vị -> hiểu là tỷ (giá bán).
  if (/^[\d.,]+$/.test(s)) return `${s} tỷ`;
  return s;
}

// Tạo tin nhắn gửi khách từ 1 căn bán (để copy vào clipboard).
function buildCustomerMessage(item) {
  const { toa, tang } = parseToaTang(item.Ma_Can);
  const header = toa
    ? `Thông tin căn hộ tòa ${toa}${tang ? ` – tầng ${tang}` : ''}:`
    : `Thông tin căn hộ ${item.Ma_Can || ''}:`;
  const lines = [header];
  const tk = thietKeText(item.Thiet_Ke);
  if (tk) lines.push(`- Thiết kế: ${tk}`);
  const dt = (item.Dien_Tich || '').replace(/\s*m²|m2|m$/i, '').trim();
  if (dt) lines.push(`- Diện tích: ${dt} m²`);
  const hbc = huongText(item.Huong_BC);
  if (hbc) lines.push(`- Hướng ban công: ${hbc}`);
  const ht = hienTrangText(item);
  if (ht) lines.push(`- Hiện trạng: ${ht}`);
  const gia = giaTextBan(item.Gia_Net || item.Gia); // ưu tiên giá nét nếu có
  if (gia) {
    const phi = mapPhi(item.Phi);
    lines.push(`- Giá: ${gia}${phi ? ` ${phi.toLowerCase()}` : ''}`);
  }
  return lines.join('\n');
}

// Ngày hôm nay dd/mm/yyyy theo máy user (server Vercel chạy UTC nên tính ở client).
function todayVN() {
  return new Date().toLocaleDateString('vi-VN');
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

// Diện tích có thể ghi cộng gộp (VD "75 + 25" = 100 = phần chính + logia). Cộng các phần lại
// thay vì nối chuỗi số ("75+25" -> 7525). Bỏ đơn vị (m², m2, m). Rỗng/không parse được -> 0.
function parseDienTich(val) {
  const s = (val || '').toString().replace(/,/g, '.');
  const nums = s.match(/[\d.]+/g);
  if (!nums) return 0;
  return nums.reduce((sum, n) => sum + (parseFloat(n) || 0), 0);
}

const TABLE_HEADERS = [
  'Ngày Update', 'Mã Căn', 'Thiết Kế', 'DT', 'Slot Xe',
  'Hướng BC', 'Giá', 'Giá Nét', 'Tr/m²', 'Phí', 'SDT', 'Tên Chủ', 'Ảnh', 'Nguồn', 'Ghi Chú', '',
];
const COL_WIDTHS = [92, 100, 72, 66, 76, 80, 72, 80, 80, 110, 100, 110, 100, 80, 320, 104];

export function QuyCanBanContent({ overrideUserId, overrideRole, isViewAs } = {}) {
  return <QuyCanBanInner overrideUserId={overrideUserId} overrideRole={overrideRole} isViewAs={isViewAs} />;
}

export default function QuyCanBan() {
  return <QuyCanBanInner />;
}

// Tái sử dụng toàn bộ giao diện Quỹ Căn Bán cho Quỹ Đập Thông (cùng cấu trúc bảng),
// chỉ khác nguồn dữ liệu (API quydapthong).
export function QuyDapThongContent({ overrideUserId, overrideRole, isViewAs } = {}) {
  return (
    <QuyCanBanInner
      overrideUserId={overrideUserId}
      overrideRole={overrideRole}
      isViewAs={isViewAs}
      fetchFn={fetchQuyDapThong}
      postFn={postQuyDapThong}
      fetchConFn={fetchQuyDapThongCon}
      postConFn={postQuyDapThongCon}
      tagStorageKey="bangConTags_dapthong"
      defaultTags={DEFAULT_TAGS_DAPTHONG}
      moduleKey="dapthong"
      importLogKey="importLog_dapthong"
    />
  );
}

function formatTs(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mn = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm} ${hh}:${mn}`;
}

function QuyCanBanInner({
  overrideUserId, overrideRole, isViewAs = false,
  fetchFn = fetchQuyCanBan, postFn = postQuyCanBan,
  fetchConFn = fetchQuyCanBanCon, postConFn = postQuyCanBanCon,
  tagStorageKey = 'bangConTags_ban', defaultTags = DEFAULT_TAGS_BAN,
  moduleKey = 'ban', importLogKey = 'importLog_ban',
} = {}) {
  const { user } = useUser();
  const userId = overrideUserId || user?.id;
  const role   = overrideRole   || user?.publicMetadata?.role || 'staff';
  const [items, setItems]           = useState([]);
  const [conItems, setConItems]     = useState([]);     // sheet con (kho riêng của user, độc lập)
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [importLog, setImportLog]   = useState(() => { try { return JSON.parse(localStorage.getItem(importLogKey) || '[]'); } catch { return []; } });
  const [error, setError]           = useState('');
  const [aiQuery, setAiQuery]       = useState('');
  const [aiFilter, setAiFilter]     = useState(null);
  const [aiSearching, setAiSearching] = useState(false);

  const [modalMode, setModalMode]   = useState('closed');
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [showImport, setShowImport] = useState(false);

  const [rawText, setRawText]       = useState('');
  const [parsing, setParsing]       = useState(false);
  const [parsed, setParsed]         = useState(false);

  const [uploading, setUploading]   = useState(false);
  const [upProgress, setUpProgress] = useState(0);
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef                = useRef();

  const [toast, setToast]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dupTarget, setDupTarget]   = useState(null); // { existing, payload }
  const [lightbox, setLightbox]     = useState(null);
  // Ẩn căn theo trạng thái (mỗi checkbox độc lập).
  const [hideSold, setHideSold]     = useState(false); // ẩn "đã bán" (xám)
  const [hidePausedRow, setHidePausedRow] = useState(false); // ẩn "dừng bán" (vàng)
  // Bảng hàng con (tag) — kho riêng của từng user, bật ở cả Quỹ Căn Bán và Đập Thông.
  const [activeTag, setActiveTag]   = useState(null);
  const [customTags, setCustomTags] = useState(() => { try { return JSON.parse(localStorage.getItem(tagStorageKey) || '[]'); } catch { return []; } });
  const [tagMenuFor, setTagMenuFor] = useState(null);
  const toastTimer                  = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes cbSlideUp { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
      @keyframes cbToastIn  { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
      .cb-row:hover { background: rgba(255,255,255,0.06) !important; }
      .cb-btn:active { transform: scale(0.97); }
      .cb-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .cb-table-wrap::-webkit-scrollbar { height:6px; }
      .cb-table-wrap::-webkit-scrollbar-thumb { background:${C.textDim}; border-radius:3px; }
      @keyframes cbRowPulse { 0%,100%{background:transparent} 30%{background:rgba(56,178,116,0.22)} }
      .cb-row-highlight { animation: cbRowPulse 2s ease !important; outline: 2px solid rgba(56,178,116,0.6) !important; outline-offset:-2px; border-radius:4px; }
      @media(max-width:640px){
        .cb-modal-content { width:100%!important; height:100%!important; max-height:100%!important; border-radius:0!important; }
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
      const data = await fetchFn(userId, role, isViewAs);
      setItems(Array.isArray(data) ? data : []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId, role, isViewAs, fetchFn]);

  // Gán lại ngay dưới useConTags. Dữ liệu bảng con từ mạng chỉ được đè lên state khi
  // không còn lần gắn thẻ nào đang bay, nếu không sẽ nuốt mất thẻ user vừa tick.
  const canApplyRemoteRef = useRef(() => true);

  const loadConData = useCallback(async () => {
    try {
      const data = await fetchConFn(userId, role, isViewAs);
      if (canApplyRemoteRef.current()) setConItems(Array.isArray(data) ? data : []);
    } catch { /* sheet con có thể chưa tạo — bỏ qua */ }
  }, [userId, role, isViewAs, fetchConFn]);

  useEffect(() => { loadData(); loadConData(); }, [loadData, loadConData]);

  useEffect(() => {
    const iv = setInterval(() => {
      fetchFn(userId, role, isViewAs).then(d => setItems(Array.isArray(d)?d:[])).catch(()=>{});
      fetchConFn(userId, role, isViewAs).then(d => {
        if (canApplyRemoteRef.current()) setConItems(Array.isArray(d)?d:[]);
      }).catch(()=>{});
    }, 30000);
    return () => clearInterval(iv);
  }, [fetchFn, fetchConFn, userId, role, isViewAs]);

  function parseGiaValue(gia) {
    if (isDateSerialGia(gia)) return null; // ô Giá là serial ngày Excel (VD "45800", "45800 tỷ") -> không phải giá
    // Chuẩn hoá: bỏ khoảng trắng, đổi dấu phẩy thập phân -> chấm ("5,8" == "5.8").
    const s = (gia||'').toLowerCase().replace(/\s+/g,'').replace(/,/g,'.');
    const ty = s.match(/([\d.]+)t[ỷy]/);
    if (ty) return parseFloat(ty[1]) * 1000;
    const tr = s.match(/([\d.]+)tr|triệu/); if (tr && tr[1]) return parseFloat(tr[1]);
    const n = s.match(/([\d.]+)/);
    if (!n) return null;
    const v = parseFloat(n[1]);
    // Số trần không đơn vị: giá bán tính bằng tỷ (VD "5.8" = 5.8 tỷ = 5800 triệu).
    // Ngưỡng < 1000 để phân biệt với giá đã ghi bằng triệu (hiếm khi số trần).
    return v < 1000 ? v * 1000 : v;
  }

  // Nếu Giá ghi sẵn ĐƠN GIÁ /m² (VD "200tr/m", "85-90tr", "100/m") -> trả về số đơn giá (đầu thấp);
  // ngược lại trả null. Nhận diện: có "tr"/"triệu" HOẶC hậu tố "/m" (VD "100/m" = 100tr/m²),
  // và giá trị nhỏ (< 500).
  function perM2Price(item) {
    const s = (item.Gia||'').toLowerCase().replace(/\s+/g,'').replace(/,/g,'.');
    if (!/tr|triệu/.test(s) && !/\/m/.test(s)) return null; // "/m" = per m² dù không ghi "tr"
    const nums = (s.match(/[\d.]+/g) || []).map(parseFloat).filter(v => !isNaN(v));
    const low = nums.length ? Math.min(...nums) : null;
    return (low != null && low < 500) ? Math.round(low) : null;
  }

  // Đơn giá tr/m². Nếu Giá đã ghi sẵn đơn giá thì lấy trực tiếp; ngược lại (Giá là tổng,
  // tính bằng tỷ) thì chia cho diện tích.
  function trPerM2(item) {
    const dt = parseDienTich(item.Dien_Tich);
    // Ưu tiên Giá Nét (giá đã làm với chủ): chia cho diện tích ra đơn giá.
    if ((item.Gia_Net||'').toString().trim()) {
      const gn = parseGiaValue(item.Gia_Net);
      if (gn && dt) return Math.round(gn / dt);
    }
    const direct = perM2Price(item);
    if (direct != null) return direct;
    const g = parseGiaValue(item.Gia);
    return (g && dt) ? Math.round(g / dt) : null;
  }

  function buildFilterSummary(f) {
    if (f._exactMaCan) return `Mã căn: ${f._exactMaCan}`;
    const parts = [];
    if (f.Thiet_Ke) parts.push(f.Thiet_Ke);
    if (f.Slot_Xe) parts.push('Slot: ' + f.Slot_Xe);
    if (f.Gia_Min != null && f.Gia_Max != null) parts.push(`${f.Gia_Min >= 1000 ? f.Gia_Min/1000+'tỷ' : f.Gia_Min+'tr'}–${f.Gia_Max >= 1000 ? f.Gia_Max/1000+'tỷ' : f.Gia_Max+'tr'}`);
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

  // Đang xem 1 tab con (bảng con) hay tab "Tất cả" (bảng chính công ty)?
  const viewingCon = activeTag !== null;
  // Cột "Giá Nét" (index 7) chỉ hiện ở tab con.
  const headers   = viewingCon ? TABLE_HEADERS : TABLE_HEADERS.filter((_, i) => i !== 7);
  const colWidths = viewingCon ? COL_WIDTHS    : COL_WIDTHS.filter((_, i) => i !== 7);
  // Bảng hàng công ty dùng chung: chỉ admin được sửa. Bảng con là kho riêng nên ai cũng sửa được.
  const canEditMain = role === 'admin';
  const canEdit = viewingCon || canEditMain;

  const filtered = useMemo(() => {
    // Tab con → dữ liệu từ sheet con, lọc theo tag. Tab Tất cả → bảng hàng chính công ty.
    let list = viewingCon
      ? conItems.filter(it => parseBangCon(it.Bang_Con).includes(activeTag))
      : [...items];
    if (aiFilter) {
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
    // Ẩn căn theo trạng thái (2 checkbox độc lập).
    if (hideSold)      list = list.filter(it => (it.Mau_Ma_Can||'') !== STATUS_SOLD);
    if (hidePausedRow) list = list.filter(it => (it.Mau_Ma_Can||'') !== STATUS_PAUSED);
    return list;
  }, [items, conItems, viewingCon, activeTag, aiFilter, hideSold, hidePausedRow]);

  // Danh sách tag (mặc định + tự thêm) và số lượng căn mỗi tag.
  // Cố tình KHÔNG lấy tag lạ có sẵn trong dữ liệu — thanh chip chỉ hiện đúng bộ tag đang dùng.
  const { allTags, tagCounts } = useMemo(() => {
    const counts = {};
    for (const it of conItems) for (const t of parseBangCon(it.Bang_Con)) counts[t] = (counts[t] || 0) + 1;
    const seen = new Set(), all = [];
    for (const t of [...defaultTags, ...customTags]) {
      if (!seen.has(t)) { seen.add(t); all.push(t); }
    }
    return { allTags: all, tagCounts: counts };
  }, [conItems, customTags, defaultTags]);

  function addCustomTag() {
    const name = (window.prompt('Tên bảng hàng con mới:') || '').trim();
    if (!name) return;
    if (allTags.includes(name)) { setActiveTag(name); return; }
    const err = validateTagName(name, allTags);
    if (err) return showToast(err, 'error');
    const next = [...customTags, name];
    setCustomTags(next);
    try { localStorage.setItem(tagStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  // Tất cả cột dữ liệu (trừ _rowIndex) để copy 1 căn sang sheet con.
  function conPayloadFrom(item, extra = {}) {
    return {
      Owner_Id: userId || '', // bảng con luôn thuộc về user hiện tại
      Ma_Can: item.Ma_Can, Thiet_Ke: item.Thiet_Ke, Dien_Tich: item.Dien_Tich, Slot_Xe: item.Slot_Xe,
      Huong_BC: item.Huong_BC, Huong_Cua: item.Huong_Cua, Gia: item.Gia, Phi: item.Phi,
      Noi_That: item.Noi_That, SDT: item.SDT, Ten_Chu: item.Ten_Chu, Hinh_Anh: item.Hinh_Anh,
      Nguon: item.Nguon, Ghi_Chu: item.Ghi_Chu, Mau_Ma_Can: item.Mau_Ma_Can || '',
      Gia_Net: item.Gia_Net || '', Ngay_Update: item.Ngay_Update,
      ...extra,
    };
  }

  // Dòng con mới dựng từ 1 căn. Bỏ màu user (bản con là bản sao độc lập, user tự tô lại)
  // và đóng dấu ngày hôm nay vì chuyển sang bảng con là 1 thay đổi.
  const buildAddRow = useCallback(
    (item) => conPayloadFrom(item, { Mau_Ma_Can: '', Ngay_Update: todayVN() }),
    [userId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { setConTag, pending: tagPending, canApplyRemote } = useConTags({
    conItems, setConItems, postConFn, loadConData, showToast, userId, buildAddRow,
  });
  canApplyRemoteRef.current = canApplyRemote;

  const TOA_ORDER = [
    'T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11',
    'P01','P02','P03','T18','P05','P06','P07','P08',
    'P09','P10','P11','P12',
  ];

  const grouped = useMemo(() => {
    function parsePN(thietKe) {
      const m = (thietKe || '').match(/(\d+)\s*[Pp][Nn]/);
      return m ? parseInt(m[1]) : 99;
    }
    function parseDT(dt) {
      return parseDienTich(dt);
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
        // sắp xếp CHÍNH theo đơn giá Tr/m² từ thấp -> cao (bất kể số PN)
        const ta = trPerM2(a), tb = trPerM2(b);
        const va = ta == null ? Infinity : ta;
        const vb = tb == null ? Infinity : tb;
        if (va !== vb) return va - vb;
        const pn = parsePN(a.Thiet_Ke) - parsePN(b.Thiet_Ke);
        if (pn !== 0) return pn;
        return parseDT(b.Dien_Tich) - parseDT(a.Dien_Tich); // diện tích lớn hơn lên trên
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
    if (r.Khu != null) {
      const qNorm = originalQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      const userSaidHill    = qNorm.includes('hill') || qNorm.includes('parkhill');
      const userSaidPremium = qNorm.includes('premium') || qNorm.includes('g4');
      const userSaidPark    = qNorm.includes('park');
      if (userSaidPark && !userSaidHill && !userSaidPremium) {
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

  async function handleParse() {
    if (!rawText.trim()) return showToast('Hãy paste tin Zalo vào trước', 'error');
    setParsing(true); setParsed(false);
    try {
      const result = await parseBan(rawText);
      const ghiChuNote = result.Ghi_Chu_NT?.trim() || '';
      setForm(prev => ({
        ...prev,
        Ma_Can:    (result.Ma_Can    || prev.Ma_Can).toUpperCase(),
        Thiet_Ke:  result.Thiet_Ke  || prev.Thiet_Ke,
        Dien_Tich: result.Dien_Tich || prev.Dien_Tich,
        Slot_Xe:   result.Slot_Xe   || prev.Slot_Xe,
        Huong_BC:  result.Huong_BC  || prev.Huong_BC,
        Gia:       result.Gia       || prev.Gia,
        Phi:       result.Phi       || prev.Phi || 'Thu về',
        Noi_That:  result.Noi_That  || prev.Noi_That,
        SDT:       result.SDT       || prev.SDT,
        Ten_Chu:   result.Ten_Chu   || prev.Ten_Chu,
        Ghi_Chu:   ghiChuNote ? (prev.Ghi_Chu ? prev.Ghi_Chu + ', ' + ghiChuNote : ghiChuNote) : prev.Ghi_Chu,
      }));
      setParsed(true);
      showToast('AI đã điền thông tin — kiểm tra lại trước khi lưu');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setParsing(false); }
  }

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

  function openAdd() {
    setRawText(''); setParsed(false);
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setModalMode('add');
  }

  function openEdit(item) {
    setRawText(''); setParsed(false);
    setEditItem({ ...item, _fromCon: viewingCon }); // nhớ sửa bản con hay bản chính
    setForm({
      Ma_Can:    item.Ma_Can    || '',
      Thiet_Ke:  item.Thiet_Ke  || '',
      Dien_Tich: item.Dien_Tich || '',
      Slot_Xe:   item.Slot_Xe   || 'Không',
      Huong_BC:  item.Huong_BC  || '',
      Huong_Cua: item.Huong_Cua || '',
      Gia:       item.Gia       || '',
      Gia_Net:   item.Gia_Net   || '',
      Phi:       item.Phi       || 'Thu về',
      Noi_That:  item.Noi_That  || '',
      SDT:       item.SDT       || '',
      Ten_Chu:   item.Ten_Chu   || '',
      Hinh_Anh:  item.Hinh_Anh  || '',
      Nguon:     item.Nguon     || '',
      Ghi_Chu:   item.Ghi_Chu   || '',
      Mau_Ma_Can:item.Mau_Ma_Can|| '',
    });
    setModalMode('edit');
  }

  function closeModal() { setModalMode('closed'); setEditItem(null); }
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  function pushImportLog(maCan) {
    const entry = { Ma_Can: maCan, ts: new Date().toISOString() };
    setImportLog(prev => {
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem(importLogKey, JSON.stringify(next));
      return next;
    });
  }

  // Server trả 409 khi dòng ở _rowIndex không còn là dòng mình định sửa (ai đó xoá
  // dòng phía trên trong sheet con dùng chung). Tải lại rồi bắt user thao tác lại.
  function onWriteError(e) {
    if (!e?.stale) return showToast(e.message, 'error');
    showToast('Dòng đã đổi vị trí, đã tải lại — thao tác lại giúp', 'error');
    loadConData();
  }

  async function handleSave() {
    if (!form.Ma_Can.trim()) return showToast('Vui lòng nhập Mã căn', 'error');
    try {
      setSaving(true);
      const payload = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, typeof v==='string' ? v.trim() : v]));
      payload.Owner_Id = userId || '';
      // Sửa/thêm đúng sheet: tab con -> sheet con (độc lập), Tất cả -> sheet chính.
      const fromCon = modalMode === 'edit' ? !!editItem._fromCon : viewingCon;
      const pf      = fromCon ? postConFn : postFn;
      const dataset = fromCon ? conItems  : items;
      const reload  = fromCon ? loadConData : loadData;
      // Ngày Update: bảng chính giữ nguyên ngày của bảng hàng công ty; bảng con
      // do server tự đóng dấu hôm nay (buildRow keepDate=false khi isCon).
      if (modalMode === 'edit') {
        await pf({ action: 'update', _rowIndex: editItem._rowIndex, Owner_Id: editItem.Owner_Id || userId || '', ...payload, Ngay_Update: editItem.Ngay_Update || '', Bang_Con: editItem?.Bang_Con || '', ...expectOf(editItem, fromCon) });
        pushImportLog(payload.Ma_Can);
        showToast('Cập nhật thành công!');
        closeModal();
        await reload();
      } else {
        const existing = dataset.find(i => (i.Ma_Can||'').toUpperCase() === payload.Ma_Can.toUpperCase());
        if (existing) {
          setSaving(false);
          setDupTarget({ existing: { ...existing, _fromCon: fromCon }, payload });
          return;
        }
        await pf({ action: 'add', ...payload, Ngay_Update: todayVN(), Bang_Con: fromCon && activeTag ? activeTag : '' });
        pushImportLog(payload.Ma_Can);
        showToast('Thêm căn thành công!');
        closeModal();
        await reload();
      }
    } catch(e) { onWriteError(e); }
    finally { setSaving(false); }
  }

  async function confirmDup() {
    if (!dupTarget) return;
    try {
      setSaving(true);
      const { existing, payload } = dupTarget;
      const fromCon = !!existing._fromCon;
      const pf      = fromCon ? postConFn : postFn;
      const reload  = fromCon ? loadConData : loadData;
      const mergedHinh = payload.Hinh_Anh || existing.Hinh_Anh || '';
      await pf({ action: 'update', _rowIndex: existing._rowIndex, Owner_Id: existing.Owner_Id || userId || '', ...payload, Hinh_Anh: mergedHinh, Gia_Net: payload.Gia_Net || existing.Gia_Net || '', Ngay_Update: existing.Ngay_Update || '', Bang_Con: existing.Bang_Con || '', ...expectOf(existing, fromCon) });
      pushImportLog(payload.Ma_Can);
      showToast('Đã cập nhật căn ' + payload.Ma_Can + '!');
      setDupTarget(null);
      closeModal();
      await reload();
    } catch(e) { onWriteError(e); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      const fromCon = !!deleteTarget._fromCon;
      await (fromCon ? postConFn : postFn)({ action: 'delete', _rowIndex: deleteTarget._rowIndex, ...expectOf(deleteTarget, fromCon) });
      showToast('Đã xoá!');
      setDeleteTarget(null);
      await (fromCon ? loadConData() : loadData());
    } catch(e) { onWriteError(e); }
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

  // Modal ghi thẳng cả 3 bảng (Thuê / Bán / Đập Thông) từ 1 file; ở đây chỉ nạp lại
  // bảng đang mở. Hai bảng kia tự fetch khi user chuyển tab (TimesCity chỉ mount 1 trang).
  const handleImportDone = useCallback(async (res) => {
    const mine = res?.[moduleKey];
    await loadData();
    // Modal ghi nhật ký thẳng vào localStorage (2 trang kia không mount) -> đọc lại cho trang này.
    try { setImportLog(JSON.parse(localStorage.getItem(importLogKey) || '[]')); } catch { /* bỏ qua */ }
    if (!mine) return;
    if (mine.error) showToast(`Import lỗi: ${mine.error}`, 'error');
    else showToast(`Đã thêm ${mine.added}, cập nhật ${mine.updated}${mine.deleted ? `, xoá ${mine.deleted}` : ''} căn!`);
  }, [moduleKey, importLogKey, loadData]);

  function isVideo(url) {
    return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url) || url.includes('/video/upload/');
  }
  function sortMedia(urls) {
    return [...urls.filter(isVideo), ...urls.filter(u => !isVideo(u))];
  }

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
    const el = document.getElementById(`cb-row-${maCan}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('cb-row-highlight');
    setTimeout(() => el.classList.remove('cb-row-highlight'), 2000);
  }

  return (
    <div style={{ fontFamily: F, color: '#e2e8f0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {canEdit && <button onClick={openAdd} style={st.addBtn} className="cb-btn">+ Thêm Căn</button>}
          {canEditMain && <button onClick={() => setShowImport(true)} style={st.importBtn} className="cb-btn" title="Import bảng hàng công ty">⬇ Import</button>}
          <button onClick={loadData} disabled={loading} style={st.reloadBtn} className="cb-btn" title="Tải lại">
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
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#8a9bb8', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }} title="Ẩn các căn đã bán">
            <input type="checkbox" checked={hideSold} onChange={e => setHideSold(e.target.checked)}
              style={{ width:14, height:14, accentColor:'#38b274', cursor:'pointer' }} />
            <span>Ẩn đã bán</span>
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#8a9bb8', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }} title="Ẩn các căn dừng bán">
            <input type="checkbox" checked={hidePausedRow} onChange={e => setHidePausedRow(e.target.checked)}
              style={{ width:14, height:14, accentColor:'#38b274', cursor:'pointer' }} />
            <span>Ẩn dừng bán</span>
          </label>
          <span style={{ fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{filtered.length} / {viewingCon ? conItems.length : items.length} căn</span>
        </div>
      </div>

      {/* Bảng hàng con (tag) — kho riêng của từng user */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        <span style={{ fontSize:12, color:'#8a9bb8', fontWeight:700, whiteSpace:'nowrap' }}>Bảng con:</span>
        <button onClick={() => setActiveTag(null)} style={activeTag === null ? st.tagChipActive : st.tagChip}>Tất cả</button>
        {allTags.map(t => (
          <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)} style={activeTag === t ? st.tagChipActive : st.tagChip}>
            {t}{tagCounts[t] ? ` (${tagCounts[t]})` : ''}
          </button>
        ))}
        <button onClick={addCustomTag} style={{ ...st.tagChip, borderStyle:'dashed', color:'#38b274' }}>+ Thẻ</button>
      </div>

      {/* AI Search */}
      <div style={{ marginBottom: aiFilter ? 8 : 16 }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14 }}>✨</span>
          <input
            type="text"
            placeholder="VD: 2 ngủ có slot tài chính 4 tỷ · 3PN tòa P03 full đồ hướng nam..."
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

      {!loading && !error && (
        <div className="cb-table-wrap" style={st.tableWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                {headers.map((h,i) => <th key={h||`h${i}`} style={{...st.th, width:colWidths[i], minWidth:colWidths[i], maxWidth:colWidths[i]}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={headers.length} style={st.emptyTd}>
                  {viewingCon
                    ? 'Bảng con này chưa có căn nào. Vào tab "Tất cả" rồi bấm 🏷 để chuyển căn vào đây.'
                    : (items.length === 0 ? 'Chưa có căn nào. Bấm "+ Thêm Căn" để bắt đầu.' : 'Không tìm thấy')}
                </td></tr>
              ) : grouped.map(([toa, toaItems]) => (
                <>
                  <tr key={`header-${toa}`}>
                    <td colSpan={headers.length} style={st.toaHeader}>
                      <span style={st.toaLabel}>{toa}</span>
                    </td>
                  </tr>
                  {toaItems.map(item => {
                    // Tab Tất cả phản chiếu bảng công ty: chỉ giữ màu trạng thái + màu đánh dấu Hàng Đầu Tư.
                    const rawMau = item.Mau_Ma_Can || '';
                    const mau = viewingCon ? rawMau : ((STATUS_COLORS.has(rawMau) || rawMau === INVEST_COLOR) ? rawMau : '');
                    const isStatus = STATUS_COLORS.has(mau);
                    // Dừng bán (vàng): chỉ tô ô Mã Căn (giống bảng công ty).
                    const cellOnlyBg = mau === STATUS_PAUSED ? '#EAB308' : undefined;
                    // Nền cả hàng CHỈ cho xám (Đã bán).
                    const rowBg = cellOnlyBg ? undefined : statusRowBg(mau);
                    // Nền ô Mã Căn: cell-only -> đậm; xám -> theo nền hàng; user tô -> hex.
                    const maCanBg = cellOnlyBg || (isStatus ? rowBg : (mau || 'transparent'));
                    const maCanWhiteText = !isStatus && mau; // chữ trắng khi có màu user
                    const isPaused = !!cellOnlyBg;
                    return (
                    <tr key={item._rowIndex} id={`cb-row-${item.Ma_Can}`} className="cb-row" style={st.tr}>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap', fontSize:12, background: isRecentUpdate(item.Ngay_Update) ? 'rgba(250, 204, 21, 0.22)' : rowBg}}>{item.Ngay_Update}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:700, whiteSpace:'nowrap', background: maCanBg, color: (maCanWhiteText || isPaused) ? '#fff' : undefined, borderRadius: (isPaused || maCanWhiteText) ? 6 : 0}}>{item.Ma_Can}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>{item.Thiet_Ke}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>{(item.Dien_Tich||'').replace(/\s*m²|m2|m$/i,'').trim()}</td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>
                        {(() => {
                          // Có slot (Có / 1 / 2 ...) -> xanh lá; Không/rỗng -> hồng.
                          const hasSlot = item.Slot_Xe && item.Slot_Xe !== 'Không';
                          return (
                            <span style={{
                              background: hasSlot ? '#C6F6D5' : '#FED7D7',
                              color: hasSlot ? '#276749' : '#9B2C2C',
                              padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700,
                            }}>{item.Slot_Xe || 'Không'}</span>
                          );
                        })()}
                      </td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'normal', background: rowBg}}>{huongText(item.Huong_BC)}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:600, whiteSpace:'nowrap', background: rowBg}}>{(perM2Price(item) != null || isDateSerialGia(item.Gia)) ? '' : item.Gia}</td>
                      {viewingCon && <td style={{...st.td, textAlign:'center', fontWeight:700, whiteSpace:'nowrap', color:'#34D399', background: rowBg}}>{item.Gia_Net}</td>}
                      <td style={{...st.td, textAlign:'center', fontSize:12, color:'#38b274', fontWeight:700, background: rowBg}}>
                        {trPerM2(item) ?? ''}
                      </td>
                      <td style={{...st.td, textAlign:'center', fontSize:12, background: rowBg}}>
                        <span style={{
                          background: item.Phi === 'Bao phí' ? 'rgba(56,178,116,0.15)' : 'rgba(49,130,206,0.15)',
                          color: item.Phi === 'Bao phí' ? '#38b274' : '#63b3ed',
                          padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
                        }}>{item.Phi || 'Thu về'}</span>
                      </td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap', background: rowBg}}>
                        {(item.SDT||'').split(/[\n,/;]+|\s{2,}|\s-\s/).map(s=>s.trim()).filter(Boolean).map((sd,idx)=>(
                          <div key={idx}>{sd}</div>
                        ))}
                      </td>
                      <td style={{...st.td, textAlign:'center', background: rowBg}}>{item.Ten_Chu}</td>
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
                        <button onClick={() => setTagMenuFor({ ...item, _fromCon: viewingCon })} style={{...st.actionBtn, color: (viewingCon ? parseBangCon(item.Bang_Con).length : conItems.some(c => conKey(c.Ma_Can) === conKey(item.Ma_Can))) ? '#38b274' : undefined}} title={viewingCon ? 'Sửa bảng con' : 'Chuyển vào bảng con'}>&#127991;</button>
                        {canEdit && <button onClick={() => openEdit(item)} style={st.actionBtn} title="Sửa">&#9998;</button>}
                        {canEdit && <button onClick={() => setDeleteTarget({ ...item, _fromCon: viewingCon })} style={{...st.actionBtn, color:C.error}} title="Xoá">&#128465;</button>}
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
          <div className="cb-modal-content" style={st.modal}>
            <div style={st.modalHeader}>
              <div style={st.modalTitle}>
                {modalMode === 'add' ? '➕ Thêm Căn Bán' : `✏️ Sửa căn ${editItem?.Ma_Can}`}
              </div>
              <button onClick={closeModal} style={st.modalClose}>&times;</button>
            </div>

            <div style={st.modalBody}>
              {/* AI Parse box */}
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
                    placeholder={`Ví dụ:\nCăn hộ: P0112A11\n- Thiết kế: 3PN\n- Diện tích: 106m²\n- Hướng ban công: Nam\n- Giá: 5.5 tỷ bao phí\n- Hiện trạng: full đồ\n- Liên hệ: Anh Nam 0363560203`}
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

              {/* Form fields */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Mã Căn *" value={form.Ma_Can} onChange={v => set('Ma_Can', v.toUpperCase())} placeholder="VD: P0112A11, R6-1208" />
                </div>

                {/* Màu — chỉ đính được ở bảng con (tab Tất cả phản chiếu công ty) */}
                {viewingCon && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <ColorPicker value={form.Mau_Ma_Can} onChange={v => set('Mau_Ma_Can', v)} />
                  </div>
                )}

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

                {/* Phí */}
                <div>
                  <label style={st.fieldLabel}>Phí</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['Thu về','Bao phí'].map(opt => (
                      <button
                        key={opt} type="button"
                        onClick={() => set('Phi', opt)}
                        style={{
                          flex:1, padding:'9px 0', borderRadius:8, fontSize:13, fontWeight:700,
                          border:`1.5px solid ${form.Phi===opt ? (opt==='Bao phí' ? '#38A169':'#3182CE') : C.border}`,
                          background: form.Phi===opt ? (opt==='Bao phí' ? '#C6F6D5':'#EBF8FF') : '#fff',
                          color: form.Phi===opt ? (opt==='Bao phí' ? '#276749':'#2B6CB0') : C.textMuted,
                          cursor:'pointer', fontFamily:F,
                        }}
                      >{opt}</button>
                    ))}
                  </div>
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Giá" value={form.Gia} onChange={v => set('Gia', v)} placeholder="VD: 5.5 tỷ" />
                  {viewingCon && (
                    <FormField label="Giá Nét" value={form.Gia_Net} onChange={v => set('Gia_Net', v)} placeholder="VD: 5.3 tỷ (giá đã làm với chủ)" />
                  )}
                </div>

                {/* Nội Thất */}
                <div style={{ gridColumn:'1/-1' }}>
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

                <FormField label="SDT Chủ" value={form.SDT} onChange={v => set('SDT', v)} placeholder="VD: 0363560203" />
                <FormField label="Tên Chủ" value={form.Ten_Chu} onChange={v => set('Ten_Chu', v)} placeholder="VD: Anh Nam, Chị Hoa" />

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Nguồn" value={form.Nguon} onChange={v => set('Nguon', v)} placeholder="VD: Anh Phong, Chị Lan, Zalo nhóm..." />
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <label style={st.fieldLabel}>Ghi Chú</label>
                  <textarea
                    value={form.Ghi_Chu}
                    onChange={e => set('Ghi_Chu', e.target.value)}
                    placeholder="Ghi chú thêm, lưu ý..."
                    style={{ ...st.fieldInput, height:60, resize:'vertical' }}
                  />
                </div>
              </div>

              {/* Media upload */}
              <div style={{ marginTop:16 }}>
                <label style={st.fieldLabel}>Hình Ảnh / Video Căn</label>

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

            <div style={st.modalFooter}>
              <button onClick={closeModal} style={st.cancelBtn} className="cb-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving||uploading} style={st.saveBtn} className="cb-btn">
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
              <button onClick={() => setDeleteTarget(null)} style={st.cancelBtn} className="cb-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...st.saveBtn, background:C.error }} className="cb-btn">
                {saving ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => setDupTarget(null)} style={st.cancelBtn} className="cb-btn">Huỷ</button>
              <button onClick={confirmDup} disabled={saving} style={st.saveBtn} className="cb-btn">
                {saving ? 'Đang cập nhật...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...st.toast, background: toast.type==='error' ? C.error : C.primary, animation:'cbToastIn 0.3s ease' }}>
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

      {tagMenuFor && (() => {
        // Mở từ 1 dòng bảng con -> lấy đúng dòng đó (tra theo Mã Căn sẽ sửa nhầm dòng
        // nếu bảng con đang có 2 dòng trùng mã). Mở từ bảng chính -> tra theo Mã Căn.
        const key = conKey(tagMenuFor.Ma_Can);
        const conRow = tagMenuFor._fromCon
          ? conItems.find(c => c._rowIndex === tagMenuFor._rowIndex) || tagMenuFor
          : conItems.find(c => conKey(c.Ma_Can) === key);
        const set = new Set(parseBangCon(conRow?.Bang_Con));
        return (
          <div style={st.overlay} onClick={() => setTagMenuFor(null)}>
            <div style={st.tagPopover} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>Bảng hàng con</div>
              <div style={{ fontSize:12, color:'#8a9bb8', marginBottom:2 }}>Căn {tagMenuFor.Ma_Can || '—'}</div>
              <div style={{ fontSize:11, color:'#6b7b96', marginBottom:12 }}>Mỗi căn chỉ thuộc 1 thẻ — chọn thẻ mới là chuyển khỏi thẻ cũ.</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:'50vh', overflowY:'auto' }}>
                {allTags.map(t => (
                  <label key={t} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:8, cursor:'pointer', fontSize:14 }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <input type="checkbox" checked={set.has(t)}
                      onChange={() => setConTag(conRow || tagMenuFor, t)}
                      style={{ width:16, height:16, accentColor:'#38b274', cursor:'pointer' }} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
              {tagPending > 0 && (
                <div style={{ fontSize:12, color:'#8a9bb8', marginTop:8 }}>⏳ Đang lưu…</div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button onClick={addCustomTag} style={{ ...st.tagChip, borderStyle:'dashed', color:'#38b274', flex:1, padding:'9px 12px' }}>+ Thẻ mới</button>
                <button onClick={() => setTagMenuFor(null)} style={{ ...st.tagChipActive, flex:1, padding:'9px 12px' }}>Xong</button>
              </div>
            </div>
          </div>
        );
      })()}

      <ImportSheetModal
        open={showImport && canEditMain}
        onClose={() => setShowImport(false)}
        userId={userId}
        role={role}
        onDone={handleImportDone}
      />
    </div>
  );
}

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

function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|mkv|m4v)(\?|$)/i.test(url) || url.includes('/video/upload/');
}

function extractBuilding(maCan) {
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
  const [tab, setTab]        = useState(defaultTab);
  const [idx, setIdx]        = useState(startIndex);
  const [downloading, setDl] = useState(false);

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
        <div style={lb.topBar}>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setTab('anh')} style={{ ...lb.tabBtn, ...(tab==='anh' ? lb.tabBtnActive : {}) }}>
              📷 Ảnh
            </button>
            <button onClick={() => setTab('matbang')} style={{ ...lb.tabBtn, ...(tab==='matbang' ? lb.tabBtnActive : {}) }}>
              🗺 Mặt Bằng
            </button>
          </div>
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
          <div style={lb.imgWrap}>
            {idx > 0 && <button onClick={() => setIdx(i => i - 1)} style={lb.arrowLeft}>‹</button>}
            {isVideoUrl(urls[idx]) ? (
              <video key={urls[idx]} src={urls[idx]} controls autoPlay style={lb.img} />
            ) : (
              <img src={urls[idx]} alt="" style={lb.img} />
            )}
            {idx < urls.length - 1 && <button onClick={() => setIdx(i => i + 1)} style={lb.arrowRight}>›</button>}
          </div>
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
};

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
  tagChip:       { background:'#22263a', color:'#cbd5e1', border:'1.5px solid #3a3f52', borderRadius:16, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' },
  tagChipActive: { background:'linear-gradient(135deg,#38b274,#2a8a5a)', color:'#fff', border:'1.5px solid #38b274', borderRadius:16, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' },
  tagPopover:    { background:'#1a1e2e', color:'#e2e8f0', border:'1px solid #2d3240', borderRadius:16, width:340, maxWidth:'100%', padding:'18px 18px', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', fontFamily:F, animation:'cbSlideUp 0.2s ease' },
  modal:       { background:'#fff', borderRadius:16, width:620, maxWidth:'100%', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:C.shadowLg, animation:'cbSlideUp 0.25s ease', overflow:'hidden' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${C.border}`, background:`linear-gradient(135deg, ${C.primary}, #2a5a8c)` },
  modalTitle:  { fontSize:16, fontWeight:700, color:'#fff' },
  modalClose:  { background:'none', border:'none', fontSize:22, color:'rgba(255,255,255,0.7)', cursor:'pointer', lineHeight:1 },
  modalBody:   { padding:'20px', overflowY:'auto', flex:1 },
  modalFooter: { display:'flex', gap:10, justifyContent:'flex-end', padding:'12px 20px', borderTop:`1px solid ${C.border}` },
  fieldLabel:  { display:'block', fontSize:11, fontWeight:700, color:C.textMuted, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' },
  fieldInput:  { width:'100%', padding:'9px 12px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:F, outline:'none', boxSizing:'border-box', background:C.bgInput },
  cancelBtn:   { background:'none', border:`1.5px solid ${C.border}`, borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:F, color:C.textMuted },
  saveBtn:     { background:C.gradient, color:'#fff', border:'none', borderRadius:10, padding:'9px 28px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:C.shadowGreen },
  confirmBox:  { background:'#fff', borderRadius:16, padding:24, width:380, maxWidth:'100%', boxShadow:C.shadowLg, animation:'cbSlideUp 0.2s ease' },
  toast:       { position:'fixed', bottom:24, right:24, padding:'12px 20px', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, fontFamily:F, boxShadow:C.shadowMd, zIndex:2000 },
};
