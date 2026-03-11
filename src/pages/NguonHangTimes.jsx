import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { fetchQuyCanThue, postQuyCanThue, fetchQuyCanBan, postQuyCanBan } from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

function getTodayStr() {
  const d = new Date();
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const RAINBOW_COLORS = [
  { label: 'Mặc định', value: '' },
  { label: 'Đỏ', value: '#E53E3E' },
  { label: 'Cam', value: '#DD6B20' },
  { label: 'Vàng', value: '#D69E2E' },
  { label: 'Xanh lá', value: '#38A169' },
  { label: 'Xanh dương', value: '#3182CE' },
  { label: 'Chàm', value: '#5B21B6' },
  { label: 'Tím', value: '#9F7AEA' },
];

const EMPTY_FORM_THUE = {
  Ngay_PS: '', Ngay_Cap_Nhat: '', Nguon: '', Ma_Can: '', PN: '',
  Dien_Tich: '', BC: '', Gia: '', Phi_MG: '', TT: '', Slot_Xe: '',
  Thang: '', Nam: '', Ten_Chu: '', SDT_Chu: '', Pass: '', Ghi_Chu: '',
  Mau_Ma_Can: '',
};

const EMPTY_FORM_BAN = {
  Ngay_PS: '', Ngay_Cap_Nhat: '', Nguon: '', Ma_Can: '', PN: '',
  Dien_Tich: '', BC: '', Cua: '', Gia: '', Phi_MG: '', TT: '', Slot_Xe: '',
  Ten_Chu: '', SDT_Chu: '', Pass: '', Ghi_Chu: '',
  Mau_Ma_Can: '',
};

const HEADERS_THUE = ['STT', 'Ngày PS', 'Ngày CN', 'Nguồn', 'Mã căn', 'PN', 'DT', 'BC', 'Giá', 'Phí MG', 'TT', 'Slot xe', 'Tháng', 'Năm', 'Tên chủ', 'SĐT chủ', 'Pass', 'Ghi chú', ''];
const HEADERS_BAN = ['STT', 'Ngày PS', 'Ngày CN', 'Nguồn', 'Mã căn', 'PN', 'DT', 'BC', 'Cửa', 'Giá', 'Phí MG', 'TT', 'Slot xe', 'Tên chủ', 'SĐT chủ', 'Pass', 'Ghi chú', ''];

export function NguonHangContent() {
  return <NguonHangInner showHeader={false} />;
}

export default function NguonHangTimes() {
  return <NguonHangInner showHeader={true} />;
}

function NguonHangInner({ showHeader }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('thue'); // 'thue' | 'ban'

  // Shared states
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM_THUE });

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isThue = viewMode === 'thue';
  const EMPTY_FORM = isThue ? EMPTY_FORM_THUE : EMPTY_FORM_BAN;
  const TABLE_HEADERS = isThue ? HEADERS_THUE : HEADERS_BAN;
  const fetchFn = isThue ? fetchQuyCanThue : fetchQuyCanBan;
  const postFn = isThue ? postQuyCanThue : postQuyCanBan;

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes nhFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nhSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nhToastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      .nh-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .nh-table-wrap::-webkit-scrollbar { height: 6px; }
      .nh-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      .nh-row:hover { background: ${C.primaryBg} !important; }
      .nh-tab { cursor: pointer; transition: all 0.15s; border: none; font-family: ${F}; }
      .nh-tab:hover { background: ${C.primaryBg} !important; }
      .nh-btn:active { transform: scale(0.97); }
      @media (max-width: 640px) {
        .nh-modal-content { width: 100% !important; height: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
        .nh-header-row { flex-direction: column !important; gap: 10px !important; align-items: stretch !important; }
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
      const data = await fetchFn();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset search khi chuyển tab
  useEffect(() => {
    setSearch('');
  }, [viewMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchFn().then((data) => {
        setItems(Array.isArray(data) ? data : []);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFn]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((it) =>
        Object.entries(it).some(([k, v]) =>
          k !== '_rowIndex' && (v || '').toString().toLowerCase().includes(q)
        )
      );
    }
    list.sort((a, b) => Number(a.STT || 0) - Number(b.STT || 0));
    return list;
  }, [items, search]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, Ngay_PS: getTodayStr(), Ngay_Cap_Nhat: getTodayStr() });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    if (isThue) {
      setForm({
        Ngay_PS: item.Ngay_PS || '',
        Ngay_Cap_Nhat: item.Ngay_Cap_Nhat || '',
        Nguon: item.Nguon || '',
        Ma_Can: item.Ma_Can || '',
        PN: item.PN || '',
        Dien_Tich: item.Dien_Tich || '',
        BC: item.BC || '',
        Gia: item.Gia || '',
        Phi_MG: item.Phi_MG || '',
        TT: item.TT || '',
        Slot_Xe: item.Slot_Xe || '',
        Thang: item.Thang || '',
        Nam: item.Nam || '',
        Ten_Chu: item.Ten_Chu || '',
        SDT_Chu: item.SDT_Chu || '',
        Pass: item.Pass || '',
        Ghi_Chu: item.Ghi_Chu || '',
        Mau_Ma_Can: item.Mau_Ma_Can || '',
      });
    } else {
      setForm({
        Ngay_PS: item.Ngay_PS || '',
        Ngay_Cap_Nhat: item.Ngay_Cap_Nhat || '',
        Nguon: item.Nguon || '',
        Ma_Can: item.Ma_Can || '',
        PN: item.PN || '',
        Dien_Tich: item.Dien_Tich || '',
        BC: item.BC || '',
        Cua: item.Cua || '',
        Gia: item.Gia || '',
        Phi_MG: item.Phi_MG || '',
        TT: item.TT || '',
        Slot_Xe: item.Slot_Xe || '',
        Ten_Chu: item.Ten_Chu || '',
        SDT_Chu: item.SDT_Chu || '',
        Pass: item.Pass || '',
        Ghi_Chu: item.Ghi_Chu || '',
        Mau_Ma_Can: item.Mau_Ma_Can || '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.Ma_Can.trim()) return showToast('Vui lòng nhập Mã căn', 'error');

    try {
      setSaving(true);
      let payload;
      if (isThue) {
        payload = {
          Ngay_PS: form.Ngay_PS.trim(),
          Ngay_Cap_Nhat: form.Ngay_Cap_Nhat.trim(),
          Nguon: form.Nguon.trim(),
          Ma_Can: form.Ma_Can.trim(),
          PN: form.PN.trim(),
          Dien_Tich: form.Dien_Tich.trim(),
          BC: form.BC.trim(),
          Gia: form.Gia.trim(),
          Phi_MG: form.Phi_MG.trim(),
          TT: form.TT.trim(),
          Slot_Xe: form.Slot_Xe.trim(),
          Thang: form.Thang.trim(),
          Nam: form.Nam.trim(),
          Ten_Chu: form.Ten_Chu.trim(),
          SDT_Chu: form.SDT_Chu.trim(),
          Pass: form.Pass.trim(),
          Ghi_Chu: form.Ghi_Chu.trim(),
          Mau_Ma_Can: form.Mau_Ma_Can || '',
        };
      } else {
        payload = {
          Ngay_PS: form.Ngay_PS.trim(),
          Ngay_Cap_Nhat: form.Ngay_Cap_Nhat.trim(),
          Nguon: form.Nguon.trim(),
          Ma_Can: form.Ma_Can.trim(),
          PN: form.PN.trim(),
          Dien_Tich: form.Dien_Tich.trim(),
          BC: form.BC.trim(),
          Cua: form.Cua.trim(),
          Gia: form.Gia.trim(),
          Phi_MG: form.Phi_MG.trim(),
          TT: form.TT.trim(),
          Slot_Xe: form.Slot_Xe.trim(),
          Ten_Chu: form.Ten_Chu.trim(),
          SDT_Chu: form.SDT_Chu.trim(),
          Pass: form.Pass.trim(),
          Ghi_Chu: form.Ghi_Chu.trim(),
          Mau_Ma_Can: form.Mau_Ma_Can || '',
        };
      }

      if (editItem) {
        await postFn({
          action: 'update',
          _rowIndex: editItem._rowIndex,
          STT: editItem.STT,
          ...payload,
        });
        showToast('Cập nhật thành công!');
      } else {
        const maxSTT = items.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);
        await postFn({
          action: 'add',
          STT: maxSTT + 1,
          ...payload,
        });
        showToast('Thêm căn thành công!');
      }
      closeModal();
      await loadData();
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
      await postFn({
        action: 'delete',
        _rowIndex: deleteTarget._rowIndex,
      });
      showToast('Đã xoá!');
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const switchTab = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    setModalOpen(false);
    setEditItem(null);
    setDeleteTarget(null);
  };

  // ── Render table row cho Thuê ──
  const renderRowThue = (item) => (
    <tr key={item._rowIndex} className="nh-row" style={st.tr}>
      <td style={{ ...st.td, textAlign: 'center', color: C.textDim, fontSize: 12 }}>{item.STT}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_PS}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_Cap_Nhat}</td>
      <td style={{ ...st.td, whiteSpace: 'pre-line' }}>{item.Nguon}</td>
      <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'nowrap', color: item.Mau_Ma_Can || C.text }}>{item.Ma_Can}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.PN}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Dien_Tich}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.BC}</td>
      <td style={{ ...st.td, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.Gia}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.Phi_MG}</td>
      <td style={{ ...st.td, whiteSpace: 'pre-line' }}>{item.TT}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Slot_Xe}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Thang}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Nam}</td>
      <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'pre-line' }}>{item.Ten_Chu}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.SDT_Chu}</td>
      <td style={{ ...st.td, whiteSpace: 'pre-line', fontSize: 12 }}>{item.Pass}</td>
      <td style={{ ...st.td, maxWidth: 180, whiteSpace: 'pre-line', fontSize: 12, color: C.textMuted }}>{item.Ghi_Chu}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap', borderRight: 'none' }}>
        <button onClick={() => openEdit(item)} style={st.actionBtn} title="Sửa">&#9998;</button>
        <button onClick={() => setDeleteTarget(item)} style={{ ...st.actionBtn, color: C.error }} title="Xoá">&#128465;</button>
      </td>
    </tr>
  );

  // ── Render table row cho Bán ──
  const renderRowBan = (item) => (
    <tr key={item._rowIndex} className="nh-row" style={st.tr}>
      <td style={{ ...st.td, textAlign: 'center', color: C.textDim, fontSize: 12 }}>{item.STT}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_PS}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_Cap_Nhat}</td>
      <td style={{ ...st.td, whiteSpace: 'pre-line' }}>{item.Nguon}</td>
      <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'nowrap', color: item.Mau_Ma_Can || C.text }}>{item.Ma_Can}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.PN}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Dien_Tich}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.BC}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Cua}</td>
      <td style={{ ...st.td, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.Gia}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.Phi_MG}</td>
      <td style={{ ...st.td, whiteSpace: 'pre-line' }}>{item.TT}</td>
      <td style={{ ...st.td, textAlign: 'center' }}>{item.Slot_Xe}</td>
      <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'pre-line' }}>{item.Ten_Chu}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.SDT_Chu}</td>
      <td style={{ ...st.td, whiteSpace: 'pre-line', fontSize: 12 }}>{item.Pass}</td>
      <td style={{ ...st.td, maxWidth: 180, whiteSpace: 'pre-line', fontSize: 12, color: C.textMuted }}>{item.Ghi_Chu}</td>
      <td style={{ ...st.td, whiteSpace: 'nowrap', borderRight: 'none' }}>
        <button onClick={() => openEdit(item)} style={st.actionBtn} title="Sửa">&#9998;</button>
        <button onClick={() => setDeleteTarget(item)} style={{ ...st.actionBtn, color: C.error }} title="Xoá">&#128465;</button>
      </td>
    </tr>
  );

  const colSpanCount = TABLE_HEADERS.length;

  // ── Form modal body cho Thuê ──
  const renderFormThue = () => (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Ngày phát sinh" value={form.Ngay_PS} onChange={(v) => updateForm('Ngay_PS', v)} placeholder="VD: 11/03/2026" />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Ngày cập nhật" value={form.Ngay_Cap_Nhat} onChange={(v) => updateForm('Ngay_Cap_Nhat', v)} placeholder="VD: 11/03/2026" />
        </div>
      </div>

      <FormField label="Nguồn" value={form.Nguon} onChange={(v) => updateForm('Nguon', v)} placeholder="VD: Chủ nhà, Sàn, CTV..." />
      <FormField label="Mã căn *" value={form.Ma_Can} onChange={(v) => updateForm('Ma_Can', v)} placeholder="VD: R6-1208, T1-0515..." />

      <ColorPicker value={form.Mau_Ma_Can} onChange={(v) => updateForm('Mau_Ma_Can', v)} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={st.fieldWrap}>
            <label style={st.fieldLabel}>PN</label>
            <select value={form.PN} onChange={(e) => updateForm('PN', e.target.value)} style={st.fieldInput}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={`${n}`}>{n}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Diện tích" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 75, 90..." />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="BC" value={form.BC} onChange={(v) => updateForm('BC', v)} placeholder="VD: ĐN, TB..." />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Giá" value={form.Gia} onChange={(v) => updateForm('Gia', v)} placeholder="VD: 11tr, 2.5 tỷ..." />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Phí MG" value={form.Phi_MG} onChange={(v) => updateForm('Phi_MG', v)} placeholder="VD: 50%, 1 tháng..." />
        </div>
      </div>

      <FormField label="TT (Tình trạng)" value={form.TT} onChange={(v) => updateForm('TT', v)} placeholder="VD: Đang trống, Sắp hết HĐ..." />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Slot xe" value={form.Slot_Xe} onChange={(v) => updateForm('Slot_Xe', v)} placeholder="VD: Có, Không..." />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Tháng" value={form.Thang} onChange={(v) => updateForm('Thang', v)} placeholder="VD: 3, 4..." />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Năm" value={form.Nam} onChange={(v) => updateForm('Nam', v)} placeholder="VD: 2026" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Tên chủ" value={form.Ten_Chu} onChange={(v) => updateForm('Ten_Chu', v)} placeholder="Tên chủ nhà" />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="SĐT chủ" value={form.SDT_Chu} onChange={(v) => updateForm('SDT_Chu', v)} type="tel" placeholder="Số điện thoại chủ" />
        </div>
      </div>

      <FormField label="Pass" value={form.Pass} onChange={(v) => updateForm('Pass', v)} placeholder="VD: Pass căn..." />

      <div style={st.fieldWrap}>
        <label style={st.fieldLabel}>Ghi chú</label>
        <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} placeholder="Ghi chú thêm..." style={{ ...st.fieldInput, height: 64, resize: 'vertical' }} />
      </div>
    </>
  );

  // ── Form modal body cho Bán ──
  const renderFormBan = () => (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Ngày phát sinh" value={form.Ngay_PS} onChange={(v) => updateForm('Ngay_PS', v)} placeholder="VD: 11/03/2026" />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Ngày cập nhật" value={form.Ngay_Cap_Nhat} onChange={(v) => updateForm('Ngay_Cap_Nhat', v)} placeholder="VD: 11/03/2026" />
        </div>
      </div>

      <FormField label="Nguồn" value={form.Nguon} onChange={(v) => updateForm('Nguon', v)} placeholder="VD: Chủ nhà, Sàn, CTV..." />
      <FormField label="Mã căn *" value={form.Ma_Can} onChange={(v) => updateForm('Ma_Can', v)} placeholder="VD: R6-1208, T1-0515..." />

      <ColorPicker value={form.Mau_Ma_Can} onChange={(v) => updateForm('Mau_Ma_Can', v)} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={st.fieldWrap}>
            <label style={st.fieldLabel}>PN</label>
            <select value={form.PN} onChange={(e) => updateForm('PN', e.target.value)} style={st.fieldInput}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={`${n}`}>{n}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Diện tích" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 75, 90..." />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="BC" value={form.BC} onChange={(v) => updateForm('BC', v)} placeholder="VD: ĐN, TB..." />
        </div>
      </div>

      <FormField label="Cửa (hướng cửa)" value={form.Cua} onChange={(v) => updateForm('Cua', v)} placeholder="VD: ĐN, TB, TN..." />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Giá" value={form.Gia} onChange={(v) => updateForm('Gia', v)} placeholder="VD: 2.5 tỷ, 4.8 tỷ..." />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Phí MG" value={form.Phi_MG} onChange={(v) => updateForm('Phi_MG', v)} placeholder="VD: 1%, 50tr..." />
        </div>
      </div>

      <FormField label="TT (Tình trạng)" value={form.TT} onChange={(v) => updateForm('TT', v)} placeholder="VD: Đang bán, Đã cọc..." />

      <FormField label="Slot xe" value={form.Slot_Xe} onChange={(v) => updateForm('Slot_Xe', v)} placeholder="VD: Có, Không..." />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Tên chủ" value={form.Ten_Chu} onChange={(v) => updateForm('Ten_Chu', v)} placeholder="Tên chủ nhà" />
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="SĐT chủ" value={form.SDT_Chu} onChange={(v) => updateForm('SDT_Chu', v)} type="tel" placeholder="Số điện thoại chủ" />
        </div>
      </div>

      <FormField label="Pass" value={form.Pass} onChange={(v) => updateForm('Pass', v)} placeholder="VD: Pass căn..." />

      <div style={st.fieldWrap}>
        <label style={st.fieldLabel}>Ghi chú</label>
        <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} placeholder="Ghi chú thêm..." style={{ ...st.fieldInput, height: 64, resize: 'vertical' }} />
      </div>
    </>
  );

  return (
    <div style={showHeader ? st.root : { fontFamily: F, color: C.text }}>
      {showHeader && (
        <div style={st.header}>
          <div style={st.headerInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate('/')} style={st.backBtn} className="nh-tab">&larr;</button>
              <div>
                <div style={st.headerTitle}>Nguồn Hàng Times City</div>
                <div style={st.headerSub}>Quỹ căn bất động sản</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={showHeader ? st.container : { padding: '0' }}>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="nh-tab"
            onClick={() => switchTab('thue')}
            style={{ ...st.viewToggle, ...(isThue ? st.viewToggleActive : {}) }}
          >
            Quỹ Căn Thuê
          </button>
          <button
            className="nh-tab"
            onClick={() => switchTab('ban')}
            style={{ ...st.viewToggle, ...(!isThue ? st.viewToggleActive : {}) }}
          >
            Quỹ Căn Bán
          </button>
        </div>

        <>
          {/* Title row */}
          <div className="nh-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={openAdd} style={st.addBtn} className="nh-btn">+ Thêm căn</button>
              <button onClick={loadData} disabled={loading} style={st.reloadBtn} className="nh-btn" title="Tải lại">
                {loading ? '...' : '↻'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{filtered.length} / {items.length} căn</div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 }}>&#128269;</span>
            <input
              type="text"
              placeholder="Tìm theo mã căn, nguồn, tên chủ, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={st.searchInput}
            />
            {search && <button onClick={() => setSearch('')} style={st.clearBtn}>&times;</button>}
          </div>

          {error && <div style={st.errorBox}>{error}</div>}
          {loading && <div style={st.loadingBox}>Đang tải dữ liệu...</div>}

          {/* Table */}
          {!loading && !error && (
            <div className="nh-table-wrap" style={st.tableWrap}>
              <table style={st.table}>
                <thead>
                  <tr>
                    {TABLE_HEADERS.map((h, idx) => (
                      <th key={h || `act_${idx}`} style={st.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={colSpanCount} style={st.emptyTd}>{items.length === 0 ? 'Chưa có dữ liệu. Bấm "+ Thêm căn" để bắt đầu.' : 'Không tìm thấy kết quả'}</td></tr>
                  ) : (
                    filtered.map((item) => isThue ? renderRowThue(item) : renderRowBan(item))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      </div>

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div style={st.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="nh-modal-content" style={st.modal}>
            <div style={st.modalHeader}>
              <div style={st.modalTitle}>{editItem ? 'Sửa căn' : 'Thêm căn mới'}{!isThue ? ' (Bán)' : ''}</div>
              <button onClick={closeModal} style={st.modalClose}>&times;</button>
            </div>
            <div style={st.modalBody}>
              {isThue ? renderFormThue() : renderFormBan()}
            </div>
            <div style={st.modalFooter}>
              <button onClick={closeModal} style={st.cancelBtn} className="nh-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving} style={st.saveBtn} className="nh-btn">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={st.overlay} onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={st.confirmBox}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: C.text }}>Xác nhận xoá</div>
            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
              Xoá căn <strong>{deleteTarget.Ma_Can}</strong>? Hành động này không thể hoàn tác.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={st.cancelBtn} className="nh-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...st.saveBtn, background: C.error }} className="nh-btn">{saving ? 'Đang xoá...' : 'Xoá'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...st.toast, background: toast.type === 'error' ? C.error : C.primary, animation: 'nhToastIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──
function FormField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={st.fieldWrap}>
      <label style={st.fieldLabel}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={st.fieldInput} />
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={st.fieldWrap}>
      <label style={st.fieldLabel}>Màu mã căn</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {RAINBOW_COLORS.map((c) => (
          <button
            key={c.value || 'default'}
            type="button"
            onClick={() => onChange(c.value)}
            title={c.label}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: c.value || '#222',
              border: value === c.value ? '3px solid #222' : '2px solid #ddd',
              cursor: 'pointer',
              boxShadow: value === c.value ? '0 0 0 2px #fff, 0 0 0 4px ' + (c.value || '#222') : 'none',
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Styles ──
const colDivider = '1.5px solid #D0D0D0';

const st = {
  root: { fontFamily: F, background: C.bg, minHeight: '100vh', color: C.text },
  header: { background: '#fff', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: C.shadow },
  headerInner: { maxWidth: 1400, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  backBtn: { background: C.primaryBg, borderRadius: 8, width: 36, height: 36, fontSize: 18, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  viewToggle: { padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: '#fff', color: C.textMuted, border: `1.5px solid ${C.border}`, cursor: 'pointer' },
  viewToggleActive: { background: C.primary, color: '#fff', border: '1.5px solid transparent', boxShadow: C.shadowGreen },
  container: { maxWidth: 1500, margin: '0 auto', padding: '16px 16px' },
  addBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  reloadBtn: { background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, width: 40, height: 40, fontSize: 20, color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: F },
  searchInput: { width: '100%', padding: '10px 36px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: F, outline: 'none', background: '#fff', boxSizing: 'border-box' },
  clearBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, color: C.textMuted, cursor: 'pointer', padding: '0 4px' },
  errorBox: { background: '#FEF2F2', color: C.error, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  loadingBox: { textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 },
  tableWrap: { background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow, animation: 'nhFadeIn 0.3s ease' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 8px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: C.textMuted, borderBottom: `2px solid ${C.border}`, borderRight: colDivider, whiteSpace: 'nowrap', background: '#FAFAFA' },
  tr: { borderBottom: `1.5px solid #D0D0D0`, transition: 'background 0.12s' },
  td: { padding: '8px 8px', verticalAlign: 'middle', fontSize: 13, borderRight: colDivider },
  emptyTd: { textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6, transition: 'background 0.12s', color: C.textMuted },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#fff', borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'nhSlideUp 0.25s ease', overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` },
  modalTitle: { fontSize: 17, fontWeight: 700, color: C.text },
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: C.textMuted, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  modalBody: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: `1px solid ${C.border}` },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 },
  fieldInput: { width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: F, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', background: C.bgInput },
  cancelBtn: { background: 'none', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, color: C.textMuted, transition: 'all 0.15s' },
  saveBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s' },
  confirmBox: { background: '#fff', borderRadius: 16, padding: '24px', width: 380, maxWidth: '100%', boxShadow: C.shadowLg, animation: 'nhSlideUp 0.2s ease' },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, boxShadow: C.shadowMd, zIndex: 2000 },
};
