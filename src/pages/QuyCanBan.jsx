import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { C } from '../utils/theme';
import { fetchQuyCanBan, postQuyCanBan, parseBan, uploadToCloudinary } from '../utils/api';

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
  Huong_BC: '', Huong_Cua: '', Gia: '', Phi: 'Thu về',
  Noi_That: '', SDT: '', Ten_Chu: '', Hinh_Anh: '', Nguon: '', Ghi_Chu: '', Mau_Ma_Can: '',
};

const TABLE_HEADERS = [
  'Ngày Update', 'Mã Căn', 'Thiết Kế', 'DT', 'Slot Xe',
  'Hướng BC', 'Hướng Cửa', 'Giá', 'Phí', 'Nội Thất', 'SDT', 'Tên Chủ', 'Ảnh', 'Nguồn', 'Ghi Chú', '',
];
const COL_WIDTHS = [92, 100, 72, 66, 76, 80, 80, 90, 80, 110, 110, 100, 80, 100, 200, 72];

export function QuyCanBanContent() {
  return <QuyCanBanInner />;
}

export default function QuyCanBan() {
  return <QuyCanBanInner />;
}

function QuyCanBanInner() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');

  const [modalMode, setModalMode]   = useState('closed');
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });

  const [rawText, setRawText]       = useState('');
  const [parsing, setParsing]       = useState(false);
  const [parsed, setParsed]         = useState(false);

  const [uploading, setUploading]   = useState(false);
  const [upProgress, setUpProgress] = useState(0);
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef                = useRef();

  const [toast, setToast]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lightbox, setLightbox]     = useState(null);
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
      const data = await fetchQuyCanBan();
      setItems(Array.isArray(data) ? data : []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const iv = setInterval(() => fetchQuyCanBan().then(d => setItems(Array.isArray(d)?d:[])).catch(()=>{}), 30000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(it => Object.entries(it).some(([k,v]) => k !== '_rowIndex' && (v||'').toString().toLowerCase().includes(q)));
    }
    return list;
  }, [items, search]);

  const TOA_ORDER = [
    'T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11',
    'P01','P02','P03','T18','P05','P06','P07','P08',
    'P09','P10','P11','P12',
  ];

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const m = (item.Ma_Can||'').toUpperCase().match(/^([A-Z]+\d{1,2})/);
      const key = m ? m[1] : '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    const entries = Array.from(map.entries());
    return entries.sort(([a],[b]) => {
      const ia = TOA_ORDER.indexOf(a);
      const ib = TOA_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [filtered]);

  async function handleParse() {
    if (!rawText.trim()) return showToast('Hãy paste tin Zalo vào trước', 'error');
    setParsing(true); setParsed(false);
    try {
      const result = await parseBan(rawText);
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
    setEditItem(item);
    setForm({
      Ma_Can:    item.Ma_Can    || '',
      Thiet_Ke:  item.Thiet_Ke  || '',
      Dien_Tich: item.Dien_Tich || '',
      Slot_Xe:   item.Slot_Xe   || 'Không',
      Huong_BC:  item.Huong_BC  || '',
      Huong_Cua: item.Huong_Cua || '',
      Gia:       item.Gia       || '',
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

  async function handleSave() {
    if (!form.Ma_Can.trim()) return showToast('Vui lòng nhập Mã căn', 'error');
    try {
      setSaving(true);
      const payload = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, typeof v==='string' ? v.trim() : v]));
      if (modalMode === 'edit') {
        await postQuyCanBan({ action: 'update', _rowIndex: editItem._rowIndex, ...payload });
        showToast('Cập nhật thành công!');
      } else {
        await postQuyCanBan({ action: 'add', ...payload });
        showToast('Thêm căn thành công!');
      }
      closeModal();
      await loadData();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await postQuyCanBan({ action: 'delete', _rowIndex: deleteTarget._rowIndex });
      showToast('Đã xoá!');
      setDeleteTarget(null);
      await loadData();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

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

  return (
    <div style={{ fontFamily: F, color: '#e2e8f0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={openAdd} style={st.addBtn} className="cb-btn">+ Thêm Căn</button>
          <button onClick={loadData} disabled={loading} style={st.reloadBtn} className="cb-btn" title="Tải lại">
            {loading ? '...' : '↻'}
          </button>
        </div>
        <div style={{ fontSize:12, color:C.textMuted }}>{filtered.length} / {items.length} căn</div>
      </div>

      <div style={{ position:'relative', marginBottom:16 }}>
        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:0.5 }}>&#128269;</span>
        <input
          type="text" placeholder="Tìm theo mã căn, tên chủ, nội thất..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={st.searchInput}
        />
        {search && <button onClick={() => setSearch('')} style={st.clearBtn}>&times;</button>}
      </div>

      {error && <div style={st.errorBox}>{error}</div>}
      {loading && <div style={st.loadingBox}>Đang tải dữ liệu...</div>}

      {!loading && !error && (
        <div className="cb-table-wrap" style={st.tableWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                {TABLE_HEADERS.map((h,i) => <th key={h||`h${i}`} style={{...st.th, width:COL_WIDTHS[i], minWidth:COL_WIDTHS[i]}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={TABLE_HEADERS.length} style={st.emptyTd}>
                  {items.length === 0 ? 'Chưa có căn nào. Bấm "+ Thêm Căn" để bắt đầu.' : 'Không tìm thấy'}
                </td></tr>
              ) : grouped.map(([toa, toaItems]) => (
                <>
                  <tr key={`header-${toa}`}>
                    <td colSpan={TABLE_HEADERS.length} style={st.toaHeader}>
                      <span style={st.toaLabel}>{toa}</span>
                    </td>
                  </tr>
                  {toaItems.map(item => (
                    <tr key={item._rowIndex} className="cb-row" style={st.tr}>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap', fontSize:12}}>{item.Ngay_Update}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:700, whiteSpace:'nowrap', background:item.Mau_Ma_Can||'transparent', color:'#fff', borderRadius: item.Mau_Ma_Can ? 6 : 0}}>{item.Ma_Can}</td>
                      <td style={{...st.td, textAlign:'center'}}>{item.Thiet_Ke}</td>
                      <td style={{...st.td, textAlign:'center'}}>{(item.Dien_Tich||'').replace(/\s*m²|m2|m$/i,'').trim()}</td>
                      <td style={{...st.td, textAlign:'center'}}>
                        <span style={{
                          background: item.Slot_Xe === 'Có' ? '#C6F6D5' : '#FED7D7',
                          color: item.Slot_Xe === 'Có' ? '#276749' : '#9B2C2C',
                          padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700,
                        }}>{item.Slot_Xe || 'Không'}</span>
                      </td>
                      <td style={{...st.td, textAlign:'center'}}>{item.Huong_BC}</td>
                      <td style={{...st.td, textAlign:'center'}}>{item.Huong_Cua}</td>
                      <td style={{...st.td, textAlign:'center', fontWeight:600, whiteSpace:'nowrap'}}>{item.Gia}</td>
                      <td style={{...st.td, textAlign:'center', fontSize:12}}>
                        <span style={{
                          background: item.Phi === 'Bao phí' ? 'rgba(56,178,116,0.15)' : 'rgba(49,130,206,0.15)',
                          color: item.Phi === 'Bao phí' ? '#38b274' : '#63b3ed',
                          padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
                        }}>{item.Phi || 'Thu về'}</span>
                      </td>
                      <td style={{...st.td, textAlign:'center'}}>{item.Noi_That}</td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap'}}>{item.SDT}</td>
                      <td style={{...st.td, textAlign:'center'}}>{item.Ten_Chu}</td>
                      <td style={{...st.td, textAlign:'center', cursor:'pointer'}}
                        onClick={() => {
                          const urls = item.Hinh_Anh ? item.Hinh_Anh.split(',').map(u=>u.trim()).filter(Boolean) : [];
                          setLightbox({ urls: sortMedia(urls), index: 0, maCan: item.Ma_Can || 'media', defaultTab: urls.length ? 'anh' : 'matbang' });
                        }}
                      ><ThumbCell value={item.Hinh_Anh} /></td>
                      <td style={{...st.td, textAlign:'center', fontSize:12}}>{item.Nguon}</td>
                      <td style={{...st.td, textAlign:'left', fontSize:12, color:'#94a3b8'}}>{item.Ghi_Chu}</td>
                      <td style={{...st.td, textAlign:'center', whiteSpace:'nowrap', borderRight:'none'}}>
                        <button onClick={() => openEdit(item)} style={st.actionBtn} title="Sửa">&#9998;</button>
                        <button onClick={() => setDeleteTarget(item)} style={{...st.actionBtn, color:C.error}} title="Xoá">&#128465;</button>
                      </td>
                    </tr>
                  ))}
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

                <div style={{ gridColumn:'1/-1' }}>
                  <ColorPicker value={form.Mau_Ma_Can} onChange={v => set('Mau_Ma_Can', v)} />
                </div>

                <FormField label="Thiết Kế" value={form.Thiet_Ke} onChange={v => set('Thiet_Ke', v)} placeholder="VD: 3PN, 2PN, Studio" />
                <FormField label="Diện Tích" value={form.Dien_Tich} onChange={v => set('Dien_Tich', v)} placeholder="VD: 106m²" />
                <FormField label="Hướng Ban Công" value={form.Huong_BC} onChange={v => set('Huong_BC', v)} placeholder="VD: Nam, Đông Nam" />
                <FormField label="Hướng Cửa" value={form.Huong_Cua} onChange={v => set('Huong_Cua', v)} placeholder="VD: Đông, Tây Bắc" />

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
                </div>

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Nội Thất" value={form.Noi_That} onChange={v => set('Noi_That', v)} placeholder="VD: Full đồ, có đồ nhà sửa đẹp, trống..." />
                </div>

                <FormField label="SDT Chủ" value={form.SDT} onChange={v => set('SDT', v)} placeholder="VD: 0363560203" />
                <FormField label="Tên Chủ" value={form.Ten_Chu} onChange={v => set('Ten_Chu', v)} placeholder="VD: Anh Nam, Chị Hoa" />

                <div style={{ gridColumn:'1/-1' }}>
                  <FormField label="Nguồn (Ai mang hàng về)" value={form.Nguon} onChange={v => set('Nguon', v)} placeholder="VD: Anh Phong, Chị Lan, Zalo nhóm..." />
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

const D = '1.5px solid #2d3240';
const st = {
  addBtn:      { background:C.gradient, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:C.shadowGreen, whiteSpace:'nowrap' },
  reloadBtn:   { background:'#22263a', border:'1.5px solid #3a3f52', borderRadius:10, width:40, height:40, fontSize:20, color:C.primary, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontFamily:F },
  searchInput: { width:'100%', padding:'10px 36px', border:'1.5px solid #3a3f52', borderRadius:10, fontSize:13, fontFamily:F, outline:'none', background:'#1e2130', color:'#e2e8f0', boxSizing:'border-box' },
  clearBtn:    { position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:18, color:'#8a9bb8', cursor:'pointer' },
  errorBox:    { background:'#FEF2F2', color:C.error, padding:'12px 16px', borderRadius:10, fontSize:13, marginBottom:16 },
  loadingBox:  { textAlign:'center', padding:40, color:'#8a9bb8', fontSize:14 },
  tableWrap:   { background:'#1a1d27', borderRadius:12, border:'1px solid #2d3240', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' },
  table:       { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:          { textAlign:'center', padding:'10px 8px', fontWeight:700, fontSize:11, textTransform:'uppercase', color:'#8a9bb8', borderBottom:'2px solid #2d3240', borderRight:D, whiteSpace:'nowrap', background:'#13151e' },
  tr:          { borderBottom:'1.5px solid #2d3240', transition:'background 0.12s' },
  td:          { padding:'8px 8px', verticalAlign:'middle', fontSize:13, borderRight:D, color:'#e2e8f0' },
  emptyTd:     { textAlign:'center', padding:40, color:'#8a9bb8', fontSize:14 },
  toaHeader:   { background:'rgba(255,255,255,0.13)', padding:'7px 0', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.18)', borderBottom:'1px solid rgba(255,255,255,0.18)' },
  toaLabel:    { fontWeight:700, fontSize:13, color:'rgba(255,255,255,0.75)', letterSpacing:3, textTransform:'uppercase' },
  actionBtn:   { background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'4px 6px', borderRadius:6, color:C.textMuted },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
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
