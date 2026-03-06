import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { C } from '../utils/theme';
import { fetchNguonHangCustom, postNguonHangCustom } from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const EMPTY_FORM = {
  Loai: 'Thuê', Phong_Ngu: '', Dien_Tich: '', Huong_BC: '',
  Slot_Xe: '', Do: '', Chu_Nha: '', SDT: '', Ghi_Chu: '', Gia: '',
};

export default function NguonHangCustomPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes nhcFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nhcSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nhcToastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      .nhc-row:hover { background: ${C.primaryBg} !important; }
      .nhc-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .nhc-table-wrap::-webkit-scrollbar { height: 6px; }
      .nhc-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      .nhc-btn:active { transform: scale(0.97); }
      @media (max-width: 640px) {
        .nhc-modal-content { width: 100% !important; height: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
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
      const data = await fetchNguonHangCustom();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((it) =>
        Object.values(it).some((v) =>
          typeof v === 'string' && v.toLowerCase().includes(q)
        )
      );
    }
    list.sort((a, b) => Number(a.STT || 0) - Number(b.STT || 0));
    return list;
  }, [items, search]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      Loai: item.Loai || 'Thuê',
      Phong_Ngu: item.Phong_Ngu || '',
      Dien_Tich: item.Dien_Tich || '',
      Huong_BC: item.Huong_BC || '',
      Slot_Xe: item.Slot_Xe || '',
      Do: item.Do || '',
      Chu_Nha: item.Chu_Nha || '',
      SDT: item.SDT || '',
      Ghi_Chu: item.Ghi_Chu || '',
      Gia: item.Gia || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.Gia.trim()) return showToast('Vui lòng nhập giá', 'error');

    try {
      setSaving(true);
      const payload = {
        Loai: form.Loai,
        Phong_Ngu: form.Phong_Ngu,
        Dien_Tich: form.Dien_Tich.trim(),
        Huong_BC: form.Huong_BC.trim(),
        Slot_Xe: form.Slot_Xe,
        Do: form.Do.trim(),
        Chu_Nha: form.Chu_Nha.trim(),
        SDT: form.SDT.trim(),
        Ghi_Chu: form.Ghi_Chu.trim(),
        Gia: form.Gia.trim(),
      };

      if (editItem) {
        await postNguonHangCustom({
          action: 'update',
          _rowIndex: editItem._rowIndex,
          STT: editItem.STT,
          ...payload,
        });
        showToast('Cập nhật thành công!');
      } else {
        const maxSTT = items.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);
        await postNguonHangCustom({
          action: 'add',
          STT: maxSTT + 1,
          ...payload,
        });
        showToast('Thêm phòng thành công!');
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
      await postNguonHangCustom({
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

  const TABLE_HEADERS = ['STT', 'Loại', 'PN', 'Diện tích', 'Hướng BC', 'Slot xe', 'Đồ', 'Chủ nhà', 'SĐT', 'Ghi chú', 'Giá', ''];

  return (
    <div style={{ fontFamily: F, color: C.text }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={openAdd} style={s.addBtn} className="nhc-btn">
            + Thêm phòng
          </button>
          <button onClick={loadData} disabled={loading} style={s.reloadBtn} className="nhc-btn" title="Tải lại">
            {loading ? '...' : '↻'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted }}>{filtered.length} / {items.length} phòng</div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 }}>&#128269;</span>
        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={s.searchInput}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, color: C.textMuted, cursor: 'pointer' }}>&times;</button>
        )}
      </div>

      {error && <div style={{ background: '#FEF2F2', color: C.error, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 }}>Đang tải dữ liệu...</div>}

      {/* Table */}
      {!loading && !error && (
        <div className="nhc-table-wrap" style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {TABLE_HEADERS.map((h, idx) => (
                  <th key={h || `act_${idx}`} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 }}>
                    {items.length === 0 ? 'Chưa có phòng nào. Bấm "+ Thêm phòng" để bắt đầu.' : 'Không tìm thấy kết quả'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item._rowIndex} className="nhc-row" style={s.tr}>
                    <td style={s.td}>{item.STT}</td>
                    <td style={s.td}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: (item.Loai || '').toLowerCase().includes('thu') ? C.primary + '18' : C.accent + '18',
                        color: (item.Loai || '').toLowerCase().includes('thu') ? C.primaryDark : C.accent,
                      }}>
                        {item.Loai}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{item.Phong_Ngu}</td>
                    <td style={s.td}>{item.Dien_Tich}</td>
                    <td style={s.td}>{item.Huong_BC}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{item.Slot_Xe}</td>
                    <td style={s.td}>{item.Do}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{item.Chu_Nha}</td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{item.SDT}</td>
                    <td style={{ ...s.td, maxWidth: 160, whiteSpace: 'pre-line', fontSize: 12, color: C.textMuted }}>{item.Ghi_Chu}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.Gia}</td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(item)} style={s.actionBtn} title="Sửa">&#9998;</button>
                      <button onClick={() => setDeleteTarget(item)} style={{ ...s.actionBtn, color: C.error }} title="Xoá">&#128465;</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="nhc-modal-content" style={s.modal}>
            <div style={s.modalHeader}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{editItem ? 'Sửa phòng' : 'Thêm phòng mới'}</div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 22, color: C.textMuted, cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Loại *</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {['Thuê', 'Bán'].map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                      <input type="radio" name="loai" checked={form.Loai === val} onChange={() => updateForm('Loai', val)} style={{ accentColor: C.primary }} />
                      {val}
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Số phòng ngủ</label>
                <select value={form.Phong_Ngu} onChange={(e) => updateForm('Phong_Ngu', e.target.value)} style={s.fieldInput}>
                  <option value="">-- Chọn --</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={`${n}`}>{n}</option>
                  ))}
                </select>
              </div>

              <FormField label="Diện tích" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 75m2, 90m2..." />
              <FormField label="Hướng ban công" value={form.Huong_BC} onChange={(v) => updateForm('Huong_BC', v)} placeholder="VD: Đông Nam, Tây Bắc..." />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Slot xe</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {['Có', 'Không'].map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                      <input type="radio" name="slot_xe_custom" checked={form.Slot_Xe === val} onChange={() => updateForm('Slot_Xe', val)} style={{ accentColor: C.primary }} />
                      {val}
                    </label>
                  ))}
                </div>
              </div>

              <FormField label="Đồ" value={form.Do} onChange={(v) => updateForm('Do', v)} placeholder="VD: Full nội thất, cơ bản..." />
              <FormField label="Chủ nhà" value={form.Chu_Nha} onChange={(v) => updateForm('Chu_Nha', v)} placeholder="Tên chủ nhà" />
              <FormField label="Số điện thoại" value={form.SDT} onChange={(v) => updateForm('SDT', v)} type="tel" />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Ghi chú</label>
                <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
              </div>

              <FormField label="Giá *" value={form.Gia} onChange={(v) => updateForm('Gia', v)} placeholder="VD: 11tr, 2.5 tỷ..." />
            </div>
            <div style={s.modalFooter}>
              <button onClick={closeModal} style={s.cancelBtn} className="nhc-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving} style={s.saveBtn} className="nhc-btn">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={s.confirmBox}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: C.text }}>Xác nhận xoá</div>
            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
              Xoá phòng <strong>#{deleteTarget.STT}</strong>? Hành động này không thể hoàn tác.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={s.cancelBtn} className="nhc-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...s.saveBtn, background: C.error }} className="nhc-btn">
                {saving ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10,
          color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, boxShadow: C.shadowMd, zIndex: 2000,
          background: toast.type === 'error' ? C.error : C.primary,
          animation: 'nhcToastIn 0.3s ease',
        }}>
          {toast.msg}
        </div>
      )}
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

const s = {
  addBtn: {
    background: C.gradient, color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s', whiteSpace: 'nowrap',
  },
  reloadBtn: {
    background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10,
    width: 40, height: 40, fontSize: 20, color: C.primary, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: F,
  },
  searchInput: {
    width: '100%', padding: '10px 36px', border: `1.5px solid ${C.border}`, borderRadius: 10,
    fontSize: 13, fontFamily: F, outline: 'none', background: '#fff', boxSizing: 'border-box',
  },
  tableWrap: {
    background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`,
    boxShadow: C.shadow, animation: 'nhcFadeIn 0.3s ease',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 10px', fontWeight: 700, fontSize: 11,
    textTransform: 'uppercase', color: C.textMuted, borderBottom: `2px solid ${C.border}`,
    whiteSpace: 'nowrap', background: '#fff',
  },
  tr: { borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.12s' },
  td: { padding: '10px 10px', verticalAlign: 'middle', fontSize: 13 },
  actionBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
    padding: '4px 6px', borderRadius: 6, color: C.textMuted,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: 520, maxWidth: '100%', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg,
    animation: 'nhcSlideUp 0.25s ease', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
  },
  modalBody: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
  modalFooter: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    padding: '12px 20px', borderTop: `1px solid ${C.border}`,
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 },
  fieldInput: {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8,
    fontSize: 14, fontFamily: F, outline: 'none', boxSizing: 'border-box', background: C.bgInput,
  },
  cancelBtn: {
    background: 'none', border: `1.5px solid ${C.border}`, borderRadius: 10,
    padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, color: C.textMuted,
  },
  saveBtn: {
    background: C.gradient, color: '#fff', border: 'none', borderRadius: 10,
    padding: '9px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen,
  },
  confirmBox: {
    background: '#fff', borderRadius: 16, padding: '24px', width: 380, maxWidth: '100%',
    boxShadow: C.shadowLg, animation: 'nhcSlideUp 0.2s ease',
  },
};
