import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { C } from '../utils/theme';
import { fetchQuyHomestay, postQuyHomestay, uploadToCloudinary } from '../utils/api';

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
  Ngay_PS: '', Ngay_Cap_Nhat: '', Nguon: '', Ma_Can: '', Loai_Can: '',
  Dien_Tich: '', Gia_Ngay: '', Gia_Thang: '', TT: '', Ten_Chu: '',
  SDT_Chu: '', Pass: '', Noi_That: '', Tien_Nghi: '', Hinh_Anh: '',
  Ghi_Chu: '', Mau_Ma_Can: '',
};

const TABLE_HEADERS = [
  'STT', 'Ngày PS', 'Ngày CN', 'Nguồn', 'Mã căn', 'Loại', 'DT', 'Giá/ngày', 'Giá/tháng',
  'TT', 'Tên chủ/QL', 'SĐT', 'Pass', 'Nội thất', 'Tiện nghi', 'Ảnh', 'Ghi chú', '',
];

export function QuyHomestayContent({ overrideUserId, overrideRole, isViewAs } = {}) {
  return <QuyHomestayInner overrideUserId={overrideUserId} overrideRole={overrideRole} isViewAs={isViewAs} />;
}

export default function QuyHomestay() {
  return <QuyHomestayInner />;
}

function formatTs(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mn = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm} ${hh}:${mn}`;
}

function QuyHomestayInner({ overrideUserId, overrideRole, isViewAs = false } = {}) {
  const { user } = useUser();
  const userId = overrideUserId || user?.id;
  const role   = overrideRole   || user?.publicMetadata?.role || 'staff';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importLog, setImportLog] = useState(() => { try { return JSON.parse(localStorage.getItem('importLog_homestay') || '[]'); } catch { return []; } });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();
  const toastTimer = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes hsSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes hsToastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      .hs-row:hover { background: rgba(255,255,255,0.06) !important; }
      .hs-btn:active { transform: scale(0.97); }
      .hs-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .hs-table-wrap::-webkit-scrollbar { height: 6px; }
      .hs-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      @keyframes hsRowPulse { 0%,100%{background:transparent} 30%{background:rgba(56,178,116,0.22)} }
      .hs-row-highlight { animation: hsRowPulse 2s ease !important; outline: 2px solid rgba(56,178,116,0.6) !important; outline-offset:-2px; border-radius:4px; }
      @media (max-width: 640px) {
        .hs-modal-content { width: 100% !important; height: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
        .hs-header-row { flex-direction: column !important; gap: 10px !important; align-items: stretch !important; }
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
      const data = await fetchQuyHomestay(userId, role, isViewAs);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, role, isViewAs]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchQuyHomestay(userId, role).then((data) => setItems(Array.isArray(data) ? data : [])).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
    setForm({
      Ngay_PS: item.Ngay_PS || '',
      Ngay_Cap_Nhat: item.Ngay_Cap_Nhat || '',
      Nguon: item.Nguon || '',
      Ma_Can: item.Ma_Can || '',
      Loai_Can: item.Loai_Can || '',
      Dien_Tich: item.Dien_Tich || '',
      Gia_Ngay: item.Gia_Ngay || '',
      Gia_Thang: item.Gia_Thang || '',
      TT: item.TT || '',
      Ten_Chu: item.Ten_Chu || '',
      SDT_Chu: item.SDT_Chu || '',
      Pass: item.Pass || '',
      Noi_That: item.Noi_That || '',
      Tien_Nghi: item.Tien_Nghi || '',
      Hinh_Anh: item.Hinh_Anh || '',
      Ghi_Chu: item.Ghi_Chu || '',
      Mau_Ma_Can: item.Mau_Ma_Can || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditItem(null); };
  const updateForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  function pushImportLog(maCan) {
    const entry = { Ma_Can: maCan, ts: new Date().toISOString() };
    setImportLog(prev => {
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem('importLog_homestay', JSON.stringify(next));
      return next;
    });
  }

  function scrollToRow(maCan) {
    const el = document.getElementById(`hs-row-${maCan}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('hs-row-highlight');
    setTimeout(() => el.classList.remove('hs-row-highlight'), 2000);
  }

  // Upload ảnh
  async function handleImageFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    const existing = form.Hinh_Anh ? form.Hinh_Anh.split(',').map(u => u.trim()).filter(Boolean) : [];
    const newUrls = [...existing];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { showToast(`${file.name} không phải ảnh`, 'error'); continue; }
      try {
        const url = await uploadToCloudinary(file, 'image', setUploadProgress);
        newUrls.push(url);
      } catch (e) {
        showToast('Upload thất bại: ' + e.message, 'error');
      }
    }
    setUploading(false);
    setUploadProgress(0);
    updateForm('Hinh_Anh', newUrls.join(', '));
  }

  function removeImage(url) {
    const urls = form.Hinh_Anh.split(',').map(u => u.trim()).filter(u => u && u !== url);
    updateForm('Hinh_Anh', urls.join(', '));
  }

  const handleSave = async () => {
    if (!form.Ma_Can.trim()) return showToast('Vui lòng nhập Mã căn', 'error');
    try {
      setSaving(true);
      const payload = {
        Ngay_PS: form.Ngay_PS.trim(),
        Ngay_Cap_Nhat: getTodayStr(),
        Nguon: form.Nguon.trim(),
        Ma_Can: form.Ma_Can.trim(),
        Loai_Can: form.Loai_Can.trim(),
        Dien_Tich: form.Dien_Tich.trim(),
        Gia_Ngay: form.Gia_Ngay.trim(),
        Gia_Thang: form.Gia_Thang.trim(),
        TT: form.TT.trim(),
        Ten_Chu: form.Ten_Chu.trim(),
        SDT_Chu: form.SDT_Chu.trim(),
        Pass: form.Pass.trim(),
        Noi_That: form.Noi_That.trim(),
        Tien_Nghi: form.Tien_Nghi.trim(),
        Hinh_Anh: form.Hinh_Anh.trim(),
        Ghi_Chu: form.Ghi_Chu.trim(),
        Mau_Ma_Can: form.Mau_Ma_Can || '',
        Owner_Id: userId || '',
      };
      if (editItem) {
        await postQuyHomestay({ action: 'update', _rowIndex: editItem._rowIndex, STT: editItem.STT, Owner_Id: editItem.Owner_Id || userId || '', ...payload });
        pushImportLog(payload.Ma_Can);
        showToast('Cập nhật thành công!');
      } else {
        const maxSTT = items.reduce((m, i) => Math.max(m, Number(i.STT) || 0), 0);
        await postQuyHomestay({ action: 'add', STT: maxSTT + 1, ...payload });
        pushImportLog(payload.Ma_Can);
        showToast('Thêm Homestay thành công!');
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
      await postQuyHomestay({ action: 'delete', _rowIndex: deleteTarget._rowIndex });
      showToast('Đã xoá!');
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Thumbnails trong table
  function ThumbCell({ value }) {
    const urls = value ? value.split(',').map(u => u.trim()).filter(Boolean) : [];
    if (!urls.length) return <span style={{ color: '#ccc' }}>—</span>;
    return (
      <div style={{ display: 'flex', gap: 3 }}>
        {urls.slice(0, 2).map((u, i) => (
          <img key={i} src={u} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
        ))}
        {urls.length > 2 && <span style={{ fontSize: 11, color: C.textMuted, alignSelf: 'center' }}>+{urls.length - 2}</span>}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F, color: C.text }}>
      {/* Header row */}
      <div className="hs-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={openAdd} style={st.addBtn} className="hs-btn">+ Thêm Homestay</button>
          <button onClick={loadData} disabled={loading} style={st.reloadBtn} className="hs-btn" title="Tải lại">
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
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid #2d3240', borderRadius:8, padding:'4px 10px', fontSize:11, whiteSpace:'nowrap', display:'flex', gap:5, alignItems:'center', cursor:'pointer', transition:'all 0.15s' }}
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

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 }}>&#128269;</span>
        <input
          type="text"
          placeholder="Tìm theo mã căn, tên chủ, SĐT, tiện nghi..."
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
        <div className="hs-table-wrap" style={st.tableWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                {TABLE_HEADERS.map((h, i) => (
                  <th key={h || `act_${i}`} style={st.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={TABLE_HEADERS.length} style={st.emptyTd}>
                  {items.length === 0 ? 'Chưa có dữ liệu. Bấm "+ Thêm Homestay" để bắt đầu.' : 'Không tìm thấy kết quả'}
                </td></tr>
              ) : filtered.map((item) => (
                <tr key={item._rowIndex} id={`hs-row-${item.Ma_Can}`} className="hs-row" style={st.tr}>
                  <td style={{ ...st.td, textAlign: 'center', color: C.textDim, fontSize: 12 }}>{item.STT}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_PS}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap', fontSize: 12 }}>{item.Ngay_Cap_Nhat}</td>
                  <td style={{ ...st.td }}>{item.Nguon}</td>
                  <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'nowrap', color: item.Mau_Ma_Can || C.text }}>{item.Ma_Can}</td>
                  <td style={{ ...st.td }}>{item.Loai_Can}</td>
                  <td style={{ ...st.td, textAlign: 'center' }}>{item.Dien_Tich}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.Gia_Ngay}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.Gia_Thang}</td>
                  <td style={{ ...st.td, whiteSpace: 'pre-line' }}>{item.TT}</td>
                  <td style={{ ...st.td, fontWeight: 600 }}>{item.Ten_Chu}</td>
                  <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{item.SDT_Chu}</td>
                  <td style={{ ...st.td, fontSize: 12 }}>{item.Pass}</td>
                  <td style={{ ...st.td }}>{item.Noi_That}</td>
                  <td style={{ ...st.td, maxWidth: 160, fontSize: 12 }}>{item.Tien_Nghi}</td>
                  <td style={{ ...st.td }}><ThumbCell value={item.Hinh_Anh} /></td>
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
          <div className="hs-modal-content" style={st.modal}>
            <div style={st.modalHeader}>
              <div style={st.modalTitle}>{editItem ? 'Sửa Homestay' : 'Thêm Homestay mới'}</div>
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

              <FormField label="Nguồn" value={form.Nguon} onChange={(v) => updateForm('Nguon', v)} placeholder="VD: Chủ nhà, Đối tác..." />
              <FormField label="Mã căn *" value={form.Ma_Can} onChange={(v) => updateForm('Ma_Can', v)} placeholder="VD: S1-08-05A" />

              <ColorPicker value={form.Mau_Ma_Can} onChange={(v) => updateForm('Mau_Ma_Can', v)} />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={st.fieldWrap}>
                    <label style={st.fieldLabel}>Loại căn</label>
                    <select value={form.Loai_Can} onChange={(e) => updateForm('Loai_Can', e.target.value)} style={st.fieldInput}>
                      <option value="">--</option>
                      {['Studio', '1 PN', '2 PN', '3 PN', 'Duplex', 'Penthouse'].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Diện tích (m²)" value={form.Dien_Tich} onChange={(v) => updateForm('Dien_Tich', v)} placeholder="VD: 45, 65..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Giá theo ngày" value={form.Gia_Ngay} onChange={(v) => updateForm('Gia_Ngay', v)} placeholder="VD: 800k/đêm" />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Giá theo tháng" value={form.Gia_Thang} onChange={(v) => updateForm('Gia_Thang', v)} placeholder="VD: 12 triệu" />
                </div>
              </div>

              <FormField label="TT (Tình trạng)" value={form.TT} onChange={(v) => updateForm('TT', v)} placeholder="VD: Còn, Đã đặt, Bảo trì..." />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Tên chủ / Quản lý" value={form.Ten_Chu} onChange={(v) => updateForm('Ten_Chu', v)} placeholder="Tên liên hệ" />
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="SĐT liên hệ" value={form.SDT_Chu} onChange={(v) => updateForm('SDT_Chu', v)} type="tel" placeholder="Số điện thoại" />
                </div>
              </div>

              <FormField label="Pass / Giá NET" value={form.Pass} onChange={(v) => updateForm('Pass', v)} placeholder="VD: 10 triệu" />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={st.fieldWrap}>
                    <label style={st.fieldLabel}>Nội thất</label>
                    <select value={form.Noi_That} onChange={(e) => updateForm('Noi_That', e.target.value)} style={st.fieldInput}>
                      <option value="">--</option>
                      {['Full cao cấp', 'Full cơ bản', 'Cơ bản', 'Không'].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <FormField label="Tiện nghi đặc biệt" value={form.Tien_Nghi} onChange={(v) => updateForm('Tien_Nghi', v)} placeholder="VD: Hồ bơi, Gym..." />
                </div>
              </div>

              <div style={st.fieldWrap}>
                <label style={st.fieldLabel}>Ghi chú</label>
                <textarea value={form.Ghi_Chu} onChange={(e) => updateForm('Ghi_Chu', e.target.value)} placeholder="Ghi chú thêm..." style={{ ...st.fieldInput, height: 64, resize: 'vertical' }} />
              </div>

              {/* Image upload */}
              <div style={st.fieldWrap}>
                <label style={st.fieldLabel}>Hình ảnh</label>

                {/* Thumbnails */}
                {form.Hinh_Anh && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {form.Hinh_Anh.split(',').map(u => u.trim()).filter(Boolean).map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: C.error, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: '18px', textAlign: 'center' }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleImageFiles(e.dataTransfer.files); }}
                  style={{
                    border: `2px dashed ${dragOver ? C.primary : uploading ? C.primary : C.border}`,
                    borderRadius: 8, padding: '12px 16px',
                    cursor: uploading ? 'default' : 'pointer',
                    textAlign: 'center', color: C.textMuted, fontSize: 13,
                    background: dragOver ? C.primaryBg : '#fafbfc',
                  }}
                >
                  {uploading ? `Đang upload... ${uploadProgress}%` : 'Click hoặc kéo thả ảnh vào đây'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ''; }}
                />
              </div>
            </div>

            <div style={st.modalFooter}>
              <button onClick={closeModal} style={st.cancelBtn} className="hs-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving || uploading} style={st.saveBtn} className="hs-btn">
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
              Xoá Homestay <strong>{deleteTarget.Ma_Can}</strong>? Hành động này không thể hoàn tác.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={st.cancelBtn} className="hs-btn">Huỷ</button>
              <button onClick={confirmDelete} disabled={saving} style={{ ...st.saveBtn, background: C.error }} className="hs-btn">
                {saving ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...st.toast, background: toast.type === 'error' ? C.error : C.primary, animation: 'hsToastIn 0.3s ease' }}>
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
  modal: { background: '#1a1d27', borderRadius: 16, width: 580, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: C.shadowLg, animation: 'hsSlideUp 0.25s ease', overflow: 'hidden' },
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
  confirmBox: { background: '#1a1d27', borderRadius: 16, padding: '24px', width: 380, maxWidth: '100%', boxShadow: C.shadowLg, animation: 'hsSlideUp 0.2s ease' },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, boxShadow: C.shadowMd, zIndex: 2000 },
};
