import { useState, useRef, useCallback } from 'react';
import { C, QUAN_LIST, LOAI_PHONG, formatVND } from '../utils/theme';
import {
  parseTextWithClaude,
  uploadImagesToCloudinary,
  uploadVideosToCloudinary,
  pushToGoogleSheets,
} from '../utils/api';

export default function AdminTool() {
  const [rawText, setRawText] = useState('');
  const [nguonPhong, setNguonPhong] = useState('');
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [phase, setPhase] = useState('input'); // input | processing | review | done
  const [parsedData, setParsedData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ images: 0, videos: 0, text: 0 });
  const [mediaUrls, setMediaUrls] = useState({ images: [], videos: [] });
  const [error, setError] = useState(null);

  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

  const handleImageDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []).filter(f =>
      f.type.startsWith('image/')
    );
    setImages(prev => [
      ...prev,
      ...files.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        id: Math.random().toString(36).slice(2),
      })),
    ]);
  }, []);

  const handleVideoDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []).filter(f =>
      f.type.startsWith('video/')
    );
    setVideos(prev => [
      ...prev,
      ...files.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        id: Math.random().toString(36).slice(2),
      })),
    ]);
  }, []);

  const removeImage = (id) => setImages(prev => prev.filter(i => i.id !== id));
  const removeVideo = (id) => setVideos(prev => prev.filter(v => v.id !== id));

  const handleProcess = async () => {
    if (!rawText.trim()) return;
    setPhase('processing');
    setError(null);
    setUploadProgress({ images: 0, videos: 0, text: 0 });

    try {
      const [parsed, imgUrls, vidUrls] = await Promise.all([
        parseTextWithClaude(rawText).then(data => {
          setUploadProgress(prev => ({ ...prev, text: 100 }));
          return data;
        }),
        images.length > 0
          ? uploadImagesToCloudinary(images, (p) =>
              setUploadProgress(prev => ({ ...prev, images: p }))
            )
          : Promise.resolve([]).then(() => {
              setUploadProgress(prev => ({ ...prev, images: 100 }));
              return [];
            }),
        videos.length > 0
          ? uploadVideosToCloudinary(videos, (p) =>
              setUploadProgress(prev => ({ ...prev, videos: p }))
            )
          : Promise.resolve([]).then(() => {
              setUploadProgress(prev => ({ ...prev, videos: 100 }));
              return [];
            }),
      ]);

      setParsedData(parsed);
      setMediaUrls({ images: imgUrls, videos: vidUrls });
      setTimeout(() => setPhase('review'), 400);
    } catch (err) {
      setError(err.message);
      setPhase('input');
    }
  };

  const handleConfirm = async () => {
    try {
      await pushToGoogleSheets({
        ...parsedData,
        images: mediaUrls.images,
        videos: mediaUrls.videos,
        nguon_phong: nguonPhong,
        thong_tin_raw: rawText,
        ngay_input: new Date().toISOString(),
      });
      setPhase('done');
      setTimeout(() => {
        setPhase('input');
        setRawText('');
        setNguonPhong('');
        setImages([]);
        setVideos([]);
        setParsedData(null);
        setMediaUrls({ images: [], videos: [] });
      }, 2500);
    } catch (err) {
      setError('Lỗi đẩy vào Sheets: ' + err.message);
    }
  };

  const handleReset = () => {
    setPhase('input');
    setRawText('');
    setNguonPhong('');
    setImages([]);
    setVideos([]);
    setParsedData(null);
    setError(null);
  };

  return (
    <div style={st.root}>
      <header style={st.header}>
        <div style={st.headerInner}>
          <div style={st.logoGroup}>
            <div style={st.logoIcon}>P</div>
            <div>
              <div style={st.logoText}>Phòng Đẹp HN</div>
              <div style={st.logoSub}>Admin Tool</div>
            </div>
          </div>
          <div style={st.headerRight}>
            <div style={st.statusDot(phase === 'done')} />
            <span style={st.statusText}>
              {phase === 'input'
                ? 'Sẵn sàng nhập'
                : phase === 'processing'
                ? 'Đang xử lý...'
                : phase === 'review'
                ? 'Chờ xác nhận'
                : 'Đã đẩy!'}
            </span>
          </div>
        </div>
      </header>

      <main style={st.main}>
        {error && (
          <div style={st.errorBanner}>
            <span>{error}</span>
            <button style={st.errorClose} onClick={() => setError(null)}>x</button>
          </div>
        )}

        {(phase === 'input' || phase === 'processing') && (
          <div style={st.inputLayout}>
            {/* LEFT - Inputs */}
            <div style={st.inputLeft}>
              <h2 style={st.sectionTitle}>
                <span style={st.stepNum}>1</span> Nhập liệu
              </h2>

              {/* TEXT */}
              <div style={st.inputZone}>
                <div style={st.zoneHeader}>
                  <div style={st.zoneIcon('text')}>T</div>
                  <div>
                    <div style={st.zoneTitle}>Text từ Zalo</div>
                    <div style={st.zoneDesc}>Paste toàn bộ tin nhắn phòng</div>
                  </div>
                </div>
                <textarea
                  style={st.textarea}
                  placeholder={
                    'Paste tin nhắn từ Zalo vào đây...\n\nVí dụ:\nMã Toà Nhà: F066\nĐịa Chỉ: Ngõ 690 Lạc Long Quân\nQuận: Tây Hồ\nGiá Phòng: 4tr5...'
                  }
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  disabled={phase === 'processing'}
                />
                {rawText && <div style={st.charCount}>{rawText.length} ký tự</div>}
              </div>

              {/* NGUON PHONG */}
              <div style={st.inputZone}>
                <div style={st.zoneHeader}>
                  <div style={st.zoneIcon('text')}>N</div>
                  <div>
                    <div style={st.zoneTitle}>Nguồn phòng</div>
                    <div style={st.zoneDesc}>VD: ZL (Zalo), FB (Facebook), TT (TikTok)...</div>
                  </div>
                </div>
                <input
                  style={{ ...st.formInput, background: C.bgInput }}
                  placeholder="VD: ZL, FB, TT..."
                  value={nguonPhong}
                  onChange={(e) => setNguonPhong(e.target.value)}
                  disabled={phase === 'processing'}
                />
              </div>

              {/* IMAGES */}
              <div style={st.inputZone}>
                <div style={st.zoneHeader}>
                  <div style={st.zoneIcon('image')}>A</div>
                  <div>
                    <div style={st.zoneTitle}>Ảnh phòng</div>
                    <div style={st.zoneDesc}>Kéo thả hoặc click - JPG, PNG, WebP</div>
                  </div>
                  <div style={st.fileCount(images.length)}>{images.length}</div>
                </div>
                <div
                  style={st.dropZone}
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
                  {images.length === 0 ? (
                    <div style={st.dropPlaceholder}>
                      <div style={st.dropIcon}>+</div>
                      <div>Kéo thả ảnh vào đây</div>
                      <div style={st.dropHint}>hoặc click để chọn file</div>
                    </div>
                  ) : (
                    <div style={st.thumbGrid}>
                      {images.map((img) => (
                        <div key={img.id} style={st.thumbItem}>
                          <img src={img.preview} alt="" style={st.thumbImg} />
                          <button
                            style={st.thumbRemove}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(img.id);
                            }}
                          >
                            x
                          </button>
                        </div>
                      ))}
                      <div style={st.thumbAdd}>+</div>
                    </div>
                  )}
                </div>
              </div>

              {/* VIDEO */}
              <div style={st.inputZone}>
                <div style={st.zoneHeader}>
                  <div style={st.zoneIcon('video')}>V</div>
                  <div>
                    <div style={st.zoneTitle}>Video phòng</div>
                    <div style={st.zoneDesc}>Kéo thả hoặc click - MP4, MOV</div>
                  </div>
                  <div style={st.fileCount(videos.length)}>{videos.length}</div>
                </div>
                <div
                  style={st.dropZone}
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
                  {videos.length === 0 ? (
                    <div style={st.dropPlaceholder}>
                      <div style={st.dropIcon}>+</div>
                      <div>Kéo thả video vào đây</div>
                      <div style={st.dropHint}>hoặc click để chọn file</div>
                    </div>
                  ) : (
                    <div style={st.videoList}>
                      {videos.map((vid) => (
                        <div key={vid.id} style={st.videoItem}>
                          <video src={vid.preview} style={st.videoThumb} muted />
                          <div style={{ flex: 1 }}>
                            <div style={st.videoName}>{vid.file.name}</div>
                            <div style={st.videoSize}>
                              {(vid.file.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                          </div>
                          <button
                            style={st.thumbRemove}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVideo(vid.id);
                            }}
                          >
                            x
                          </button>
                        </div>
                      ))}
                      <div
                        style={st.addVideoBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          vidInputRef.current?.click();
                        }}
                      >
                        + Thêm video
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                style={st.processBtn(phase === 'processing', !rawText.trim())}
                onClick={handleProcess}
                disabled={phase === 'processing' || !rawText.trim()}
              >
                {phase === 'processing' ? 'Đang xử lý...' : 'Xử lý tự động'}
              </button>
            </div>

            {/* RIGHT - Status */}
            <div style={st.inputRight}>
              <h2 style={st.sectionTitle}>
                <span style={st.stepNum}>2</span> Trạng thái
              </h2>
              <div style={st.statusCard}>
                {phase === 'input' ? (
                  <div style={st.statusIdle}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>||</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      Paste text và thả ảnh/video
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.textMuted,
                        marginTop: 4,
                        marginBottom: 20,
                      }}
                    >
                      Nhấn "Xử lý tự động" khi xong
                    </div>
                    <div style={st.workflow}>
                      {[
                        ['AI', 'AI Parse text', 'Claude đọc tin nhắn -> trích xuất JSON'],
                        ['Up', 'Upload ảnh -> Cloudinary', 'Optimize + lấy URL'],
                        ['Vd', 'Upload video -> Cloudinary', 'Transcode + nén + lấy URL'],
                        ['Ok', 'Review & Xác nhận', 'Kiểm tra -> đẩy vào Google Sheets'],
                      ].map(([icon, title, desc], i) => (
                        <div key={i}>
                          {i > 0 && (
                            <div
                              style={{
                                textAlign: 'center',
                                color: C.border,
                                fontSize: 14,
                                padding: '2px 0',
                              }}
                            >
                              |
                            </div>
                          )}
                          <div style={st.wfStep}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                width: 32,
                                height: 24,
                                textAlign: 'center',
                                background: C.primaryBg,
                                color: C.primary,
                                borderRadius: 4,
                                lineHeight: '24px',
                              }}
                            >
                              {icon}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                                {title}
                              </div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>{desc}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ProgressRow label="AI Parse text" progress={uploadProgress.text} />
                    <ProgressRow
                      label={`Upload ${images.length} ảnh`}
                      progress={uploadProgress.images}
                    />
                    <ProgressRow
                      label={`Upload ${videos.length} video`}
                      progress={uploadProgress.videos}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        color: C.textDim,
                        textAlign: 'center',
                        paddingTop: 8,
                        borderTop: `1px solid ${C.border}`,
                      }}
                    >
                      3 luồng chạy song song
                    </div>
                  </div>
                )}
              </div>
              <div style={st.summaryGrid}>
                {[
                  ['Text', rawText.length > 0 ? '1' : '0'],
                  ['Ảnh', images.length],
                  ['Video', videos.length],
                ].map(([label, num]) => (
                  <div key={label} style={st.summaryItem}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{num}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REVIEW PHASE */}
        {phase === 'review' && parsedData && (
          <div style={st.reviewLayout}>
            <div>
              <h2 style={st.sectionTitle}>
                <span style={st.stepNum}>3</span> Kiểm tra & Sửa
              </h2>
              <ReviewForm data={parsedData} onChange={setParsedData} />
            </div>
            <div style={{ position: 'sticky', top: 80 }}>
              <h2 style={st.sectionTitle}>
                <span style={st.stepNum}>4</span> Preview trên Website
              </h2>
              <WebsitePreview
                data={parsedData}
                images={mediaUrls.images}
                videos={mediaUrls.videos}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button style={st.backBtn} onClick={handleReset}>
                  Nhập lại
                </button>
                <button style={st.confirmBtn} onClick={handleConfirm}>
                  Xác nhận & Đẩy vào Sheet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DONE */}
        {phase === 'done' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh',
            }}
          >
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16, color: C.primary }}>OK</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: C.primary,
                  marginBottom: 8,
                }}
              >
                Đã đẩy thành công!
              </div>
              <div style={{ fontSize: 14, color: C.textMuted }}>
                Phòng đã được thêm vào Google Sheets & Website
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────
function ProgressRow({ label, progress }) {
  const done = progress >= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.text,
          width: 130,
          flexShrink: 0,
        }}
      >
        {label} {done && <span style={{ color: C.primary }}>OK</span>}
      </div>
      <div
        style={{
          flex: 1,
          height: 6,
          background: C.border,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 3,
            transition: 'width 0.3s',
            background: done
              ? C.primary
              : `linear-gradient(90deg, ${C.primaryDark}, ${C.primary})`,
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, width: 36, textAlign: 'right' }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

function ReviewForm({ data, onChange }) {
  const update = (key, val) => onChange((prev) => ({ ...prev, [key]: val }));
  const conf = data.confidence || {};

  const fi = (key) => ({
    ...st.formInput,
    ...(conf[key] === 'low'
      ? { borderColor: C.error, background: `${C.error}11` }
      : conf[key] === 'medium'
      ? { borderColor: C.warn, background: `${C.warn}11` }
      : {}),
  });

  return (
    <div style={st.formGrid}>
      <div style={st.formRow}>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>
            Quận/Huyện <ConfBadge level={conf.quan_huyen} />
          </label>
          <select
            style={fi('quan_huyen')}
            value={data.quan_huyen || ''}
            onChange={(e) => update('quan_huyen', e.target.value)}
          >
            <option value="">-- Chọn --</option>
            {QUAN_LIST.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>
            Khu vực <ConfBadge level={conf.khu_vuc} />
          </label>
          <input
            style={fi('khu_vuc')}
            value={data.khu_vuc || ''}
            onChange={(e) => update('khu_vuc', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label style={st.formLabel}>Địa chỉ</label>
        <input
          style={st.formInput}
          value={data.dia_chi || ''}
          onChange={(e) => update('dia_chi', e.target.value)}
        />
      </div>
      <div style={st.formRow}>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>
            Giá (VNĐ) <ConfBadge level={conf.gia} />
          </label>
          <input
            style={fi('gia')}
            type="number"
            value={data.gia || ''}
            onChange={(e) => update('gia', Number(e.target.value))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>
            Loại phòng <ConfBadge level={conf.loai_phong} />
          </label>
          <select
            style={fi('loai_phong')}
            value={data.loai_phong || ''}
            onChange={(e) => update('loai_phong', e.target.value)}
          >
            <option value="">-- Chọn --</option>
            {LOAI_PHONG.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={st.formLabel}>Số phòng</label>
        <input
          style={st.formInput}
          value={data.so_phong || ''}
          onChange={(e) => update('so_phong', e.target.value)}
          placeholder="VD: 401, 301..."
        />
      </div>
      <div style={st.formRow}>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>Giá điện</label>
          <input
            style={st.formInput}
            value={data.gia_dien || ''}
            onChange={(e) => update('gia_dien', e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>Giá nước</label>
          <input
            style={st.formInput}
            value={data.gia_nuoc || ''}
            onChange={(e) => update('gia_nuoc', e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={st.formLabel}>Internet</label>
          <input
            style={st.formInput}
            value={data.gia_internet || ''}
            onChange={(e) => update('gia_internet', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label style={st.formLabel}>Dịch vụ chung</label>
        <input
          style={st.formInput}
          value={data.dich_vu_chung || ''}
          onChange={(e) => update('dich_vu_chung', e.target.value)}
        />
      </div>
      <div>
        <label style={st.formLabel}>Nội thất</label>
        <textarea
          style={{ ...st.formInput, height: 56, resize: 'vertical' }}
          value={data.noi_that || ''}
          onChange={(e) => update('noi_that', e.target.value)}
        />
      </div>
      <div>
        <label style={st.formLabel}>Ghi chú</label>
        <textarea
          style={{ ...st.formInput, height: 72, resize: 'vertical' }}
          value={data.ghi_chu || ''}
          onChange={(e) => update('ghi_chu', e.target.value)}
          placeholder="Khép kín, diện tích, xe điện, pet, hoa hồng..."
        />
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          paddingTop: 8,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {[
          ['high', C.primary, 'Chắc chắn'],
          ['medium', C.warn, 'Cần kiểm tra'],
          ['low', C.error, 'Không tìm thấy'],
        ].map(([l, c, t]) => (
          <span
            key={l}
            style={{
              fontSize: 11,
              color: C.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: c,
                display: 'inline-block',
              }}
            />{' '}
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfBadge({ level }) {
  if (!level || level === 'high') return null;
  const color = level === 'medium' ? C.warn : C.error;
  return (
    <span
      style={{
        background: color,
        color: '#fff',
        borderRadius: 4,
        padding: '1px 5px',
        fontSize: 10,
        fontWeight: 700,
        marginLeft: 4,
      }}
    >
      {level === 'medium' ? '?' : '!'}
    </span>
  );
}

function WebsitePreview({ data, images, videos }) {
  const [activeImg, setActiveImg] = useState(0);
  const allMedia = [
    ...(images || []).map((u) => ({ type: 'image', url: u })),
    ...(videos || []).map((u) => ({ type: 'video', url: u })),
  ];

  return (
    <div
      style={{
        background: C.bgCard,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          background: C.bg,
          fontSize: 11,
          fontWeight: 700,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        Preview
      </div>
      {allMedia.length > 0 && (
        <>
          <div
            style={{
              position: 'relative',
              background: '#000',
              aspectRatio: '16/10',
            }}
          >
            {allMedia[activeImg]?.type === 'video' ? (
              <video
                src={allMedia[activeImg].url}
                controls
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <img
                src={allMedia[activeImg]?.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {allMedia.length > 1 && (
              <>
                <button
                  style={{ ...st.galleryNav, left: 8 }}
                  onClick={() =>
                    setActiveImg((i) => (i - 1 + allMedia.length) % allMedia.length)
                  }
                >
                  {'<'}
                </button>
                <button
                  style={{ ...st.galleryNav, right: 8 }}
                  onClick={() => setActiveImg((i) => (i + 1) % allMedia.length)}
                >
                  {'>'}
                </button>
              </>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {activeImg + 1}/{allMedia.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 4, overflowX: 'auto' }}>
            {allMedia.map((m, i) => (
              <div
                key={i}
                style={{
                  width: 56,
                  height: 40,
                  borderRadius: 4,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  border:
                    i === activeImg
                      ? `2px solid ${C.primary}`
                      : '2px solid transparent',
                  opacity: i === activeImg ? 1 : 0.6,
                }}
                onClick={() => setActiveImg(i)}
              >
                {m.type === 'video' ? (
                  <video
                    src={m.url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    muted
                  />
                ) : (
                  <img
                    src={m.url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {data.loai_phong && <span style={st.tag}>{data.loai_phong}</span>}
          {data.quan_huyen && <span style={st.tag}>{data.quan_huyen}</span>}
          {data.khu_vuc && <span style={st.tag}>{data.khu_vuc}</span>}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: C.primary,
            marginBottom: 4,
          }}
        >
          {formatVND(data.gia)}/tháng
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>
          {data.dia_chi}
          {data.quan_huyen ? `, ${data.quan_huyen}` : ''}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            fontSize: 12,
            color: C.textMuted,
            marginBottom: 8,
          }}
        >
          {data.gia_dien && <span>Điện: {data.gia_dien}</span>}
          {data.gia_nuoc && <span>Nước: {data.gia_nuoc}</span>}
          {data.gia_internet && <span>Internet: {data.gia_internet}</span>}
        </div>
        {data.noi_that && (
          <div
            style={{
              fontSize: 12,
              color: C.textMuted,
              marginBottom: 4,
              lineHeight: 1.5,
            }}
          >
            Nội thất: {data.noi_that}
          </div>
        )}
        {data.ghi_chu && (
          <div
            style={{
              fontSize: 12,
              color: C.textMuted,
              lineHeight: 1.5,
              paddingTop: 8,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            {data.ghi_chu}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────
const st = {
  root: {
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
  },
  header: {
    background: `linear-gradient(135deg, ${C.bgCard} 0%, #0F1A14 100%)`,
    borderBottom: `1px solid ${C.border}`,
    padding: '12px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1400,
    margin: '0 auto',
  },
  logoGroup: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: {
    fontSize: 18,
    fontWeight: 900,
    color: '#fff',
    background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    borderRadius: 8,
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: 800, color: C.white, letterSpacing: -0.5 },
  logoSub: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  statusDot: (active) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: active ? C.primary : C.accent,
    boxShadow: `0 0 8px ${active ? C.primary : C.accent}`,
  }),
  statusText: { fontSize: 13, color: C.textMuted },
  main: { maxWidth: 1400, margin: '0 auto', padding: '24px 24px 60px' },
  errorBanner: {
    background: `${C.error}22`,
    border: `1px solid ${C.error}`,
    borderRadius: 8,
    padding: '10px 16px',
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#f87171',
    fontSize: 13,
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 700,
  },
  inputLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: 24,
    alignItems: 'start',
  },
  inputLeft: { display: 'flex', flexDirection: 'column', gap: 16 },
  inputRight: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    position: 'sticky',
    top: 80,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
    margin: '0 0 4px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  stepNum: {
    background: C.primary,
    color: C.bg,
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
  },
  inputZone: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 16,
  },
  zoneHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  zoneIcon: (type) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
    color: '#fff',
    background:
      type === 'text'
        ? `linear-gradient(135deg, ${C.blue}, #60A5FA)`
        : type === 'image'
        ? `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`
        : `linear-gradient(135deg, ${C.purple}, #B35CFF)`,
  }),
  zoneTitle: { fontSize: 14, fontWeight: 700, color: C.text },
  zoneDesc: { fontSize: 11, color: C.textMuted },
  fileCount: (n) => ({
    marginLeft: 'auto',
    background: n > 0 ? C.primary : C.border,
    color: n > 0 ? C.bg : C.textMuted,
    borderRadius: 12,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 700,
  }),
  textarea: {
    width: '100%',
    minHeight: 160,
    background: C.bgInput,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 12,
    color: C.text,
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  },
  charCount: { fontSize: 11, color: C.textMuted, textAlign: 'right', marginTop: 4 },
  dropZone: {
    border: `2px dashed ${C.border}`,
    borderRadius: 8,
    padding: 16,
    cursor: 'pointer',
    background: C.bgInput,
    minHeight: 80,
  },
  dropPlaceholder: {
    textAlign: 'center',
    color: C.textMuted,
    fontSize: 13,
    padding: '12px 0',
  },
  dropIcon: { fontSize: 28, marginBottom: 6 },
  dropHint: { fontSize: 11, color: C.textDim, marginTop: 4 },
  thumbGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: 8,
  },
  thumbItem: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
    aspectRatio: '1',
    background: C.bgCard,
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  thumbAdd: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: `2px dashed ${C.border}`,
    color: C.textMuted,
    fontSize: 24,
    aspectRatio: '1',
    cursor: 'pointer',
  },
  videoList: { display: 'flex', flexDirection: 'column', gap: 8 },
  videoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: C.bgCard,
    borderRadius: 8,
    padding: 8,
    position: 'relative',
  },
  videoThumb: {
    width: 64,
    height: 44,
    borderRadius: 4,
    objectFit: 'cover',
    background: '#000',
  },
  videoName: {
    fontSize: 12,
    fontWeight: 600,
    color: C.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200,
  },
  videoSize: { fontSize: 11, color: C.textMuted },
  addVideoBtn: {
    textAlign: 'center',
    color: C.purple,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 8,
    borderRadius: 6,
    border: `1px dashed ${C.purple}44`,
  },
  processBtn: (loading, disabled) => ({
    width: '100%',
    padding: '14px 24px',
    borderRadius: 10,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: loading
      ? C.border
      : disabled
      ? C.bgCard
      : `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    color: loading || disabled ? C.textMuted : C.bg,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.3,
    opacity: disabled ? 0.5 : 1,
  }),
  statusCard: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 20,
  },
  statusIdle: { textAlign: 'center' },
  workflow: { textAlign: 'left', paddingTop: 16 },
  wfStep: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  summaryItem: {
    background: C.bgCard,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    padding: '12px 8px',
    textAlign: 'center',
  },
  reviewLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    alignItems: 'start',
  },
  formGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 20,
  },
  formLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: C.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    width: '100%',
    padding: '8px 10px',
    background: C.bgInput,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: C.text,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  formRow: { display: 'flex', gap: 12 },
  tag: {
    background: C.border,
    color: C.text,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  tagGreen: {
    background: C.primaryBg,
    color: C.primary,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  galleryNav: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    padding: '12px 20px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textMuted,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    color: C.bg,
    fontSize: 14,
    fontWeight: 700,
  },
};
