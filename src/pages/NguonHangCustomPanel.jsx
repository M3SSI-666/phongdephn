import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { C } from '../utils/theme';
import { fetchNguonHangCustom, postNguonHangCustom, uploadImagesToCloudinary, uploadVideosToCloudinary } from '../utils/api';

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

  // Media states
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

  // Media viewer
  const [mediaViewer, setMediaViewer] = useState(null);

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

  // Media handlers
  const handleImageDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []).filter(f =>
      f.type.startsWith('image/')
    );
    if (!files.length) return;
    setImages(prev => [
      ...prev,
      ...files.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        id: Math.random().toString(36).slice(2),
      })),
    ]);
    if (e.target?.value) e.target.value = '';
  }, []);

  const handleVideoDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []).filter(f =>
      f.type.startsWith('video/')
    );
    if (!files.length) return;
    setVideos(prev => [
      ...prev,
      ...files.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        id: Math.random().toString(36).slice(2),
      })),
    ]);
    if (e.target?.value) e.target.value = '';
  }, []);

  const removeImage = (id) => setImages(prev => prev.filter(img => img.id !== id));
  const removeVideo = (id) => setVideos(prev => prev.filter(vid => vid.id !== id));
  const removeExistingImage = (url) => setExistingImages(prev => prev.filter(u => u !== url));
  const removeExistingVideo = (url) => setExistingVideos(prev => prev.filter(u => u !== url));

  const parseUrls = (str) => (str || '').split(',').map(s => s.trim()).filter(Boolean);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setImages([]);
    setVideos([]);
    setExistingImages([]);
    setExistingVideos([]);
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
    setImages([]);
    setVideos([]);
    setExistingImages(parseUrls(item.Hinh_Anh));
    setExistingVideos(parseUrls(item.Video));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
    setImages([]);
    setVideos([]);
    setExistingImages([]);
    setExistingVideos([]);
    setUploadProgress(0);
  };

  const handleSave = async () => {
    if (!form.Gia.trim()) return showToast('Vui lòng nhập giá', 'error');

    try {
      setSaving(true);
      setUploadProgress(0);

      // Upload new images/videos to Cloudinary
      let newImgUrls = [];
      let newVidUrls = [];

      if (images.length > 0) {
        newImgUrls = await uploadImagesToCloudinary(images, (p) => setUploadProgress(Math.round(p * 0.5)));
      }
      if (videos.length > 0) {
        newVidUrls = await uploadVideosToCloudinary(videos, (p) => setUploadProgress(50 + Math.round(p * 0.5)));
      }

      const allImageUrls = [...existingImages, ...newImgUrls].join(',');
      const allVideoUrls = [...existingVideos, ...newVidUrls].join(',');

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
        Hinh_Anh: allImageUrls,
        Video: allVideoUrls,
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
      setUploadProgress(0);
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

  const getMediaCount = (item) => {
    const imgs = parseUrls(item.Hinh_Anh);
    const vids = parseUrls(item.Video);
    return imgs.length + vids.length;
  };

  const openMediaViewer = (item) => {
    const imgs = parseUrls(item.Hinh_Anh).map(url => ({ type: 'image', url }));
    const vids = parseUrls(item.Video).map(url => ({ type: 'video', url }));
    const allMedia = [...vids, ...imgs];
    if (allMedia.length === 0) return;
    setMediaViewer({ media: allMedia, index: 0, item });
  };

  const TABLE_HEADERS = ['STT', 'Loại', 'PN', 'Diện tích', 'Hướng BC', 'Slot xe', 'Đồ', 'Chủ nhà', 'SĐT', 'Ghi chú', 'Giá', 'Media', ''];

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
                  <td colSpan={13} style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 }}>
                    {items.length === 0 ? 'Chưa có phòng nào. Bấm "+ Thêm phòng" để bắt đầu.' : 'Không tìm thấy kết quả'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const mediaCount = getMediaCount(item);
                  const firstImg = parseUrls(item.Hinh_Anh)[0];
                  return (
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
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {mediaCount > 0 ? (
                          <button
                            onClick={() => openMediaViewer(item)}
                            style={s.mediaBadge}
                            title="Xem ảnh/video"
                          >
                            {firstImg ? (
                              <img src={firstImg} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: 14 }}>&#9658;</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.primary }}>{mediaCount}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: C.textDim }}>--</span>
                        )}
                      </td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(item)} style={s.actionBtn} title="Sửa">&#9998;</button>
                        <button onClick={() => setDeleteTarget(item)} style={{ ...s.actionBtn, color: C.error }} title="Xoá">&#128465;</button>
                      </td>
                    </tr>
                  );
                })
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

              {/* Image Upload */}
              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Hình ảnh</label>
                <div
                  style={s.dropZone}
                  onDrop={handleImageDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => imgInputRef.current?.click()}
                >
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageDrop}
                  />
                  <div style={{ fontSize: 24, marginBottom: 4 }}>&#128247;</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Kéo thả hoặc bấm để chọn ảnh</div>
                </div>
                {/* Existing images */}
                {(existingImages.length > 0 || images.length > 0) && (
                  <div style={s.thumbGrid}>
                    {existingImages.map((url) => (
                      <div key={url} style={s.thumbItem}>
                        <img src={url} alt="" style={s.thumbImg} />
                        <button
                          style={s.thumbRemove}
                          onClick={(e) => { e.stopPropagation(); removeExistingImage(url); }}
                        >&times;</button>
                      </div>
                    ))}
                    {images.map((img) => (
                      <div key={img.id} style={s.thumbItem}>
                        <img src={img.preview} alt="" style={s.thumbImg} />
                        <button
                          style={s.thumbRemove}
                          onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                        >&times;</button>
                        <div style={s.newBadge}>Mới</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Video Upload */}
              <div style={s.fieldWrap}>
                <label style={s.fieldLabel}>Video</label>
                <div
                  style={s.dropZone}
                  onDrop={handleVideoDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => vidInputRef.current?.click()}
                >
                  <input
                    ref={vidInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleVideoDrop}
                  />
                  <div style={{ fontSize: 24, marginBottom: 4 }}>&#127909;</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Kéo thả hoặc bấm để chọn video</div>
                </div>
                {(existingVideos.length > 0 || videos.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {existingVideos.map((url) => (
                      <div key={url} style={s.videoItem}>
                        <video src={url} style={s.videoThumb} muted />
                        <div style={{ flex: 1, fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {url.split('/').pop()}
                        </div>
                        <button
                          style={s.thumbRemove}
                          onClick={(e) => { e.stopPropagation(); removeExistingVideo(url); }}
                        >&times;</button>
                      </div>
                    ))}
                    {videos.map((vid) => (
                      <div key={vid.id} style={s.videoItem}>
                        <video src={vid.preview} style={s.videoThumb} muted />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{vid.file.name}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{(vid.file.size / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                        <div style={s.newBadge}>Mới</div>
                        <button
                          style={s.thumbRemove}
                          onClick={(e) => { e.stopPropagation(); removeVideo(vid.id); }}
                        >&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={s.modalFooter}>
              {saving && uploadProgress > 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: C.gradient, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>{uploadProgress}%</span>
                </div>
              )}
              <button onClick={closeModal} style={s.cancelBtn} className="nhc-btn">Huỷ</button>
              <button onClick={handleSave} disabled={saving} style={s.saveBtn} className="nhc-btn">
                {saving ? (uploadProgress > 0 ? 'Đang tải...' : 'Đang lưu...') : 'Lưu'}
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

      {/* Media Viewer Modal */}
      {mediaViewer && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setMediaViewer(null); }}>
          <div style={s.viewerBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Phòng #{mediaViewer.item.STT} — {mediaViewer.item.Loai}
              </div>
              <button onClick={() => setMediaViewer(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: C.textMuted, cursor: 'pointer' }}>&times;</button>
            </div>
            {/* Main media */}
            <div style={{ position: 'relative', background: '#000', aspectRatio: '16/10', maxHeight: '60vh' }}>
              {mediaViewer.media[mediaViewer.index]?.type === 'video' ? (
                <video
                  src={mediaViewer.media[mediaViewer.index].url}
                  controls
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={mediaViewer.media[mediaViewer.index]?.url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
              {mediaViewer.media.length > 1 && (
                <>
                  <button
                    style={{ ...s.galleryNav, left: 8 }}
                    onClick={() => setMediaViewer(prev => ({ ...prev, index: (prev.index - 1 + prev.media.length) % prev.media.length }))}
                  >&lsaquo;</button>
                  <button
                    style={{ ...s.galleryNav, right: 8 }}
                    onClick={() => setMediaViewer(prev => ({ ...prev, index: (prev.index + 1) % prev.media.length }))}
                  >&rsaquo;</button>
                </>
              )}
              <div style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px',
                borderRadius: 4, fontSize: 11, fontWeight: 600,
              }}>
                {mediaViewer.index + 1}/{mediaViewer.media.length}
              </div>
            </div>
            {/* Thumbnail strip */}
            {mediaViewer.media.length > 1 && (
              <div style={{ display: 'flex', gap: 4, padding: 6, overflowX: 'auto' }}>
                {mediaViewer.media.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      width: 56, height: 40, borderRadius: 4, overflow: 'hidden',
                      cursor: 'pointer', flexShrink: 0,
                      border: i === mediaViewer.index ? `2px solid ${C.primary}` : '2px solid transparent',
                      opacity: i === mediaViewer.index ? 1 : 0.6,
                    }}
                    onClick={() => setMediaViewer(prev => ({ ...prev, index: i }))}
                  >
                    {m.type === 'video' ? (
                      <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
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
    display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
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
  // Drop zone
  dropZone: {
    border: `2px dashed ${C.border}`, borderRadius: 10, padding: '16px 12px',
    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
    background: C.bgInput,
  },
  // Thumbnails
  thumbGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
    gap: 6, marginTop: 8,
  },
  thumbItem: {
    position: 'relative', borderRadius: 6, overflow: 'hidden',
    aspectRatio: '1', background: C.bgCard || '#f5f5f5',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbRemove: {
    position: 'absolute', top: 2, right: 2, width: 18, height: 18,
    borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  },
  newBadge: {
    position: 'absolute', bottom: 2, left: 2, background: C.primary,
    color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 4px',
    borderRadius: 3, textTransform: 'uppercase',
  },
  videoItem: {
    display: 'flex', alignItems: 'center', gap: 8, background: C.bgCard || '#f5f5f5',
    borderRadius: 8, padding: 6, position: 'relative',
  },
  videoThumb: {
    width: 56, height: 38, borderRadius: 4, objectFit: 'cover', background: '#000',
  },
  // Media badge in table
  mediaBadge: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
    padding: 3, cursor: 'pointer',
  },
  // Media viewer
  viewerBox: {
    background: '#fff', borderRadius: 16, width: 680, maxWidth: '95vw',
    maxHeight: '90vh', overflow: 'hidden', boxShadow: C.shadowLg,
    animation: 'nhcSlideUp 0.25s ease',
  },
  galleryNav: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
    cursor: 'pointer', fontSize: 20, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
};
