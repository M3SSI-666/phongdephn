import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { C } from '../utils/theme';
import { fetchKhachTimes, postKhachTimes, parseSearchQuery } from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Bảng màu để highlight khách hàng (tô nền ô Tên Zalo) theo mục đích cá nhân.
const RAINBOW_COLORS = [
  { label: 'Mặc định',   value: '' },
  { label: 'Đỏ',         value: '#E53E3E' },
  { label: 'Cam',        value: '#DD6B20' },
  { label: 'Vàng',       value: '#D69E2E' },
  { label: 'Xanh lá',    value: '#38A169' },
  { label: 'Xanh dương', value: '#3182CE' },
  { label: 'Chàm',       value: '#5B21B6' },
  { label: 'Tím',        value: '#9F7AEA' },
];

const TRANG_THAI_OPTIONS = [
  { value: '', label: '--', bg: 'transparent', text: '#999' },
  { value: 'Miss', label: 'Miss', bg: '#F8D7DA', text: '#721C24' },
  { value: 'Tư vấn, gửi căn', label: 'Tư vấn, gửi căn', bg: '#E0F0FF', text: '#1A6FA8' },
  { value: 'Dẫn khách', label: 'Dẫn khách', bg: '#FFF0DB', text: '#B45309' },
  { value: 'Đã cọc', label: 'Đã cọc', bg: '#C6F6D5', text: '#276749' },
  { value: 'Done', label: 'Done ✓', bg: '#3182CE', text: '#fff' },
];

// Trạng thái riêng cho tab Khách Homestay.
const HOMESTAY_TRANG_THAI_OPTIONS = [
  { value: '', label: '--', bg: 'transparent', text: '#999' },
  { value: 'Miss', label: 'Miss', bg: '#F8D7DA', text: '#721C24' },
  { value: 'Gửi căn', label: 'Gửi căn', bg: '#E0F0FF', text: '#1A6FA8' },
  { value: 'Chờ dẫn', label: 'Chờ dẫn', bg: '#FFF0DB', text: '#B45309' },
  { value: 'Cọc', label: 'Cọc', bg: '#C6F6D5', text: '#276749' },
  { value: 'Check in', label: 'Check in', bg: '#D6BCFA', text: '#553C9A' },
  { value: 'Done', label: 'Done ✓', bg: '#3182CE', text: '#fff' },
];

const NHU_CAU_OPTIONS = ['Thuê', 'Mua', 'Homestay'];
const SLOT_XE_OPTIONS = ['Có', 'Không', 'Null'];
const NOI_THAT_OPTIONS = ['Full đồ', 'Không đồ'];

// Tab con trong tab Khách hàng. `filter` là giá trị dùng cho filterLoai,
// `nhuCau` là giá trị Nhu_Cau tự điền vào form khi thêm khách ở tab đó.
const SUB_TABS = [
  { key: 'ban',      label: 'Khách bán',      filter: 'Mua',      nhuCau: 'Mua' },
  { key: 'thue',     label: 'Khách thuê',     filter: 'Thuê',     nhuCau: 'Thuê' },
  { key: 'homestay', label: 'Khách Homestay', filter: 'Homestay', nhuCau: 'Homestay' },
];

function getTodayStr() {
  const d = new Date();
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const EMPTY_FORM = {
  Ngay_PS: '', Ten_Zalo: '', SDT: '',
  Nhu_Cau: 'Thuê', Phong_Ngu: '', Noi_That: '', Slot_Xe: '',
  Thoi_Han_Thue: '', Ngay_Vao: '', Check_Out: '', Dien_Tich: '', Tang: '', Ban_Cong: '', Cua: '', Tai_Chinh: '',
  Toa: '', Can_Tu_Van: '', Trang_Thai: '', Coc: '', Coc_Host: '', Chu_Can: '', Thu_Ve: '', Ghi_Chu: '', Mau_KH: '',
};

// ── Khớp tiêu chí AI với dữ liệu khách (so khớp RỘNG để không bỏ sót khách) ──
// Gộp toàn bộ cột free-text của 1 khách thành 1 chuỗi để dò chữ.
function khachText(it) {
  return [
    it.Phong_Ngu, it.Noi_That, it.Toa, it.Can_Tu_Van,
    it.Tai_Chinh, it.Ghi_Chu, it.Thoi_Han_Thue, it.Dien_Tich, it.Tang,
  ].map((v) => String(v ?? '').toLowerCase()).join(' | ');
}

// Lấy số phòng ngủ từ "3PN"/"3 ngủ"/"3n" → "3"
function bedNum(thietKe) {
  const m = String(thietKe ?? '').match(/(\d)/);
  return m ? m[1] : null;
}

// Dò 1 con số (triệu) bất kỳ trong chuỗi tài chính của khách. "20 tỷ"→20000, "19tr"→19, "1.2 tỷ"→1200
function parseTaiChinhToTrieu(str) {
  const s = String(str ?? '').toLowerCase();
  const out = [];
  // bắt cụm số + đơn vị
  const re = /(\d+(?:[.,]\d+)?)\s*(tỷ|ty|tỉ|tr|triệu|trieu)?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    let num = parseFloat(m[1].replace(',', '.'));
    if (Number.isNaN(num)) continue;
    const unit = m[2] || '';
    if (/tỷ|ty|tỉ/.test(unit)) num *= 1000;     // tỷ → triệu
    else if (!unit && num >= 100) num = num;     // số trần lớn coi như triệu
    out.push(num);
  }
  return out;
}

// Trả về true nếu khách `it` khớp với tiêu chí AI `f`.
// Mỗi tiêu chí khớp lỏng: nếu cột khách trống thì KHÔNG loại (ưu tiên không bỏ sót).
function matchAiKhach(it, f) {
  const text = khachText(it);

  // Số phòng ngủ
  const bn = bedNum(f.Thiet_Ke);
  if (bn) {
    const pn = String(it.Phong_Ngu ?? '').toLowerCase();
    if (pn) {
      const ok = pn.includes(bn) || pn.includes(`${bn}n`) || pn.includes(`${bn} ng`)
        || pn.includes('đập thông') || pn.includes('shophouse');
      if (!ok) return false;
    }
  }

  // Hướng ban công
  if (f.Huong_BC) {
    const h = String(f.Huong_BC).toLowerCase();
    if (!text.includes(h)) {
      // thử rút gọn: "đông nam" cũng khớp nếu chứa cả "đông" và "nam"
      const parts = h.split(/\s+/);
      const all = parts.every((p) => text.includes(p));
      if (!all) return false;
    }
  }

  // Nội thất
  if (f.Noi_That) {
    const nt = String(f.Noi_That).toLowerCase();
    const ntCell = String(it.Noi_That ?? '').toLowerCase();
    const hay = ntCell || text;
    let ok = hay.includes(nt);
    if (!ok) {
      if (nt.includes('không')) ok = /không\s*đồ|trống|empty/.test(hay);
      else if (nt.includes('full')) ok = /full|đầy đủ|đủ đồ/.test(hay);
      else if (nt.includes('cơ bản')) ok = /cơ bản|basic/.test(hay);
    }
    // Nếu khách không ghi nội thất thì không loại
    if (ntCell && !ok) return false;
  }

  // Toà
  if (f.Toa) {
    const toa = String(f.Toa).toLowerCase().replace(/^0+/, '');
    const toaCell = (String(it.Toa ?? '') + ' ' + String(it.Can_Tu_Van ?? '')).toLowerCase();
    if (toaCell.trim() && !toaCell.includes(toa) && !toaCell.includes(String(f.Toa).toLowerCase())) {
      return false;
    }
  }

  // Ngân sách: nếu khách có ghi tài chính, kiểm tra nằm trong khoảng.
  if (f.Gia_Min != null || f.Gia_Max != null) {
    const nums = parseTaiChinhToTrieu(it.Tai_Chinh);
    if (nums.length > 0) {
      const hit = nums.some((n) => {
        if (f.Gia_Min != null && n < f.Gia_Min * 0.8) return false;  // nới 20%
        if (f.Gia_Max != null && n > f.Gia_Max * 1.2) return false;
        return true;
      });
      if (!hit) return false;
    }
  }

  return true;
}

export function KhachTimesContent({ overrideUserId, overrideRole, isViewAs } = {}) {
  return <KhachTimesInner showHeader={false} overrideUserId={overrideUserId} overrideRole={overrideRole} isViewAs={isViewAs} />;
}

export default function KhachTimes() {
  return <KhachTimesInner showHeader={true} />;
}

function KhachTimesInner({ showHeader, overrideUserId, overrideRole, isViewAs = false }) {
  const navigate = useNavigate();
  const { user } = useUser();
  const userId = overrideUserId || user?.id;
  const role   = overrideRole   || user?.publicMetadata?.role || 'staff';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [aiFilter, setAiFilter] = useState(null);   // tiêu chí AI đã nhận dạng (null = chưa dùng AI)
  const [aiSearching, setAiSearching] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('ban'); // mặc định mở tab Khách bán
  const [filterTrangThai, setFilterTrangThai] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'mindmap' — chỉ dùng cho tab thuê
  const [mmCollapsed, setMmCollapsed] = useState(() => new Set()); // node-key đang bị thu (cấp 1, cấp 2)

  const currentSubTab = SUB_TABS.find(t => t.key === activeSubTab) || SUB_TABS[0];
  const filterLoai = currentSubTab.filter;

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ktFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ktSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ktToastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      .kt-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .kt-table-wrap::-webkit-scrollbar { height: 6px; }
      .kt-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      .kt-row:hover { background: rgba(255,255,255,0.06) !important; }
      .kt-btn:active { transform: scale(0.97); }
      .kt-subtab:active { transform: scale(0.97); }
      .kt-subtab:hover { opacity: 0.88; }
      .kt-inline-select { border: none; background: transparent; font-family: ${F}; font-size: 12px; font-weight: 600; cursor: pointer; outline: none; padding: 3px 2px; border-radius: 6px; width: 100%; }
      .kt-inline-select:hover { background: rgba(255,255,255,0.08); }
      .kt-inline-select:focus { box-shadow: 0 0 0 2px ${C.primary}40; }
      @media (max-width: 640px) {
        .kt-modal-content { width: 100% !important; height: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
        .kt-stats { flex-direction: column !important; gap: 8px !important; }
        .kt-header-row { flex-direction: column !important; gap: 10px !important; align-items: stretch !important; }
        .kt-filter-row { flex-direction: column !important; gap: 8px !important; }
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
      setLoading(true);
      setError('');
      const data = await fetchKhachTimes(userId, role, isViewAs);
      const arr = Array.isArray(data) ? data : [];
      setItems(arr);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, role, isViewAs]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchKhachTimes(userId, role).then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Inline update — thay đổi 1 field ngay trong bảng, auto save
  const inlineUpdate = useCallback(async (item, field, value) => {
    try {
      const payload = {
        action: 'update',
        _rowIndex: item._rowIndex,
        STT: item.STT,
        Ngay_PS: item.Ngay_PS || '',
        Ten_Zalo: item.Ten_Zalo || '',
        SDT: item.SDT || '',
        Nhu_Cau: item.Nhu_Cau || '',
        Phong_Ngu: item.Phong_Ngu || '',
        Noi_That: item.Noi_That || '',
        Slot_Xe: item.Slot_Xe || '',
        Thoi_Han_Thue: item.Thoi_Han_Thue || '',
        Ngay_Vao: item.Ngay_Vao || '',
        Dien_Tich: item.Dien_Tich || '',
        Tai_Chinh: item.Tai_Chinh || '',
        Toa: item.Toa || '',
        Can_Tu_Van: item.Can_Tu_Van || '',
        Trang_Thai: item.Trang_Thai || '',
        Coc: item.Coc || '',
        Coc_Host: item.Coc_Host || '',
        Chu_Can: item.Chu_Can || '',
        Thu_Ve: item.Thu_Ve || '',
        Ghi_Chu: item.Ghi_Chu || '',
        Owner_Id: item.Owner_Id || userId || '',
        Thu_Tu: item.Thu_Tu || '',
        Check_Out: item.Check_Out || '',
        Tang: item.Tang || '',
        Ban_Cong: item.Ban_Cong || '',
        Cua: item.Cua || '',
        Mau_KH: item.Mau_KH || '',
        [field]: value,
      };
      // Update local state immediately
      setItems(prev => prev.map(it =>
        it._rowIndex === item._rowIndex ? { ...it, [field]: value } : it
      ));
      await postKhachTimes(payload);
      showToast('Đã cập nhật!');
    } catch (e) {
      showToast('Lỗi cập nhật: ' + e.message, 'error');
      loadData();
    }
  }, [showToast, loadData]);

  // ── Kéo-thả sắp xếp ──
  const [dragRowIndex, setDragRowIndex] = useState(null); // _rowIndex của hàng đang kéo
  const [dragOverIndex, setDragOverIndex] = useState(null); // _rowIndex của hàng đang được rê tới
  // Chỉ cho kéo-thả khi xem danh sách đầy đủ của 1 tab (không tìm kiếm, không lọc trạng thái).
  const canDrag = !search.trim() && !aiFilter && filterTrangThai.length === 0;

  // Tab Khách bán: ẩn cột/trường "Thời hạn" và "Ngày vào" vì không cần thiết.
  const isBanTab = activeSubTab === 'ban';
  // Tab Khách Homestay: ẩn cột/trường "Nội thất" và "Slot".
  const isHomestayTab = activeSubTab === 'homestay';
  // Tab Khách thuê: cho phép chế độ xem Mind Map.
  const isThueTab = activeSubTab === 'thue';
  // Bộ trạng thái áp dụng theo tab hiện tại.
  const trangThaiOptions = isHomestayTab ? HOMESTAY_TRANG_THAI_OPTIONS : TRANG_THAI_OPTIONS;

  const filtered = useMemo(() => {
    let list = [...items];
    list = list.filter((it) => {
      const nc = (it.Nhu_Cau || '').toLowerCase();
      const fv = filterLoai.toLowerCase();
      if (fv === 'homestay') return nc === 'homestay';
      if (fv === 'thuê' || fv === 'thue') return nc.includes('thu') && nc !== 'homestay';
      if (fv === 'mua') return nc === 'mua';
      return true;
    });
    if (filterTrangThai.length > 0) {
      list = list.filter((it) => filterTrangThai.includes(it.Trang_Thai || ''));
    }
    if (aiFilter) {
      // Tìm kiếm thông minh: khớp tiêu chí AI đã nhận dạng.
      list = list.filter((it) => matchAiKhach(it, aiFilter));
    } else if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((it) =>
        (it.Ten_Zalo || '').toLowerCase().includes(q) ||
        (it.SDT || '').includes(q) ||
        (it.Toa || '').toLowerCase().includes(q) ||
        (it.Noi_That || '').toLowerCase().includes(q) ||
        (it.Thoi_Han_Thue || '').toLowerCase().includes(q) ||
        (it.Can_Tu_Van || '').toLowerCase().includes(q) ||
        (it.Ghi_Chu || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      // Ưu tiên thứ tự thủ công (Thu_Tu) — số nhỏ lên đầu.
      const ta = a.Thu_Tu !== '' && a.Thu_Tu != null ? Number(a.Thu_Tu) : null;
      const tb = b.Thu_Tu !== '' && b.Thu_Tu != null ? Number(b.Thu_Tu) : null;
      const va = ta != null && !Number.isNaN(ta);
      const vb = tb != null && !Number.isNaN(tb);
      if (va && vb) return ta - tb;
      if (va) return -1;   // có thứ tự → lên trước
      if (vb) return 1;
      // Cả hai chưa có thứ tự → giữ logic cũ: ngày mới nhất lên đầu.
      const parseDate = s => { const p = (s||'').split('/'); return p.length===3 ? new Date(p[2],p[1]-1,p[0]) : new Date(0); };
      const da = parseDate(a.Ngay_PS), db = parseDate(b.Ngay_PS);
      if (db - da !== 0) return db - da;
      return Number(b.STT || 0) - Number(a.STT || 0);
    });
    return list;
  }, [items, filterLoai, filterTrangThai, search, aiFilter]);

  // ── Dữ liệu cây cho chế độ Mind Map (tab Khách thuê) ──
  // Cấp 1: Kiểu khách (KẾT HỢP / KHÁCH CHỦ ĐỘNG) → Cấp 2: số phòng ngủ
  // → Cấp 3: nội thất (Full đồ / Không đồ / (chưa rõ)) → Cấp 4: khách.
  const mindMapTree = useMemo(() => {
    const norm = (v) => String(v ?? '').trim().toUpperCase();
    const isKetHop = (it) => { const s = norm(it.SDT); return s === 'KẾT HỢP' || s === 'KET HOP'; };
    // Chuẩn hoá nội thất về 1 trong 3 nhãn cố định.
    const ntKeyOf = (it) => {
      const v = String(it.Noi_That ?? '').trim().toLowerCase();
      if (!v) return '(chưa rõ)';
      if (v.includes('full')) return 'Full đồ';
      if (v.includes('không') || v.includes('khong')) return 'Không đồ';
      return '(chưa rõ)';
    };
    // Gom theo kiểu khách → PN → nội thất.
    const groups = { 'KẾT HỢP': {}, 'KHÁCH CHỦ ĐỘNG': {} };
    for (const it of filtered) {
      const kieu = isKetHop(it) ? 'KẾT HỢP' : 'KHÁCH CHỦ ĐỘNG';
      const pnRaw = String(it.Phong_Ngu ?? '').trim();
      const pnKey = pnRaw || '(chưa rõ)';
      const ntKey = ntKeyOf(it);
      if (!groups[kieu][pnKey]) groups[kieu][pnKey] = {};
      if (!groups[kieu][pnKey][ntKey]) groups[kieu][pnKey][ntKey] = [];
      groups[kieu][pnKey][ntKey].push(it);
    }
    // Chuyển thành mảng có thứ tự, PN sắp tăng dần (số trước, '(chưa rõ)' cuối).
    const pnSort = (a, b) => {
      if (a === '(chưa rõ)') return 1;
      if (b === '(chưa rõ)') return -1;
      const na = parseFloat(a), nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    };
    // Thứ tự nội thất cố định: Full đồ → Không đồ → (chưa rõ).
    const ntOrder = ['Full đồ', 'Không đồ', '(chưa rõ)'];
    const ntSort = (a, b) => ntOrder.indexOf(a) - ntOrder.indexOf(b);
    return ['KẾT HỢP', 'KHÁCH CHỦ ĐỘNG'].map((kieu) => {
      const pnGroups = Object.keys(groups[kieu]).sort(pnSort).map((pn) => {
        const ntGroups = Object.keys(groups[kieu][pn]).sort(ntSort).map((nt) => ({
          nt,
          khach: groups[kieu][pn][nt],
          count: groups[kieu][pn][nt].length,
        }));
        const count = ntGroups.reduce((sum, g) => sum + g.count, 0);
        return { pn, ntGroups, count };
      });
      const total = pnGroups.reduce((sum, g) => sum + g.count, 0);
      return { kieu, pnGroups, total };
    });
  }, [filtered]);

  const toggleMmNode = useCallback((key) => {
    setMmCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Rời tab Khách thuê thì luôn quay về chế độ bảng.
  useEffect(() => {
    if (activeSubTab !== 'thue') setViewMode('table');
  }, [activeSubTab]);

  // Tìm kiếm thông minh: gửi câu chữ tự nhiên cho AI nhận dạng tiêu chí, rồi lọc khách.
  const handleAiSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) { showToast('Nhập nội dung cần tìm', 'error'); return; }
    setAiSearching(true);
    try {
      const f = await parseSearchQuery(q);
      // Bỏ các tiêu chí null để biết AI có nhận được gì không.
      const hasAny = ['Thiet_Ke', 'Huong_BC', 'Noi_That', 'Toa', 'Gia_Min', 'Gia_Max']
        .some((k) => f && f[k] != null);
      if (!hasAny) {
        showToast('Không nhận dạng được tiêu chí, dùng tìm thường', 'error');
        setAiFilter(null);
      } else {
        setAiFilter(f);
      }
    } catch (e) {
      showToast('Lỗi AI: ' + e.message, 'error');
    } finally {
      setAiSearching(false);
    }
  }, [search, showToast]);

  // Xoá ô tìm + tắt chế độ AI.
  const clearSearch = useCallback(() => {
    setSearch('');
    setAiFilter(null);
  }, []);

  // Lưu thứ tự mới: gán Thu_Tu = 1..n cho các hàng trong tab hiện tại, lưu lên Sheets.
  const persistOrder = useCallback(async (orderedList) => {
    const orders = orderedList.map((it, idx) => ({ _rowIndex: it._rowIndex, Thu_Tu: idx + 1 }));
    setItems(prev => prev.map(it => {
      const found = orders.find(o => o._rowIndex === it._rowIndex);
      return found ? { ...it, Thu_Tu: found.Thu_Tu } : it;
    }));
    try {
      await postKhachTimes({ action: 'reorder', orders });
      showToast('Đã lưu thứ tự!');
    } catch (e) {
      showToast('Lỗi lưu thứ tự: ' + e.message, 'error');
      loadData();
    }
  }, [showToast, loadData]);

  const handleDrop = useCallback((targetRowIndex) => {
    setDragOverIndex(null);
    if (dragRowIndex == null || dragRowIndex === targetRowIndex) {
      setDragRowIndex(null);
      return;
    }
    const order = [...filtered];
    const from = order.findIndex(it => it._rowIndex === dragRowIndex);
    const to = order.findIndex(it => it._rowIndex === targetRowIndex);
    setDragRowIndex(null);
    if (from === -1 || to === -1) return;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    persistOrder(order);
  }, [dragRowIndex, filtered, persistOrder]);

  const stats = useMemo(() => {
    const total = items.length;
    const thue = items.filter((i) => {
      const nc = (i.Nhu_Cau || '').toLowerCase();
      return nc.includes('thu') && nc !== 'homestay';
    }).length;
    const mua = items.filter((i) => (i.Nhu_Cau || '').toLowerCase() === 'mua').length;
    const homestay = items.filter((i) => (i.Nhu_Cau || '').toLowerCase() === 'homestay').length;
    return { total, thue, mua, homestay };
  }, [items]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, Ngay_PS: getTodayStr(), Nhu_Cau: currentSubTab.nhuCau });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      Ngay_PS: item.Ngay_PS || '',
      Ten_Zalo: item.Ten_Zalo || '',
      SDT: item.SDT || '',
      Nhu_Cau: item.Nhu_Cau || 'Thuê',
      Phong_Ngu: item.Phong_Ngu || '',
      Noi_That: item.Noi_That || '',
      Slot_Xe: item.Slot_Xe || '',
      Thoi_Han_Thue: item.Thoi_Han_Thue || '',
      Ngay_Vao: item.Ngay_Vao || '',
      Check_Out: item.Check_Out || '',
      Dien_Tich: item.Dien_Tich || '',
      Tang: item.Tang || '',
      Ban_Cong: item.Ban_Cong || '',
      Cua: item.Cua || '',
      Tai_Chinh: item.Tai_Chinh || '',
      Toa: item.Toa || '',
      Can_Tu_Van: item.Can_Tu_Van || '',
      Trang_Thai: item.Trang_Thai || '',
      Coc: item.Coc || '',
      Coc_Host: item.Coc_Host || '',
      Chu_Can: item.Chu_Can || '',
      Thu_Ve: item.Thu_Ve || '',
      Ghi_Chu: item.Ghi_Chu || '',
      Mau_KH: item.Mau_KH || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.Ten_Zalo.trim()) return showToast('Vui lòng nhập tên khách hàng', 'error');
    if (!form.SDT.trim()) return showToast('Vui lòng nhập số điện thoại', 'error');

    try {
      setSaving(true);
      const payload = {
        Ngay_PS: form.Ngay_PS.trim(),
        Ten_Zalo: form.Ten_Zalo.trim(),
        SDT: form.SDT.trim(),
        Nhu_Cau: form.Nhu_Cau,
        Phong_Ngu: form.Phong_Ngu,
        Noi_That: form.Noi_That.trim(),
        Slot_Xe: form.Slot_Xe,
        Thoi_Han_Thue: form.Thoi_Han_Thue.trim(),
        Ngay_Vao: form.Ngay_Vao.trim(),
        Check_Out: form.Check_Out.trim(),
        Dien_Tich: form.Dien_Tich.trim(),
        Tang: form.Tang.trim(),
        Ban_Cong: form.Ban_Cong.trim(),
        Cua: form.Cua.trim(),
        Tai_Chinh: form.Tai_Chinh.trim(),
        Toa: form.Toa.trim(),
        Can_Tu_Van: form.Can_Tu_Van.trim(),
        Trang_Thai: form.Trang_Thai,
        Coc: form.Coc.trim(),
        Coc_Host: form.Coc_Host.trim(),
        Chu_Can: form.Chu_Can.trim(),
        Thu_Ve: form.Thu_Ve.trim(),
        Ghi_Chu: form.Ghi_Chu.trim(),
        Mau_KH: form.Mau_KH || '',
        Owner_Id: userId || '',
      };

      if (editItem) {
        await postKhachTimes({
          action: 'update',
          _rowIndex: editItem._rowIndex,
          STT: editItem.STT,
          Thu_Tu: editItem.Thu_Tu || '', // giữ nguyên thứ tự khi sửa
          ...payload,
        });
        setItems(prev => prev.map(it =>
          it._rowIndex === editItem._rowIndex ? { ...it, ...payload } : it
        ));
        showToast('Cập nhật thành công!');
        closeModal();
        setTimeout(() => loadData(), 500);
      } else {
        const maxSTT = items.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);
        // Khách mới luôn ở đầu bảng: gán Thu_Tu nhỏ hơn mọi giá trị hiện có.
        const minThuTu = items.reduce((m, i) => {
          const v = Number(i.Thu_Tu);
          return (i.Thu_Tu !== '' && i.Thu_Tu != null && !Number.isNaN(v)) ? Math.min(m, v) : m;
        }, 0);
        const newThuTu = minThuTu - 1;
        const addPayload = { ...payload, Thu_Tu: newThuTu };
        const result = await postKhachTimes({
          action: 'add',
          STT: maxSTT + 1,
          ...addPayload,
        });
        // Use the actual rowIndex returned by the server for accurate edit/delete
        const realRowIndex = result?.rowIndex || Date.now();
        setItems(prev => [...prev, { ...addPayload, STT: maxSTT + 1, _rowIndex: realRowIndex }]);
        showToast('Thêm khách thành công!');
        closeModal();
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await postKhachTimes({
        action: 'delete',
        _rowIndex: deleteTarget._rowIndex,
      });
      showToast('Đã xoá khách hàng!');
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div style={showHeader ? s.root : { fontFamily: F, color: C.text }}>
      {showHeader && (
        <div style={s.header}>
          <div style={s.headerInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate('/')} style={s.backBtn} className="kt-btn">&larr;</button>
              <div>
                <div style={s.headerTitle}>Khách Times City</div>
                <div style={s.headerSub}>Quản lý khách hàng bất động sản</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={showHeader ? s.container : { padding: '0' }}>
        <div className="kt-header-row" style={s.titleRow}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={openAdd} style={s.addBtn} className="kt-btn">+ Thêm Khách</button>
            <button onClick={loadData} disabled={loading} style={s.reloadBtn} className="kt-btn" title="Tải lại">
              {loading ? '...' : '↻'}
            </button>
          </div>
          <div className="kt-stats" style={s.statsRow}>
            <StatBadge label="Tổng" value={stats.total} color={C.blue} />
            <StatBadge label="Thuê" value={stats.thue} color={C.primary} />
            <StatBadge label="Mua" value={stats.mua} color={C.accent} />
            <StatBadge label="Homestay" value={stats.homestay} color="#E67E22" />
          </div>
        </div>

        {/* Sub-tabs: Khách bán / Khách thuê / Khách Homestay */}
        <div className="kt-subtabs-row" style={s.subTabsRow}>
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className="kt-subtab"
              style={{ ...s.subTab, ...(activeSubTab === tab.key ? s.subTabActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chuyển chế độ xem: Bảng / Mind Map — chỉ ở tab Khách thuê */}
        {isThueTab && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { key: 'table', label: '☰ Bảng' },
              { key: 'mindmap', label: '🗺 Mind Map' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  if (m.key === 'mindmap' && viewMode !== 'mindmap') {
                    setFilterTrangThai(['Tư vấn, gửi căn', 'Dẫn khách']);
                  }
                  setViewMode(m.key);
                }}
                className="kt-btn"
                style={{
                  padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: F, transition: 'all 0.15s',
                  border: `1.5px solid ${viewMode === m.key ? C.primary : '#3a3f52'}`,
                  background: viewMode === m.key ? C.primary : 'transparent',
                  color: viewMode === m.key ? '#fff' : '#8a9bb8',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Search + Filter */}
        <div className="kt-filter-row" style={s.filterRow}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>&#128269;</span>
            <input
              type="text"
              placeholder="Tìm thường, hoặc gõ AI: 3n không đồ hướng bắc, 20 tỷ..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (aiFilter) setAiFilter(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }}
              style={{ ...s.searchInput, ...(aiFilter ? { borderColor: C.primary, paddingRight: 64 } : {}) }}
            />
            {(search || aiFilter) && <button onClick={clearSearch} style={s.clearBtn}>&times;</button>}
          </div>
          <button
            onClick={handleAiSearch}
            disabled={aiSearching}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: aiSearching ? 'wait' : 'pointer', fontFamily: F, whiteSpace: 'nowrap',
              border: 'none', background: C.gradient, color: '#fff',
              opacity: aiSearching ? 0.6 : 1, boxShadow: C.shadowGreen,
            }}
            title="Tìm kiếm thông minh bằng AI"
          >
            {aiSearching ? '⏳ Đang tìm...' : '✨ Tìm AI'}
          </button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {trangThaiOptions.filter(o => o.value).map(o => {
              const active = filterTrangThai.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => setFilterTrangThai(prev =>
                    prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]
                  )}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: F, transition: 'all 0.15s',
                    border: `1.5px solid ${active ? o.text : '#3a3f52'}`,
                    background: active ? o.bg : 'transparent',
                    color: active ? o.text : '#8a9bb8',
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
            {filterTrangThai.length > 0 && (
              <button
                onClick={() => setFilterTrangThai([])}
                style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: F, background: 'none', border: '1.5px solid #3a3f52', color: '#8a9bb8' }}
              >
                ✕ Bỏ lọc
              </button>
            )}
          </div>
          <div style={s.resultCount}>{filtered.length} / {items.length} khách</div>
        </div>

        {/* Tiêu chí AI đã nhận dạng */}
        {aiFilter && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16, marginTop: -4 }}>
            <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 700 }}>✨ AI nhận dạng:</span>
            {[
              aiFilter.Thiet_Ke && { label: aiFilter.Thiet_Ke },
              aiFilter.Huong_BC && { label: 'Hướng ' + aiFilter.Huong_BC },
              aiFilter.Noi_That && { label: aiFilter.Noi_That },
              aiFilter.Toa && { label: 'Toà ' + aiFilter.Toa },
              (aiFilter.Gia_Min != null || aiFilter.Gia_Max != null) && {
                label: 'Tài chính ' + (
                  aiFilter.Gia_Min != null && aiFilter.Gia_Max != null
                    ? `${aiFilter.Gia_Min}–${aiFilter.Gia_Max} tr`
                    : aiFilter.Gia_Max != null ? `≤ ${aiFilter.Gia_Max} tr` : `≥ ${aiFilter.Gia_Min} tr`
                ),
              },
            ].filter(Boolean).map((b, i) => (
              <span key={i} style={{
                fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                background: 'rgba(34,197,94,0.15)', border: '1px solid #22C55E', color: '#4ADE80',
              }}>{b.label}</span>
            ))}
            <button
              onClick={clearSearch}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: F, background: 'none', border: '1px solid #3a3f52', color: '#8a9bb8' }}
            >✕ Xoá lọc AI</button>
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}
        {loading && <div style={s.loadingBox}>Đang tải dữ liệu...</div>}

        {/* Mind Map view — tab Khách thuê */}
        {!loading && !error && isThueTab && viewMode === 'mindmap' && (
          <MindMapFlow
            tree={mindMapTree}
            collapsed={mmCollapsed}
            onToggleNode={toggleMmNode}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        )}

        {/* Table */}
        {!loading && !error && !(isThueTab && viewMode === 'mindmap') && (
          <div className="kt-table-wrap" style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: 30, minWidth: 30, padding: '10px 2px' }} title={canDrag ? 'Kéo để sắp xếp' : 'Bỏ lọc/tìm kiếm để kéo sắp xếp'}></th>
                  {[
                    { h: 'Ngày PS', w: 80 }, { h: 'Tên (Zalo)', w: 110 },
                    { h: 'SĐT', w: 100 }, { h: 'Nhu cầu', w: 80 }, { h: 'PN', w: 44 },
                    ...(isHomestayTab ? [] : [{ h: 'Diện tích', w: 80 }]),
                    ...(isBanTab ? [{ h: 'Tầng', w: 60 }, { h: 'Ban công', w: 70 }, { h: 'Cửa', w: 70 }] : []),
                    ...(isHomestayTab ? [] : [{ h: 'Nội thất', w: 110 }, { h: 'Slot', w: 50 }]),
                    ...(isBanTab ? [] : (isHomestayTab
                      ? [{ h: 'Thời hạn', w: 90 }, { h: 'Check In', w: 66 }, { h: 'Check Out', w: 66 }]
                      : [{ h: 'Thời hạn', w: 90 }, { h: 'Ngày vào', w: 66 }])),
                    ...(isHomestayTab
                      ? [{ h: 'Căn Lock', w: 130 }, { h: 'Trạng thái', w: 120 }, { h: 'Tổng tiền', w: 120 }]
                      : [{ h: 'Tài chính', w: 90 }, { h: 'Căn tư vấn', w: 160 }, { h: 'Trạng thái', w: 120 }]),
                    ...(isHomestayTab
                      ? [{ h: 'Khách cọc', w: 80 }, { h: 'Cọc Host', w: 80 }, { h: 'Host', w: 100 }]
                      : [{ h: 'Cọc', w: 80 }]),
                    { h: 'Thu về', w: 90 }, { h: 'Ghi chú', w: 220 }, { h: '', w: 64 },
                  ].map(({ h, w }, idx) => (
                    <th key={h || `act_${idx}`} style={{ ...s.th, width: w, minWidth: w }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={isBanTab ? 19 : (isHomestayTab ? 18 : 18)} style={s.emptyTd}>{items.length === 0 ? 'Chưa có khách hàng nào' : 'Không tìm thấy kết quả'}</td></tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item._rowIndex}
                      className="kt-row"
                      style={{
                        ...s.tr,
                        ...(dragRowIndex === item._rowIndex ? { opacity: 0.4 } : {}),
                        ...(dragOverIndex === item._rowIndex && dragRowIndex !== item._rowIndex
                          ? { boxShadow: `inset 0 2px 0 0 ${C.primary}` } : {}),
                      }}
                      onDragOver={canDrag ? (e) => { e.preventDefault(); if (dragOverIndex !== item._rowIndex) setDragOverIndex(item._rowIndex); } : undefined}
                      onDrop={canDrag ? (e) => { e.preventDefault(); handleDrop(item._rowIndex); } : undefined}
                    >
                      <td
                        style={{ ...s.td, textAlign: 'center', padding: '8px 2px', cursor: canDrag ? 'grab' : 'not-allowed', color: canDrag ? '#8a9bb8' : '#3a3f52', userSelect: 'none' }}
                        draggable={canDrag}
                        onDragStart={canDrag ? (e) => { setDragRowIndex(item._rowIndex); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                        onDragEnd={() => { setDragRowIndex(null); setDragOverIndex(null); }}
                        title={canDrag ? 'Kéo để đổi thứ tự' : 'Bỏ tìm kiếm/lọc để kéo sắp xếp'}
                      >
                        &#9776;
                      </td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_PS}</td>
                      <td style={{ ...s.td, ...s.tdName, fontWeight: 600, whiteSpace: 'pre-line' }}>
                        {item.Mau_KH ? (
                          <span style={{ background: item.Mau_KH, color: '#fff', padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>{item.Ten_Zalo}</span>
                        ) : item.Ten_Zalo}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap' }}>{item.SDT}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={getNhuCauBadgeStyle(item.Nhu_Cau)}>{item.Nhu_Cau || '-'}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{item.Phong_Ngu}</td>
                      {!isHomestayTab && (
                        <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 }}>{item.Dien_Tich}</td>
                      )}
                      {isBanTab && (
                        <>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 }}>{item.Tang}</td>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ban_Cong}</td>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 }}>{item.Cua}</td>
                        </>
                      )}
                      {!isHomestayTab && (
                        <>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'pre-line', fontSize: 12 }}>{item.Noi_That}</td>
                          <td style={{ ...s.td, textAlign: 'center' }}>{item.Slot_Xe || '-'}</td>
                        </>
                      )}
                      {!isBanTab && (
                        <>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'pre-line', fontSize: 12 }}>{item.Thoi_Han_Thue}</td>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_Vao}</td>
                          {isHomestayTab && (
                            <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12 }}>{item.Check_Out}</td>
                          )}
                        </>
                      )}
                      {isHomestayTab ? (
                        <>
                          <td style={{ ...s.td, whiteSpace: 'pre-line', fontSize: 12 }}>{item.Can_Tu_Van}</td>
                          {/* Trạng thái — inline dropdown */}
                          <td style={{ ...s.td, padding: '4px 4px' }}>
                            <select
                              className="kt-inline-select"
                              value={item.Trang_Thai || ''}
                              onChange={(e) => inlineUpdate(item, 'Trang_Thai', e.target.value)}
                              style={getTrangThaiSelectStyle(item.Trang_Thai)}
                            >
                              {trangThaiOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'pre-line', fontSize: 12 }}>{item.Tai_Chinh}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...s.td, textAlign: 'center', whiteSpace: 'pre-line', fontSize: 12 }}>{item.Tai_Chinh}</td>
                          <td style={{ ...s.td, whiteSpace: 'pre-line', fontSize: 12 }}>{item.Can_Tu_Van}</td>
                          {/* Trạng thái — inline dropdown */}
                          <td style={{ ...s.td, padding: '4px 4px' }}>
                            <select
                              className="kt-inline-select"
                              value={item.Trang_Thai || ''}
                              onChange={(e) => inlineUpdate(item, 'Trang_Thai', e.target.value)}
                              style={getTrangThaiSelectStyle(item.Trang_Thai)}
                            >
                              {trangThaiOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                        </>
                      )}
                      {/* Cọc (khách) */}
                      <td style={{ ...s.td, textAlign: 'center', fontSize: 12 }}>{item.Coc}</td>
                      {isHomestayTab && (
                        <>
                          {/* Cọc Host */}
                          <td style={{ ...s.td, textAlign: 'center', fontSize: 12 }}>{item.Coc_Host}</td>
                          {/* Host */}
                          <td style={{ ...s.td, textAlign: 'center', fontSize: 12 }}>{item.Chu_Can}</td>
                        </>
                      )}
                      {/* Thu về */}
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 700, color: '#38b274', fontSize: 12 }}>{item.Thu_Ve}</td>
                      <td style={{ ...s.td, whiteSpace: 'pre-line', color: '#a3e635', fontSize: 12 }}>{item.Ghi_Chu}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', borderRight: 'none' }}>
                        <button onClick={() => openEdit(item)} style={s.actionBtn} title="Sửa">&#9998;</button>
                        <button onClick={() => setDeleteTarget(item)} style={{ ...s.actionBtn, ...s.deleteBtn }} title="Xoá">&#128465;</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="kt-modal-content" style={s.modal}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>{editItem ? 'Sửa khách hàng' : 'Thêm khách mới'}</div>
              <button onClick={closeModal} style={s.modalClose}>&times;</button>
            </div>
            <div style={s.modalBody}>
              <FormField label="Ngày phát sinh" value={form.Ngay_PS} onChange={(v) => updateForm('Ngay_PS', v)} placeholder="VD: 10/03/2026" />
              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Tên khách (Zalo) *</label>
                <textarea value={form.Ten_Zalo} onChange={(e) => updateForm('Ten_Zalo', e.target.value)} placeholder="VD: Anh Minh (zalo: Minh BĐS)" style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
              </div>
              <FormField label="Số điện thoại *" value={form.SDT} onChange={(v) => updateForm('SDT', v)} type="tel" />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Nhu cầu *</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {NHU_CAU_OPTIONS.map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: '#e2e8f0' }}>
                      <input type="radio" name="nhu_cau" checked={form.Nhu_Cau === val} onChange={() => updateForm('Nhu_Cau', val)} style={{ accentColor: C.primary }} />
                      {val}
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Phòng ngủ</label>
                <select value={form.Phong_Ngu} onChange={(e) => updateForm('Phong_Ngu', e.target.value)} style={s.fieldInput}>
                  <option value="">-- Chọn --</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={`${n}`}>{n}</option>)}
                  <option value="Đập thông">Đập thông</option>
                  <option value="Shophouse">Shophouse</option>
                </select>
              </div>

              {form.Nhu_Cau !== 'Homestay' && (
                <>
                  <div style={s.fieldWrap}>
                    <label style={s.fieldLabel}>Nội thất</label>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      {NOI_THAT_OPTIONS.map((val) => (
                        <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: '#e2e8f0' }}>
                          <input type="radio" name="noi_that" checked={form.Noi_That === val} onChange={() => updateForm('Noi_That', val)} style={{ accentColor: C.primary }} />
                          {val}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={s.fieldWrap}>
                    <label style={s.fieldLabel}>Slot xe</label>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      {SLOT_XE_OPTIONS.map((val) => (
                        <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: '#e2e8f0' }}>
                          <input type="radio" name="slot_xe" checked={form.Slot_Xe === val} onChange={() => updateForm('Slot_Xe', val)} style={{ accentColor: C.primary }} />
                          {val === 'Null' ? 'Không quan trọng' : val}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {form.Nhu_Cau !== 'Mua' && (
                <>
                  <div style={s.fieldWrap}>
                    <label style={s.fieldLabel}>Thời hạn thuê</label>
                    <textarea value={form.Thoi_Han_Thue} onChange={(e) => updateForm('Thoi_Han_Thue', e.target.value)} placeholder="VD: 1 năm, 2 năm, dài hạn..." style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
                  </div>
                  <FormField label={form.Nhu_Cau === 'Homestay' ? 'Check In' : 'Ngày vào'} value={form.Ngay_Vao} onChange={(v) => updateForm('Ngay_Vao', v)} placeholder="VD: 15/04/2025, Tháng 5..." />
                  {form.Nhu_Cau === 'Homestay' && (
                    <FormField label="Check Out" value={form.Check_Out} onChange={(v) => updateForm('Check_Out', v)} placeholder="VD: 20/04/2025, Tháng 6..." />
                  )}
                </>
              )}
              {form.Nhu_Cau !== 'Homestay' && (
                <FormField label="Diện tích" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 75m2, 90m2..." />
              )}
              {form.Nhu_Cau === 'Mua' && (
                <>
                  <FormField label="Tầng" value={form.Tang} onChange={(v) => updateForm('Tang', v)} placeholder="VD: 12, tầng cao, tầng trung..." />
                  <FormField label="Ban công" value={form.Ban_Cong} onChange={(v) => updateForm('Ban_Cong', v)} placeholder="VD: Đông Nam, hướng hồ..." />
                  <FormField label="Cửa" value={form.Cua} onChange={(v) => updateForm('Cua', v)} placeholder="VD: Đông, Tây Bắc..." />
                </>
              )}
              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>{isHomestayTab ? 'Tổng tiền' : 'Tài chính'}</label>
                <textarea value={form.Tai_Chinh} onChange={(e) => updateForm('Tai_Chinh', e.target.value)} placeholder="VD: 11 / 11.5 / 2000" style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
              </div>
              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Tòa</label>
                <textarea value={form.Toa} onChange={(e) => updateForm('Toa', e.target.value)} placeholder="VD: T1, Park 5, R6..." style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>{isHomestayTab ? 'Căn Lock' : 'Căn tư vấn'}</label>
                <textarea value={form.Can_Tu_Van} onChange={(e) => updateForm('Can_Tu_Van', e.target.value)} placeholder="VD: Park 1 - 07.12&#10;Park 5 - 03.08" style={{ ...s.fieldInput, height: 72, resize: 'vertical' }} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Trạng thái khách</label>
                <select value={form.Trang_Thai} onChange={(e) => updateForm('Trang_Thai', e.target.value)} style={s.fieldInput}>
                  {trangThaiOptions.map(o => <option key={o.value} value={o.value}>{o.value ? o.label : '-- Chưa xác định --'}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Cọc" value={form.Coc} onChange={(v) => updateForm('Coc', v)} placeholder="VD: 50tr, 100tr..." />
                </div>
                {isHomestayTab && (
                  <>
                    <div style={{ flex: 1 }}>
                      <FormField label="Cọc Host" value={form.Coc_Host} onChange={(v) => updateForm('Coc_Host', v)} placeholder="VD: 50tr, 100tr..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormField label="Host" value={form.Chu_Can} onChange={(v) => updateForm('Chu_Can', v)} placeholder="VD: Anh Nam 0363..." />
                    </div>
                  </>
                )}
              </div>
              <FormField label="Thu về (lợi nhuận)" value={form.Thu_Ve} onChange={(v) => updateForm('Thu_Ve', v)} placeholder="VD: 5tr, 10tr, 2.5tr..." />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Ghi chú</label>
                <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
              </div>

              <ColorPicker value={form.Mau_KH} onChange={(v) => updateForm('Mau_KH', v)} />
            </div>
            <div style={s.modalFooter}>
              <button onClick={closeModal} style={s.cancelBtn} className="kt-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving} style={s.saveBtn} className="kt-btn">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={s.confirmBox}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: C.text }}>Xác nhận xoá</div>
            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
              Xoá khách <strong>{deleteTarget.Ten_Zalo}</strong>? Hành động này không thể hoàn tác.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={s.cancelBtn} className="kt-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...s.saveBtn, background: C.error }} className="kt-btn">{saving ? 'Đang xoá...' : 'Xoá'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...s.toast, background: toast.type === 'error' ? C.error : C.primary, animation: 'ktToastIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Mind Map (cây ngang React Flow) cho tab Khách thuê ──

// Kích thước node mặc định để dagre tính layout.
const MM_NODE_W = 230;
const MM_NODE_H = 46;

// Dùng dagre tính vị trí node cho cây ngang (trái → phải).
function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 90, marginx: 20, marginy: 20 });

  nodes.forEach((n) => {
    g.setNode(n.id, { width: n.width || MM_NODE_W, height: n.height || MM_NODE_H });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const laid = nodes.map((n) => {
    const pos = g.node(n.id);
    const w = n.width || MM_NODE_W;
    const h = n.height || MM_NODE_H;
    return {
      ...n,
      sourcePosition: 'right',
      targetPosition: 'left',
      // dagre trả tâm node → quy về góc trên-trái cho react-flow.
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });

  // Giãn khoảng cách dọc giữa 2 nhánh gốc (KẾT HỢP / KHÁCH CHỦ ĐỘNG):
  // sắp các nhánh theo y trung bình, đẩy mỗi nhánh phía dưới xuống thêm BRANCH_GAP.
  const BRANCH_GAP = 140;
  const branchMinY = {};
  laid.forEach((n) => {
    const b = n._branch;
    if (b == null) return;
    if (branchMinY[b] === undefined || n.position.y < branchMinY[b]) {
      branchMinY[b] = n.position.y;
    }
  });
  const orderedBranches = Object.keys(branchMinY).sort(
    (a, b) => branchMinY[a] - branchMinY[b]
  );
  const branchShift = {};
  orderedBranches.forEach((b, i) => {
    branchShift[b] = i * BRANCH_GAP;
  });
  laid.forEach((n) => {
    if (n._branch != null && branchShift[n._branch]) {
      n.position = { ...n.position, y: n.position.y + branchShift[n._branch] };
    }
  });

  return { nodes: laid, edges };
}

// Node tuỳ biến cho khách (cấp 3): tên + SĐT + nút Sửa/Xoá.
function CustomerNode({ data }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6, fontFamily: F,
        padding: '7px 10px', borderRadius: 10, width: 320, boxSizing: 'border-box',
        border: '1px solid #2d3344',
        background: 'rgba(255,255,255,0.04)',
        color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'default',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {data.color ? (
          <span style={{ background: data.color, color: '#fff', padding: '2px 8px', borderRadius: 6, alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </span>
        ) : (
          <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name}</span>
        )}
        {data.sdt && <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>{data.sdt}</span>}
        {(data.ngayVao || data.slotXe || data.taiChinh) && (
          <span style={{ fontSize: 11, color: '#7dd3fc', fontWeight: 500, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {data.ngayVao && <span>Ngày vào: {data.ngayVao}</span>}
            {data.slotXe && <span>Slot xe: {data.slotXe}</span>}
            {data.taiChinh && <span>Tài chính: {data.taiChinh}</span>}
          </span>
        )}
        {data.hasDetails && (
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
            {data.detailsOpen ? '▾ Ẩn thông tin' : '▸ Xem thêm'}
          </span>
        )}
      </div>
      <button
        className="nodrag"
        onClick={(e) => { e.stopPropagation(); data.onEdit(); }}
        style={s.actionBtn}
        title="Sửa"
      >&#9998;</button>
      <button
        className="nodrag"
        onClick={(e) => { e.stopPropagation(); data.onDelete(); }}
        style={{ ...s.actionBtn, ...s.deleteBtn }}
        title="Xoá"
      >&#128465;</button>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

// Node phụ: gộp toàn bộ thông tin còn lại của khách (ẩn/hiện theo node khách).
function CustomerDetailNode({ data }) {
  return (
    <div
      style={{
        fontFamily: F, padding: '8px 11px', borderRadius: 10, width: 300, boxSizing: 'border-box',
        border: '1px dashed #3a3f52', background: 'rgba(125,211,252,0.05)',
        color: '#cbd5e1', fontSize: 11, fontWeight: 500, cursor: 'default',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {data.fields.map((f) => (
          <span key={f.label} style={{ display: 'flex', gap: 6 }}>
            <span style={{ color: '#94a3b8', minWidth: 78 }}>{f.label}:</span>
            <span style={{ color: '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>{f.value}</span>
          </span>
        ))}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const MM_NODE_TYPES = { customer: CustomerNode, customerDetail: CustomerDetailNode };

// Các trường đẩy ra nhánh phụ (label hiển thị → key trong dữ liệu).
const DETAIL_FIELDS = [
  ['Ngày PS', 'Ngay_PS'],
  ['Thời hạn', 'Thoi_Han_Thue'],
  ['Check out', 'Check_Out'],
  ['Diện tích', 'Dien_Tich'],
  ['Tầng', 'Tang'],
  ['Ban công', 'Ban_Cong'],
  ['Cửa', 'Cua'],
  ['Toà', 'Toa'],
  ['Cần tư vấn', 'Can_Tu_Van'],
  ['Trạng thái', 'Trang_Thai'],
  ['Cọc', 'Coc'],
  ['Cọc Host', 'Coc_Host'],
  ['Chủ căn', 'Chu_Can'],
  ['Thu về', 'Thu_Ve'],
  ['Ghi chú', 'Ghi_Chu'],
];

function MindMapFlowInner({ tree, collapsed, onToggleNode, onEdit, onDelete }) {
  const hasData = tree.some((b) => b.total > 0);

  const { nodes, edges } = useMemo(() => {
    const ns = [];
    const es = [];

    tree.forEach((branch) => {
      if (branch.total === 0) return;
      const isKetHop = branch.kieu === 'KẾT HỢP';
      const l1Color = isKetHop ? '#E67E22' : C.primary;
      const l1Id = `L1::${branch.kieu}`;
      const l1Open = !collapsed.has(l1Id);

      ns.push({
        id: l1Id,
        _branch: branch.kieu,
        data: { label: `${l1Open ? '▾ ' : '▸ '}${branch.kieu} (${branch.total})` },
        style: {
          fontFamily: F, fontWeight: 800, fontSize: 14, color: l1Color,
          border: `1.5px solid ${l1Color}88`, background: `${l1Color}26`,
          borderRadius: 10, padding: '8px 12px', width: MM_NODE_W, cursor: 'pointer',
        },
      });

      if (!l1Open) return;

      branch.pnGroups.forEach((g) => {
        const l2Id = `L2::${branch.kieu}::${g.pn}`;
        const l2Open = !collapsed.has(l2Id);

        ns.push({
          id: l2Id,
          _branch: branch.kieu,
          data: { label: `${l2Open ? '▾ ' : '▸ '}PN: ${g.pn} (${g.count})` },
          style: {
            fontFamily: F, fontWeight: 700, fontSize: 13, color: '#cbd5e1',
            border: '1.5px solid #3a3f52', background: 'rgba(255,255,255,0.05)',
            borderRadius: 9, padding: '7px 11px', width: MM_NODE_W - 20, cursor: 'pointer',
          },
        });
        es.push({ id: `e::${l1Id}::${l2Id}`, source: l1Id, target: l2Id, type: 'bezier', style: { stroke: `${l1Color}99` } });

        if (!l2Open) return;

        g.ntGroups.forEach((ntg) => {
          const l3Id = `L3::${branch.kieu}::${g.pn}::${ntg.nt}`;
          const l3Open = !collapsed.has(l3Id);

          ns.push({
            id: l3Id,
            _branch: branch.kieu,
            data: { label: `${l3Open ? '▾ ' : '▸ '}${ntg.nt} (${ntg.count})` },
            style: {
              fontFamily: F, fontWeight: 700, fontSize: 12.5, color: '#cbd5e1',
              border: '1.5px solid #3a3f52', background: 'rgba(255,255,255,0.04)',
              borderRadius: 9, padding: '6px 10px', width: MM_NODE_W - 40, cursor: 'pointer',
            },
          });
          es.push({ id: `e::${l2Id}::${l3Id}`, source: l2Id, target: l3Id, type: 'bezier', style: { stroke: '#3a3f5288' } });

          if (!l3Open) return;

          ntg.khach.forEach((item) => {
            const cId = `C::${item._rowIndex}`;
            const detailFields = DETAIL_FIELDS
              .map(([label, key]) => ({ label, value: String(item[key] ?? '').trim() }))
              .filter((f) => f.value);
            const hasDetails = detailFields.length > 0;
            const dId = `D::${item._rowIndex}`;
            const detailsOpen = hasDetails && !collapsed.has(dId);

            ns.push({
              id: cId,
              _branch: branch.kieu,
              type: 'customer',
              width: 320,
              height: 100,
              data: {
                name: item.Ten_Zalo || '(chưa có tên)',
                sdt: item.SDT || '',
                ngayVao: item.Ngay_Vao || '',
                slotXe: item.Slot_Xe || '',
                taiChinh: item.Tai_Chinh || '',
                color: item.Mau_KH || '',
                hasDetails,
                detailsOpen,
                onEdit: () => onEdit(item),
                onDelete: () => onDelete(item),
              },
              style: { width: 'auto' },
            });
            es.push({ id: `e::${l3Id}::${cId}`, source: l3Id, target: cId, type: 'bezier', style: { stroke: '#3a3f5299' } });

            if (detailsOpen) {
              ns.push({
                id: dId,
                _branch: branch.kieu,
                type: 'customerDetail',
                width: 300,
                height: Math.max(60, detailFields.length * 18 + 20),
                data: { fields: detailFields },
                style: { width: 'auto' },
              });
              es.push({ id: `e::${cId}::${dId}`, source: cId, target: dId, type: 'bezier', style: { stroke: '#7dd3fc66' } });
            }
          });
        });
      });
    });

    return getLayoutedElements(ns, es);
  }, [tree, collapsed, onEdit, onDelete]);

  const onNodeClick = useCallback((_evt, node) => {
    if (node.id.startsWith('L1::') || node.id.startsWith('L2::') || node.id.startsWith('L3::')) {
      onToggleNode(node.id);
    } else if (node.id.startsWith('C::') && node.data?.hasDetails) {
      onToggleNode(`D::${node.id.slice(3)}`);
    }
  }, [onToggleNode]);

  if (!hasData) {
    return <div style={s.emptyTd}>Không có khách hàng nào để hiển thị</div>;
  }

  return (
    <div style={{ height: '72vh', borderRadius: 12, overflow: 'hidden', border: '1px solid #2d3344', marginBottom: 16 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={MM_NODE_TYPES}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#3a3f52" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function MindMapFlow(props) {
  return (
    <ReactFlowProvider>
      <MindMapFlowInner {...props} />
    </ReactFlowProvider>
  );
}

// ── Helpers ──
function getNhuCauBadgeStyle(val) {
  const v = (val || '').toLowerCase();
  const base = { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 };
  if (v.includes('thu')) return { ...base, background: C.primary + '18', color: C.primaryDark };
  if (v === 'mua') return { ...base, background: 'rgba(0,210,210,0.15)', color: '#00d2d2' };
  if (v === 'homestay') return { ...base, background: '#E67E2218', color: '#E67E22' };
  return { fontSize: 12, color: C.textDim };
}

function getTrangThaiSelectStyle(val) {
  const opt = [...TRANG_THAI_OPTIONS, ...HOMESTAY_TRANG_THAI_OPTIONS].find(o => o.value === val);
  if (!opt || !opt.value) return {};
  return { background: opt.bg, color: opt.text, borderRadius: 8, fontWeight: 700 };
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ marginTop: 4 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a9bb8', marginBottom: 6 }}>Màu khách hàng (highlight tên)</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {RAINBOW_COLORS.map((c) => (
          <button
            key={c.value || 'def'}
            type="button"
            onClick={() => onChange(c.value)}
            title={c.label}
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: c.value || '#2a2f42',
              border: value === c.value ? '3px solid #fff' : '2px solid #3a3f52',
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: value === c.value ? `0 0 0 2px ${c.value || '#8a9bb8'}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ──
function StatBadge({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: color + '12', padding: '6px 14px',
      borderRadius: 8, fontSize: 13, fontWeight: 600, color,
    }}>
      {label}: <span style={{ fontSize: 16 }}>{value}</span>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.fieldLabel}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={s.fieldInput} />
    </div>
  );
}

// ── Styles ──
const colDivider = '1.5px solid #2d3240';

const s = {
  root: { fontFamily: F, background: '#0f1117', minHeight: '100vh', color: '#e2e8f0' },
  header: { background: '#13151e', borderBottom: '1px solid #2d3240', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.4)' },
  headerInner: { maxWidth: 1200, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: '#8a9bb8', marginTop: 1 },
  backBtn: { background: 'rgba(56,178,116,0.15)', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 18, color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  container: { maxWidth: 1500, margin: '0 auto', padding: '20px 16px' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  addBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s ease', whiteSpace: 'nowrap' },
  reloadBtn: { background: '#22263a', border: '1.5px solid #3a3f52', borderRadius: 10, width: 40, height: 40, fontSize: 20, color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, transition: 'all 0.15s', fontFamily: F },
  statsRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  subTabsRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  subTab: { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#1e2130', color: '#8a9bb8', border: '1.5px solid #3a3f52', cursor: 'pointer', fontFamily: F, transition: 'all 0.15s' },
  subTabActive: { background: C.gradient, color: '#fff', border: '1.5px solid transparent', boxShadow: C.shadowGreen },
  filterRow: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 },
  searchWrap: { flex: 1, position: 'relative', minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 },
  searchInput: { width: '100%', padding: '10px 36px', border: '1.5px solid #3a3f52', borderRadius: 10, fontSize: 13, fontFamily: F, outline: 'none', background: '#1e2130', color: '#e2e8f0', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  clearBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, color: '#8a9bb8', cursor: 'pointer', padding: '0 4px' },
  resultCount: { fontSize: 12, color: '#8a9bb8', whiteSpace: 'nowrap' },
  errorBox: { background: '#2d1515', color: '#fc8181', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  loadingBox: { textAlign: 'center', padding: 40, color: '#8a9bb8', fontSize: 14 },
  tableWrap: { background: '#1a1d27', borderRadius: 12, border: '1px solid #2d3240', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', animation: 'ktFadeIn 0.3s ease' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'center', padding: '10px 8px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#8a9bb8', borderBottom: '2px solid #2d3240', borderRight: colDivider, whiteSpace: 'nowrap', background: '#13151e' },
  tr: { borderBottom: '1.5px solid #2d3240', transition: 'background 0.12s' },
  td: { padding: '8px 8px', verticalAlign: 'middle', fontSize: 13, borderRight: colDivider, color: '#e2e8f0' },
  tdName: { minWidth: 100, whiteSpace: 'nowrap' },
  emptyTd: { textAlign: 'center', padding: 40, color: '#8a9bb8', fontSize: 14 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6, transition: 'background 0.12s', color: '#8a9bb8' },
  deleteBtn: { color: C.error },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#1a1d27', borderRadius: 16, width: 520, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'ktSlideUp 0.25s ease', overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2d3240' },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#e2e8f0' },
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: '#8a9bb8', cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  modalBody: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #2d3240' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#8a9bb8', marginBottom: 4 },
  fieldInput: { width: '100%', padding: '9px 12px', border: '1.5px solid #3a3f52', borderRadius: 8, fontSize: 14, fontFamily: F, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', background: '#22263a', color: '#e2e8f0' },
  cancelBtn: { background: 'none', border: '1.5px solid #3a3f52', borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, color: '#8a9bb8', transition: 'all 0.15s' },
  saveBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s' },
  confirmBox: { background: '#1a1d27', borderRadius: 16, padding: '24px', width: 380, maxWidth: '100%', boxShadow: C.shadowLg, animation: 'ktSlideUp 0.2s ease' },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, boxShadow: C.shadowMd, zIndex: 2000 },
};
