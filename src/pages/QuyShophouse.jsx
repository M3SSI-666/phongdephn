import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { C } from '../utils/theme';
import { fetchQuyShophouse, postQuyShophouse } from '../utils/api';

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

const EMPTY_FORM = {
  Ngay_PS: '', Ngay_Cap_Nhat: '', Nguon: '', Ma_Can: '', Vi_Tri: '',
  Dien_Tich: '', Mat_Tien: '', Tang: '', Gia: '', Phi_MG: '',
  TT: '', Slot_Xe: '', Ten_Chu: '', SDT_Chu: '', Pass: '',
  Ghi_Chu: '', Mau_Ma_Can: '',
};

const TABLE_HEADERS = [
  'STT', 'Ngày PS', 'Ngày CN', 'Nguồn', 'Mã căn', 'Vị trí', 'DT', 'Mặt tiền',
  'Tầng', 'Giá', 'Phí MG', 'TT', 'Slot xe', 'Tên chủ', 'SĐT', 'Pass', 'Ghi chú', '',
];

export function QuyShophouseContent() {
  return <QuyShophouseInner />;
}

export default function QuyShophouse() {
  return <QuyShophouseInner />;
}

function QuyShophouseInner() {
  const { user } = useUser();
  const userId = user?.id;
  const role   = user?.publicMetadata?.role || 'staff';
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [toast, setToast]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes shToastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      .sh-row:hover { background: rgba(255,255,255,0.06) !important; }
      .sh-btn:active { transform: scale(0.97); }
      .sh-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .sh-table-wrap::-webkit-scrollbar { height: 6px; }
      .sh-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      @media (max-width: 640px) {
        .sh-modal-content { width: 100% !important; height: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
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
      const data = await fetchQuyShophouse(userId, role);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId, role]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchQuyShophouse(userId, role).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(it =>
        Object.entries(it).some(([k, v]) => k !== '_rowIndex' && (v || '').toString().toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => Number(a.STT || 0) - Number(b.STT || 0));
  }, [items, search]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, Ngay_PS: getTodayStr(), Ngay_Cap_Nhat: getTodayStr() });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      Ngay_PS: item.Ngay_PS || '', Ngay_Cap_Nhat: item.Ngay_Cap_Nhat || '',
      Nguon: item.Nguon || '', Ma_Can: item.Ma_Can || '', Vi_Tri: item.Vi_Tri || '',
      Dien_Tich: item.Dien_Tich || '', Mat_Tien: item.Mat_Tien || '', Tang: item.Tang || '',
      Gia: item.Gia || '', Phi_MG: item.Phi_MG || '', TT: item.TT || '',
      Slot_Xe: item.Slot_Xe || '', Ten_Chu: item.Ten_Chu || '', SDT_Chu: item.SDT_Chu || '',
      Pass: item.Pass || '', Ghi_Chu: item.Ghi_Chu || '', Mau_Ma_Can: item.Mau_Ma_Can || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditItem(null); };
  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.Ma_Can.trim()) return showToast('Vui lòng nhập Mã căn', 'error');
    try {
      setSaving(true);
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
      payload.Owner_Id = userId || '';
      if (editItem) {
        await postQuyShophouse({ action: 'update', _rowIndex: editItem._rowIndex, STT: editItem.STT, Owner_Id: editItem.Owner_Id || userId || '', ...payload });
        showToast('Cập nhật thành công!');
      } else {
        const maxSTT = items.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);
        await postQuyShophouse({ action: 'add', STT: maxSTT + 1, ...payload });
        showToast('Thêm Shophouse thành công!');
      }
      closeModal();
      await loadData();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await postQuyShophouse({ action: 'delete', _rowIndex: deleteTarget._rowIndex });
      showToast('Đã xoá!');
      setDeleteTarget(null);
      await loadData();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ fontFamily: F, color: C.text }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={openAdd} style={st.addBtn} className="sh-btn">+ Thêm Shophouse</button>
          <button onClick={loadData} disabled={loading} style={st.reloadBtn} className="sh-btn" title="Tải lại">
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
          placeholder="Tìm theo mã căn, vị trí, tên chủ, SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={st.searchInput}
        />
        {search && <button onClick={() => setSearch('')} style={st.clearBtn}>&times;</button>}
      </div>

      {error && <div style={st.errorBox}>{error}</div>}
      {loading && <div style={st.loadingBox}>Đang tải dữ liệu...</div>}

      {!loading && !error && (
        <div className="sh-table-wrap" style={st.tableWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                {TABLE_HEADERS.map((h, i) => <th key={h || `act_${i}`} style={st.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={TABLE_HEADERS.length} style={st.emptyTd}>
                  {items.length === 0 ? 'Chưa có dữ liệu. Bấm "+ Thêm Shophouse" để bắt đầu.' : 'Không tìm thấy kết quả'}
                </td></tr>
              ) : filtered.map((item) => (
                <tr key={item._rowIndex} className="sh-row" style={st.tr}>
                  <td style={{ ...st.td, textAlign: 'center', color: C.textDim, fontSize: 12 }}>{item.STT}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_PS}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_Cap_Nhat}</td>
                  <td style={{ ...st.td }}>{item.Nguon}</td>
                  <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'nowrap', color: item.Mau_Ma_Can || C.text }}>{item.Ma_Can}</td>
                  <td style={{ ...st.td }}>{item.Vi_Tri}</td>
                  <td style={{ ...st.td, textAlign: 'center' }}>{item.Dien_Tich}</td>
                  <td style={{ ...st.td, textAlign: 'center' }}>{item.Mat_Tien}</td>
                  <td style={{ ...st.td, textAlign: 'center' }}>{item.Tang}</td>
                  <td style={{ ...st.td, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.Gia}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.Phi_MG}</td>
                  <td style={{ ...st.td, whiteSpace: 'pre-line' }}>{item.TT}</td>
                  <td style={{ ...st.td, textAlign: 'center' }}>{item.Slot_Xe}</td>
                  <td style={{ ...st.td, fontWeight: 600 }}>{item.Ten_Chu}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.SDT_Chu}</td>
                  <td style={{ ...st.td, fontSize: 12 }}>{item.Pass}</td>
                  <td style={{ ...st.td, maxWidth: 180, fontSize: 12, color: C.textMuted, whiteSpace: 'pre-line' }}>{item.Ghi_Chu}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap', borderRight: 'none' }}>
                    <button onClick={() => openEdit(item)} style={st.actionBtn} title="Sửa">&#9998;</button>
                    <button onClick={() => setDeleteTarget(item)} style={{ ...st.actionBtn, color: C.error }} title="Xoá">&#128465;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div style={st.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="sh-modal-content" style={st.modal}>
            <div style={st.modalHeader}>
              <div style={st.modalTitle}>{editItem ? 'Sửa Shophouse' : 'Thêm Shophouse mới'}</div>
              <button onClick={closeModal} style={st.modalClose}>&times;</button>
            </div>
            <div style={st.modalBody}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Ngày phát sinh" value={form.Ngay_PS} onChange={(v) => updateForm('Ngay_PS', v)} placeholder="VD: 11/03/2026" />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Ngày cập nhật" value={form.Ngay_Cap_Nhat} onChange={(v) => updateForm('Ngay_Cap_Nhat', v)} placeholder="VD: 11/03/2026" />
                </div>
              </div>

              <FormField label="Nguồn" value={form.Nguon} onChange={(v) => updateForm('Nguon', v)} placeholder="VD: Chủ nhà, Sàn, CTV..." />
              <FormField label="Mã căn *" value={form.Ma_Can} onChange={(v) => updateForm('Ma_Can', v)} placeholder="VD: SH-T1-01, LK-01..." />

              <ColorPicker value={form.Mau_Ma_Can} onChange={(v) => updateForm('Mau_Ma_Can', v)} />

              <FormField label="Vị trí / Khu vực" value={form.Vi_Tri} onChange={(v) => updateForm('Vi_Tri', v)} placeholder="VD: Mặt đường Minh Khai, Khu TM..." />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Diện tích (m²)" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 80, 120..." />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Mặt tiền (m)" value={form.Mat_Tien} onChange={(v) => updateForm('Mat_Tien', v)} placeholder="VD: 5m, 8m..." />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Tầng" value={form.Tang} onChange={(v) => updateForm('Tang', v)} placeholder="VD: 1, 2, Hầm+1..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Giá" value={form.Gia} onChange={(v) => updateForm('Gia', v)} placeholder="VD: 15tr/tháng, 8 tỷ..." />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Phí MG" value={form.Phi_MG} onChange={(v) => updateForm('Phi_MG', v)} placeholder="VD: 1 tháng, 1%..." />
                </div>
              </div>

              <FormField label="TT (Tình trạng)" value={form.TT} onChange={(v) => updateForm('TT', v)} placeholder="VD: Còn, Đã thuê, Đã bán..." />
              <FormField label="Slot xe" value={form.Slot_Xe} onChange={(v) => updateForm('Slot_Xe', v)} placeholder="VD: Có, Không..." />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Tên chủ" value={form.Ten_Chu} onChange={(v) => updateForm('Ten_Chu', v)} placeholder="Tên chủ nhà" />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="SĐT chủ" value={form.SDT_Chu} onChange={(v) => updateForm('SDT_Chu', v)} type="tel" placeholder="Số điện thoại" />
                </div>
              </div>

              <FormField label="Pass / Giá NET" value={form.Pass} onChange={(v) => updateForm('Pass', v)} placeholder="VD: Pass căn..." />

              <div style={st.fieldWrap}>
                <label style={st.fieldLabel}>Ghi chú</label>
                <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} placeholder="Ghi chú thêm..." style={{ ...st.fieldInput, height: 64, resize: 'vertical' }} />
              </div>
            </div>

            <div style={st.modalFooter}>
              <button onClick={closeModal} style={st.cancelBtn} className="sh-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving} style={st.saveBtn} className="sh-btn">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
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
              Xoá Shophouse <strong>{deleteTarget.Ma_Can}</strong>? Hành động này không thể hoàn tác.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={st.cancelBtn} className="sh-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...st.saveBtn, background: C.error }} className="sh-btn">
                {saving ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...st.toast, background: toast.type === 'error' ? C.error : C.primary, animation: 'shToastIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

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
          <button key={c.value || 'default'} type="button" onClick={() => onChange(c.value)} title={c.label}
            style={{
              width: 32, height: 32, borderRadius: 8, background: c.value || '#222',
              border: value === c.value ? '3px solid #222' : '2px solid #ddd', cursor: 'pointer',
              boxShadow: value === c.value ? '0 0 0 2px #fff, 0 0 0 4px ' + (c.value || '#222') : 'none',
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

const colDivider = '1.5px solid #2d3240';

const st = {
  addBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  reloadBtn: { background: '#22263a', border: '1.5px solid #3a3f52', borderRadius: 10, width: 40, height: 40, fontSize: 20, color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: F },
  searchInput: { width: '100%', padding: '10px 36px', border: '1.5px solid #3a3f52', borderRadius: 10, fontSize: 13, fontFamily: F, outline: 'none', background: '#1e2130', color: '#e2e8f0', boxSizing: 'border-box' },
  clearBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, color: '#8a9bb8', cursor: 'pointer', padding: '0 4px' },
  errorBox: { background: '#2d1515', color: '#fc8181', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  loadingBox: { textAlign: 'center', padding: 40, color: '#8a9bb8', fontSize: 14 },
  tableWrap: { background: '#1a1d27', borderRadius: 12, border: '1px solid #2d3240', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'center', padding: '10px 8px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#8a9bb8', borderBottom: '2px solid #2d3240', borderRight: colDivider, whiteSpace: 'nowrap', background: '#13151e' },
  tr: { borderBottom: '1.5px solid #2d3240', transition: 'background 0.12s' },
  td: { padding: '8px 8px', verticalAlign: 'middle', fontSize: 13, borderRight: colDivider, color: '#e2e8f0' },
  emptyTd: { textAlign: 'center', padding: 40, color: '#8a9bb8', fontSize: 14 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6, color: '#8a9bb8' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#1a1d27', borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'shSlideUp 0.25s ease', overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2d3240' },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#e2e8f0' },
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: '#8a9bb8', cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  modalBody: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #2d3240' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#8a9bb8', marginBottom: 4 },
  fieldInput: { width: '100%', padding: '9px 12px', border: '1.5px solid #3a3f52', borderRadius: 8, fontSize: 14, fontFamily: F, outline: 'none', boxSizing: 'border-box', background: '#22263a', color: '#e2e8f0' },
  cancelBtn: { background: 'none', border: '1.5px solid #3a3f52', borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, color: '#8a9bb8' },
  saveBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen },
  confirmBox: { background: '#1a1d27', borderRadius: 16, padding: '24px', width: 380, maxWidth: '100%', boxShadow: C.shadowLg, animation: 'shSlideUp 0.2s ease' },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, boxShadow: C.shadowMd, zIndex: 2000 },
};
