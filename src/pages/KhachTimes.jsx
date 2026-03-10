import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { fetchKhachTimes, postKhachTimes } from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const TRANG_THAI_OPTIONS = [
  { value: '', label: '--', bg: 'transparent', text: '#999' },
  { value: 'Ít tiềm năng', label: 'Ít tiềm năng', bg: '#FFF3CD', text: '#856404' },
  { value: 'Tiềm năng', label: 'Tiềm năng', bg: '#D4EDDA', text: '#4B7A2E' },
  { value: 'Làm việc sâu', label: 'Làm việc sâu', bg: '#32CD32', text: '#fff' },
  { value: 'Miss', label: 'Miss', bg: '#F8D7DA', text: '#721C24' },
  { value: 'Done', label: 'Done', bg: '#CCE5FF', text: '#004085' },
];

const NHU_CAU_OPTIONS = ['Thuê', 'Mua', 'Homestay'];
const SLOT_XE_OPTIONS = ['Có', 'Không', 'Null'];

function getTodayStr() {
  const d = new Date();
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const EMPTY_FORM = {
  Ngay_PS: '', Ten_Zalo: '', SDT: '',
  Nhu_Cau: 'Thuê', Phong_Ngu: '', Noi_That: '', Slot_Xe: '',
  Thoi_Han_Thue: '', Ngay_Vao: '', Dien_Tich: '', Tai_Chinh: '',
  Toa: '', Can_Tu_Van: '', Trang_Thai: '', Ghi_Chu: '',
};

export function KhachTimesContent() {
  return <KhachTimesInner showHeader={false} />;
}

export default function KhachTimes() {
  return <KhachTimesInner showHeader={true} />;
}

function KhachTimesInner({ showHeader }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterLoai, setFilterLoai] = useState('all');
  const [filterTrangThai, setFilterTrangThai] = useState('all');

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
      .kt-row:hover { background: ${C.primaryBg} !important; }
      .kt-btn:active { transform: scale(0.97); }
      .kt-inline-select { border: none; background: transparent; font-family: ${F}; font-size: 12px; font-weight: 600; cursor: pointer; outline: none; padding: 3px 2px; border-radius: 6px; width: 100%; }
      .kt-inline-select:hover { background: ${C.primaryBg}; }
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
      const data = await fetchKhachTimes();
      const arr = Array.isArray(data) ? data : [];
      setItems(arr);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchKhachTimes().then((data) => {
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
        Ghi_Chu: item.Ghi_Chu || '',
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

  const filtered = useMemo(() => {
    let list = [...items];
    if (filterLoai !== 'all') {
      list = list.filter((it) => {
        const nc = (it.Nhu_Cau || '').toLowerCase();
        const fv = filterLoai.toLowerCase();
        if (fv === 'homestay') return nc === 'homestay';
        if (fv === 'thuê' || fv === 'thue') return nc.includes('thu');
        if (fv === 'mua') return nc === 'mua';
        return true;
      });
    }
    if (filterTrangThai !== 'all') {
      list = list.filter((it) => (it.Trang_Thai || '') === filterTrangThai);
    }
    if (search.trim()) {
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
    list.sort((a, b) => Number(a.STT || 0) - Number(b.STT || 0));
    return list;
  }, [items, filterLoai, filterTrangThai, search]);

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
    setForm({ ...EMPTY_FORM, Ngay_PS: getTodayStr() });
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
      Dien_Tich: item.Dien_Tich || '',
      Tai_Chinh: item.Tai_Chinh || '',
      Toa: item.Toa || '',
      Can_Tu_Van: item.Can_Tu_Van || '',
      Trang_Thai: item.Trang_Thai || '',
      Ghi_Chu: item.Ghi_Chu || '',
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
        Dien_Tich: form.Dien_Tich.trim(),
        Tai_Chinh: form.Tai_Chinh.trim(),
        Toa: form.Toa.trim(),
        Can_Tu_Van: form.Can_Tu_Van.trim(),
        Trang_Thai: form.Trang_Thai,
        Ghi_Chu: form.Ghi_Chu.trim(),
      };

      if (editItem) {
        await postKhachTimes({
          action: 'update',
          _rowIndex: editItem._rowIndex,
          STT: editItem.STT,
          ...payload,
        });
        showToast('Cập nhật thành công!');
      } else {
        const maxSTT = items.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);
        await postKhachTimes({
          action: 'add',
          STT: maxSTT + 1,
          ...payload,
        });
        showToast('Thêm khách thành công!');
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

        {/* Search + Filter */}
        <div className="kt-filter-row" style={s.filterRow}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>&#128269;</span>
            <input type="text" placeholder="Tìm theo tên, SĐT, toà, căn tư vấn..." value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} />
            {search && <button onClick={() => setSearch('')} style={s.clearBtn}>&times;</button>}
          </div>
          <select value={filterLoai} onChange={(e) => setFilterLoai(e.target.value)} style={s.filterSelect}>
            <option value="all">Nhu cầu</option>
            <option value="Thuê">Thuê</option>
            <option value="Mua">Mua</option>
            <option value="Homestay">Homestay</option>
          </select>
          <select value={filterTrangThai} onChange={(e) => setFilterTrangThai(e.target.value)} style={s.filterSelect}>
            <option value="all">Trạng thái</option>
            {TRANG_THAI_OPTIONS.filter(o => o.value).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={s.resultCount}>{filtered.length} / {items.length} khách</div>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}
        {loading && <div style={s.loadingBox}>Đang tải dữ liệu...</div>}

        {/* Table */}
        {!loading && !error && (
          <div className="kt-table-wrap" style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['STT', 'Ngày PS', 'Tên (Zalo)', 'SĐT', 'Nhu cầu', 'PN', 'Nội thất', 'Slot xe', 'Thời hạn thuê', 'Ngày vào', 'DT', 'Tài chính', 'Tòa', 'Căn tư vấn', 'Trạng thái', 'Ghi chú', ''].map((h, idx) => (
                    <th key={h || `act_${idx}`} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={17} style={s.emptyTd}>{items.length === 0 ? 'Chưa có khách hàng nào' : 'Không tìm thấy kết quả'}</td></tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item._rowIndex} className="kt-row" style={s.tr}>
                      <td style={{ ...s.td, textAlign: 'center', color: C.textDim, fontSize: 12 }}>{item.STT}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_PS}</td>
                      <td style={{ ...s.td, ...s.tdName, fontWeight: 600 }}>{item.Ten_Zalo}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{item.SDT}</td>
                      <td style={s.td}>
                        <span style={getNhuCauBadgeStyle(item.Nhu_Cau)}>{item.Nhu_Cau || '-'}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{item.Phong_Ngu}</td>
                      <td style={s.td}>{item.Noi_That}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{item.Slot_Xe || '-'}</td>
                      <td style={s.td}>{item.Thoi_Han_Thue}</td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_Vao}</td>
                      <td style={s.td}>{item.Dien_Tich}</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', textAlign: 'right' }}>{item.Tai_Chinh}</td>
                      <td style={s.td}>{item.Toa}</td>
                      <td style={{ ...s.td, maxWidth: 150, whiteSpace: 'pre-line', fontSize: 12 }}>{item.Can_Tu_Van}</td>
                      {/* Trạng thái — inline dropdown */}
                      <td style={{ ...s.td, padding: '4px 4px' }}>
                        <select
                          className="kt-inline-select"
                          value={item.Trang_Thai || ''}
                          onChange={(e) => inlineUpdate(item, 'Trang_Thai', e.target.value)}
                          style={getTrangThaiSelectStyle(item.Trang_Thai)}
                        >
                          {TRANG_THAI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', color: C.textMuted, fontSize: 12 }}>{item.Ghi_Chu}</td>
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
              <FormField label="Tên khách (Zalo) *" value={form.Ten_Zalo} onChange={(v) => updateForm('Ten_Zalo', v)} placeholder="VD: Anh Minh (zalo: Minh BĐS)" />
              <FormField label="Số điện thoại *" value={form.SDT} onChange={(v) => updateForm('SDT', v)} type="tel" />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Nhu cầu *</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {NHU_CAU_OPTIONS.map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
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
                </select>
              </div>

              <FormField label="Nội thất" value={form.Noi_That} onChange={(v) => updateForm('Noi_That', v)} placeholder="VD: Full nội thất, cơ bản, nguyên bản..." />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Slot xe</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {SLOT_XE_OPTIONS.map((val) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                      <input type="radio" name="slot_xe" checked={form.Slot_Xe === val} onChange={() => updateForm('Slot_Xe', val)} style={{ accentColor: C.primary }} />
                      {val === 'Null' ? 'Không quan trọng' : val}
                    </label>
                  ))}
                </div>
              </div>

              <FormField label="Thời hạn thuê" value={form.Thoi_Han_Thue} onChange={(v) => updateForm('Thoi_Han_Thue', v)} placeholder="VD: 1 năm, 2 năm, dài hạn..." />
              <FormField label="Ngày vào" value={form.Ngay_Vao} onChange={(v) => updateForm('Ngay_Vao', v)} placeholder="VD: 15/04/2025, Tháng 5..." />
              <FormField label="Diện tích" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 75m2, 90m2..." />
              <FormField label="Tài chính" value={form.Tai_Chinh} onChange={(v) => updateForm('Tai_Chinh', v)} placeholder="VD: 11 / 11.5 / 2000" />
              <FormField label="Tòa" value={form.Toa} onChange={(v) => updateForm('Toa', v)} placeholder="VD: T1, Park 5, R6..." />

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Căn tư vấn</label>
                <textarea value={form.Can_Tu_Van} onChange={(e) => updateForm('Can_Tu_Van', e.target.value)} placeholder="VD: Park 1 - 07.12&#10;Park 5 - 03.08" style={{ ...s.fieldInput, height: 72, resize: 'vertical' }} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Trạng thái khách</label>
                <select value={form.Trang_Thai} onChange={(e) => updateForm('Trang_Thai', e.target.value)} style={s.fieldInput}>
                  {TRANG_THAI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value ? o.label : '-- Chưa xác định --'}</option>)}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Ghi chú</label>
                <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} style={{ ...s.fieldInput, height: 56, resize: 'vertical' }} />
              </div>
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

// ── Helpers ──
function getNhuCauBadgeStyle(val) {
  const v = (val || '').toLowerCase();
  const base = { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 };
  if (v.includes('thu')) return { ...base, background: C.primary + '18', color: C.primaryDark };
  if (v === 'mua') return { ...base, background: C.accent + '18', color: C.accent };
  if (v === 'homestay') return { ...base, background: '#E67E2218', color: '#E67E22' };
  return { fontSize: 12, color: C.textDim };
}

function getTrangThaiSelectStyle(val) {
  const opt = TRANG_THAI_OPTIONS.find(o => o.value === val);
  if (!opt || !opt.value) return {};
  return { background: opt.bg, color: opt.text, borderRadius: 8, fontWeight: 700 };
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
const colDivider = `1px solid #E0E0E0`;

const s = {
  root: { fontFamily: F, background: C.bg, minHeight: '100vh', color: C.text },
  header: { background: '#fff', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: C.shadow },
  headerInner: { maxWidth: 1200, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  backBtn: { background: C.primaryBg, border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 18, color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  container: { maxWidth: 1500, margin: '0 auto', padding: '20px 16px' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  addBtn: { background: C.gradient, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s ease', whiteSpace: 'nowrap' },
  reloadBtn: { background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, width: 40, height: 40, fontSize: 20, color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, transition: 'all 0.15s', fontFamily: F },
  statsRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  filterRow: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 },
  searchWrap: { flex: 1, position: 'relative', minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 },
  searchInput: { width: '100%', padding: '10px 36px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: F, outline: 'none', background: '#fff', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  clearBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 18, color: C.textMuted, cursor: 'pointer', padding: '0 4px' },
  filterSelect: { padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: F, background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 100 },
  resultCount: { fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' },
  errorBox: { background: '#FEF2F2', color: C.error, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  loadingBox: { textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 },
  tableWrap: { background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: C.shadow, animation: 'ktFadeIn 0.3s ease' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 8px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: C.textMuted, borderBottom: `2px solid ${C.border}`, borderRight: colDivider, whiteSpace: 'nowrap', background: '#FAFAFA' },
  tr: { borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.12s' },
  td: { padding: '8px 8px', verticalAlign: 'middle', fontSize: 13, borderRight: colDivider },
  tdName: { minWidth: 100, whiteSpace: 'nowrap' },
  emptyTd: { textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6, transition: 'background 0.12s', color: C.textMuted },
  deleteBtn: { color: C.error },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#fff', borderRadius: 16, width: 520, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'ktSlideUp 0.25s ease', overflow: 'hidden' },
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
  confirmBox: { background: '#fff', borderRadius: 16, padding: '24px', width: 380, maxWidth: '100%', boxShadow: C.shadowLg, animation: 'ktSlideUp 0.2s ease' },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, boxShadow: C.shadowMd, zIndex: 2000 },
};
