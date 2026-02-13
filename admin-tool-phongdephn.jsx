import { useState, useRef, useCallback } from "react";

// ============================================================
// ADMIN TOOL - PHÒNG ĐẸP HN
// Theme: Cốc Cốc Green #88C646
// ============================================================

const SAMPLE_PARSE_RESULT = {
  ma_toa: "F066",
  dia_chi: "Ngõ 690 Lạc Long Quân",
  quan: "Tây Hồ",
  khu_vuc: "Lạc Long Quân",
  gia: 4500000,
  dien_tich: 20,
  loai_phong: "CCMN",
  khep_kin: true,
  xe_dien: false,
  pet: false,
  dien: "4.000đ/số",
  nuoc: "300.000đ chung",
  internet: "Miễn phí",
  noi_that: "Điều hoà, nóng lạnh, giường tủ, kệ bếp, máy giặt chung, tủ lạnh",
  mo_ta: "Phòng đơn khép kín tầng 3, thang máy. Ngõ xe ba gác, gần Hồ Tây.",
  hoa_hong: "12 tháng, 35%",
  confidence: { quan: "high", gia: "high", loai_phong: "medium", dien_tich: "low" },
};

const QUAN_LIST = [
  "Đống Đa", "Cầu Giấy", "Nam Từ Liêm", "Bắc Từ Liêm",
  "Thanh Xuân", "Hai Bà Trưng", "Hoàng Mai", "Hà Đông",
  "Tây Hồ", "Ba Đình", "Hoàn Kiếm", "Long Biên",
];
const LOAI_PHONG = ["Phòng trọ", "CCMN", "Studio", "Chung cư", "Homestay"];

const formatVND = (v) => {
  if (!v) return "";
  const num = Number(v);
  if (isNaN(num)) return v;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(".0", "") + " tr";
  if (num >= 1000) return (num / 1000).toFixed(0) + "k";
  return num.toString();
};

// Theme colors
const C = {
  primary: "#88C646",      // Cốc Cốc green
  primaryDark: "#6BA534",
  primaryLight: "#A3D96B",
  primaryBg: "#88C64612",
  primaryBgHover: "#88C64622",
  accent: "#FF7439",       // Cốc Cốc orange (secondary)
  bg: "#0B0F0D",
  bgCard: "#131A16",
  bgInput: "#0B0F0D",
  border: "#1E2E24",
  borderLight: "#2A3D32",
  text: "#E2EDE6",
  textMuted: "#7A9484",
  textDim: "#4D6656",
  white: "#FFFFFF",
  warn: "#D97706",
  error: "#DC2626",
  blue: "#3B82F6",
  purple: "#9333EA",
};

export default function AdminTool() {
  const [rawText, setRawText] = useState("");
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [phase, setPhase] = useState("input");
  const [parsedData, setParsedData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ images: 0, videos: 0, text: 0 });
  const [mediaUrls, setMediaUrls] = useState({ images: [], videos: [] });

  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

  const handleImageDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []).filter(f => f.type.startsWith("image/"));
    setImages(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f), id: Math.random().toString(36).slice(2) }))]);
  }, []);

  const handleVideoDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []).filter(f => f.type.startsWith("video/"));
    setVideos(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f), id: Math.random().toString(36).slice(2) }))]);
  }, []);

  const removeImage = (id) => setImages(prev => prev.filter(i => i.id !== id));
  const removeVideo = (id) => setVideos(prev => prev.filter(v => v.id !== id));

  const handleProcess = async () => {
    if (!rawText.trim()) return;
    setPhase("processing");
    setUploadProgress({ images: 0, videos: 0, text: 0 });

    const textPromise = new Promise(res => {
      let p = 0;
      const iv = setInterval(() => { p += Math.random() * 30; if (p >= 100) { p = 100; clearInterval(iv); res(); } setUploadProgress(prev => ({ ...prev, text: Math.min(p, 100) })); }, 200);
    });
    const imgPromise = new Promise(res => {
      if (images.length === 0) { setUploadProgress(prev => ({ ...prev, images: 100 })); res(); return; }
      let p = 0;
      const iv = setInterval(() => { p += Math.random() * 20; if (p >= 100) { p = 100; clearInterval(iv); res(); } setUploadProgress(prev => ({ ...prev, images: Math.min(p, 100) })); }, 150);
    });
    const vidPromise = new Promise(res => {
      if (videos.length === 0) { setUploadProgress(prev => ({ ...prev, videos: 100 })); res(); return; }
      let p = 0;
      const iv = setInterval(() => { p += Math.random() * 12; if (p >= 100) { p = 100; clearInterval(iv); res(); } setUploadProgress(prev => ({ ...prev, videos: Math.min(p, 100) })); }, 200);
    });

    await Promise.all([textPromise, imgPromise, vidPromise]);
    setParsedData({ ...SAMPLE_PARSE_RESULT });
    setMediaUrls({ images: images.map(i => i.preview), videos: videos.map(v => v.preview) });
    setTimeout(() => setPhase("review"), 400);
  };

  const handleConfirm = () => {
    setPhase("done");
    setTimeout(() => {
      setPhase("input");
      setRawText(""); setImages([]); setVideos([]);
      setParsedData(null); setMediaUrls({ images: [], videos: [] });
    }, 2500);
  };

  const handleReset = () => {
    setPhase("input");
    setRawText(""); setImages([]); setVideos([]); setParsedData(null);
  };

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logoGroup}>
            <div style={s.logoIcon}>🏠</div>
            <div>
              <div style={s.logoText}>Phòng Đẹp HN</div>
              <div style={s.logoSub}>Admin Tool</div>
            </div>
          </div>
          <div style={s.headerRight}>
            <div style={s.statusDot(phase === "done")} />
            <span style={s.statusText}>
              {phase === "input" ? "Sẵn sàng nhập" : phase === "processing" ? "Đang xử lý..." : phase === "review" ? "Chờ xác nhận" : "✓ Đã đẩy!"}
            </span>
          </div>
        </div>
      </header>

      <main style={s.main}>
        {(phase === "input" || phase === "processing") && (
          <div style={s.inputLayout}>
            <div style={s.inputLeft}>
              <h2 style={s.sectionTitle}><span style={s.stepNum}>①</span> Nhập liệu</h2>

              {/* TEXT */}
              <div style={s.inputZone}>
                <div style={s.zoneHeader}>
                  <div style={s.zoneIcon("text")}>T</div>
                  <div>
                    <div style={s.zoneTitle}>Text từ Zalo</div>
                    <div style={s.zoneDesc}>Paste toàn bộ tin nhắn phòng</div>
                  </div>
                </div>
                <textarea
                  style={s.textarea}
                  placeholder={"Paste tin nhắn từ Zalo vào đây...\n\nVí dụ:\n📋 Mã Toà Nhà: F066\n📍 Địa Chỉ: Ngõ 690 Lạc Long Quân\n🏢 Quận: Tây Hồ\n💰 Giá Phòng: 4tr5..."}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  disabled={phase === "processing"}
                />
                {rawText && <div style={s.charCount}>{rawText.length} ký tự</div>}
              </div>

              {/* IMAGES */}
              <div style={s.inputZone}>
                <div style={s.zoneHeader}>
                  <div style={s.zoneIcon("image")}>📷</div>
                  <div>
                    <div style={s.zoneTitle}>Ảnh phòng</div>
                    <div style={s.zoneDesc}>Kéo thả hoặc click • JPG, PNG, WebP</div>
                  </div>
                  <div style={s.fileCount(images.length)}>{images.length}</div>
                </div>
                <div style={s.dropZone} onDrop={handleImageDrop} onDragOver={e => e.preventDefault()} onClick={() => imgInputRef.current?.click()}>
                  <input ref={imgInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageDrop} />
                  {images.length === 0 ? (
                    <div style={s.dropPlaceholder}>
                      <div style={s.dropIcon}>🖼️</div>
                      <div>Kéo thả ảnh vào đây</div>
                      <div style={s.dropHint}>hoặc click để chọn file</div>
                    </div>
                  ) : (
                    <div style={s.thumbGrid}>
                      {images.map(img => (
                        <div key={img.id} style={s.thumbItem}>
                          <img src={img.preview} alt="" style={s.thumbImg} />
                          <button style={s.thumbRemove} onClick={e => { e.stopPropagation(); removeImage(img.id); }}>×</button>
                        </div>
                      ))}
                      <div style={s.thumbAdd}>+</div>
                    </div>
                  )}
                </div>
              </div>

              {/* VIDEO */}
              <div style={s.inputZone}>
                <div style={s.zoneHeader}>
                  <div style={s.zoneIcon("video")}>🎬</div>
                  <div>
                    <div style={s.zoneTitle}>Video phòng</div>
                    <div style={s.zoneDesc}>Kéo thả hoặc click • MP4, MOV</div>
                  </div>
                  <div style={s.fileCount(videos.length)}>{videos.length}</div>
                </div>
                <div style={s.dropZone} onDrop={handleVideoDrop} onDragOver={e => e.preventDefault()} onClick={() => vidInputRef.current?.click()}>
                  <input ref={vidInputRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={handleVideoDrop} />
                  {videos.length === 0 ? (
                    <div style={s.dropPlaceholder}>
                      <div style={s.dropIcon}>📹</div>
                      <div>Kéo thả video vào đây</div>
                      <div style={s.dropHint}>hoặc click để chọn file</div>
                    </div>
                  ) : (
                    <div style={s.videoList}>
                      {videos.map(vid => (
                        <div key={vid.id} style={s.videoItem}>
                          <video src={vid.preview} style={s.videoThumb} muted />
                          <div style={{ flex: 1 }}>
                            <div style={s.videoName}>{vid.file.name}</div>
                            <div style={s.videoSize}>{(vid.file.size / 1024 / 1024).toFixed(1)} MB</div>
                          </div>
                          <button style={s.thumbRemove} onClick={e => { e.stopPropagation(); removeVideo(vid.id); }}>×</button>
                        </div>
                      ))}
                      <div style={s.addVideoBtn} onClick={e => { e.stopPropagation(); vidInputRef.current?.click(); }}>+ Thêm video</div>
                    </div>
                  )}
                </div>
              </div>

              <button style={s.processBtn(phase === "processing", !rawText.trim())} onClick={handleProcess} disabled={phase === "processing" || !rawText.trim()}>
                {phase === "processing" ? "⏳ Đang xử lý..." : "⚡ Xử lý tự động"}
              </button>
            </div>

            {/* RIGHT PANEL */}
            <div style={s.inputRight}>
              <h2 style={s.sectionTitle}><span style={s.stepNum}>②</span> Trạng thái</h2>
              <div style={s.statusCard}>
                {phase === "input" ? (
                  <div style={s.statusIdle}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Paste text và thả ảnh/video</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, marginBottom: 20 }}>Nhấn "Xử lý tự động" khi xong</div>
                    <div style={s.workflow}>
                      {[
                        ["🤖", "AI Parse text", "Claude đọc tin nhắn → trích xuất JSON"],
                        ["☁️", "Upload ảnh → Cloudinary", "Optimize + lấy URL"],
                        ["🎥", "Upload video → Cloudinary", "Transcode + nén + lấy URL"],
                        ["✅", "Review & Xác nhận", "Kiểm tra → đẩy vào Google Sheets"],
                      ].map(([icon, title, desc], i) => (
                        <div key={i}>
                          {i > 0 && <div style={{ textAlign: "center", color: C.border, fontSize: 14, padding: "2px 0" }}>↓</div>}
                          <div style={s.wfStep}>
                            <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>{icon}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>{desc}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <ProgressRow label="🤖 AI Parse text" progress={uploadProgress.text} />
                    <ProgressRow label={`☁️ Upload ${images.length} ảnh`} progress={uploadProgress.images} />
                    <ProgressRow label={`🎥 Upload ${videos.length} video`} progress={uploadProgress.videos} />
                    <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      3 luồng chạy song song • ~15-20 giây
                    </div>
                  </div>
                )}
              </div>
              <div style={s.summaryGrid}>
                {[["Text", rawText.length > 0 ? "1" : "0"], ["Ảnh", images.length], ["Video", videos.length]].map(([label, num]) => (
                  <div key={label} style={s.summaryItem}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{num}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REVIEW */}
        {phase === "review" && parsedData && (
          <div style={s.reviewLayout}>
            <div>
              <h2 style={s.sectionTitle}><span style={s.stepNum}>③</span> Kiểm tra & Sửa</h2>
              <ReviewForm data={parsedData} onChange={setParsedData} />
            </div>
            <div style={{ position: "sticky", top: 80 }}>
              <h2 style={s.sectionTitle}><span style={s.stepNum}>④</span> Preview trên Website</h2>
              <WebsitePreview data={parsedData} images={mediaUrls.images} videos={mediaUrls.videos} />
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button style={s.backBtn} onClick={handleReset}>← Nhập lại</button>
                <button style={s.confirmBtn} onClick={handleConfirm}>✓ Xác nhận & Đẩy vào Sheet</button>
              </div>
            </div>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, marginBottom: 8 }}>Đã đẩy thành công!</div>
              <div style={{ fontSize: 14, color: C.textMuted }}>Phòng đã được thêm vào Google Sheets & Website</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function ProgressRow({ label, progress }) {
  const done = progress >= 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, width: 130, flexShrink: 0 }}>
        {label} {done && <span style={{ color: C.primary }}>✓</span>}
      </div>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, transition: "width 0.3s", background: done ? C.primary : `linear-gradient(90deg, ${C.primaryDark}, ${C.primary})` }} />
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, width: 36, textAlign: "right" }}>{Math.round(progress)}%</div>
    </div>
  );
}

function ReviewForm({ data, onChange }) {
  const update = (key, val) => onChange(prev => ({ ...prev, [key]: val }));
  const conf = data.confidence || {};
  const fi = (key) => ({ ...s.formInput, ...(conf[key] === "low" ? { borderColor: C.error, background: `${C.error}11` } : conf[key] === "medium" ? { borderColor: C.warn, background: `${C.warn}11` } : {}) });

  return (
    <div style={s.formGrid}>
      <div><label style={s.formLabel}>Mã toà nhà</label><input style={s.formInput} value={data.ma_toa || ""} onChange={e => update("ma_toa", e.target.value)} /></div>
      <div><label style={s.formLabel}>Địa chỉ</label><input style={s.formInput} value={data.dia_chi || ""} onChange={e => update("dia_chi", e.target.value)} /></div>
      <div style={s.formRow}>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Quận <ConfBadge level={conf.quan} /></label><select style={fi("quan")} value={data.quan || ""} onChange={e => update("quan", e.target.value)}><option value="">-- Chọn --</option>{QUAN_LIST.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Khu vực</label><input style={s.formInput} value={data.khu_vuc || ""} onChange={e => update("khu_vuc", e.target.value)} /></div>
      </div>
      <div style={s.formRow}>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Giá (VNĐ) <ConfBadge level={conf.gia} /></label><input style={fi("gia")} type="number" value={data.gia || ""} onChange={e => update("gia", Number(e.target.value))} /></div>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Diện tích (m²) <ConfBadge level={conf.dien_tich} /></label><input style={fi("dien_tich")} type="number" value={data.dien_tich || ""} onChange={e => update("dien_tich", Number(e.target.value))} /></div>
      </div>
      <div><label style={s.formLabel}>Loại phòng <ConfBadge level={conf.loai_phong} /></label><select style={fi("loai_phong")} value={data.loai_phong || ""} onChange={e => update("loai_phong", e.target.value)}><option value="">-- Chọn --</option>{LOAI_PHONG.map(l => <option key={l} value={l}>{l}</option>)}</select></div>

      <div style={{ display: "flex", gap: 16, padding: "8px 0" }}>
        {[["WC Khép kín", "khep_kin"], ["Xe điện", "xe_dien"], ["Nuôi Pet", "pet"]].map(([label, key]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }} onClick={() => update(key, !data[key])}>
            <div style={{ width: 38, height: 20, borderRadius: 10, background: data[key] ? C.primary : C.border, position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: data[key] ? 20 : 2, transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: 13, color: C.text }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={s.formRow}>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Điện</label><input style={s.formInput} value={data.dien || ""} onChange={e => update("dien", e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Nước</label><input style={s.formInput} value={data.nuoc || ""} onChange={e => update("nuoc", e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={s.formLabel}>Internet</label><input style={s.formInput} value={data.internet || ""} onChange={e => update("internet", e.target.value)} /></div>
      </div>
      <div><label style={s.formLabel}>Nội thất</label><textarea style={{ ...s.formInput, height: 56, resize: "vertical" }} value={data.noi_that || ""} onChange={e => update("noi_that", e.target.value)} /></div>
      <div><label style={s.formLabel}>Mô tả</label><textarea style={{ ...s.formInput, height: 56, resize: "vertical" }} value={data.mo_ta || ""} onChange={e => update("mo_ta", e.target.value)} /></div>
      <div><label style={s.formLabel}>Hoa hồng CTV</label><input style={s.formInput} value={data.hoa_hong || ""} onChange={e => update("hoa_hong", e.target.value)} /></div>

      <div style={{ display: "flex", gap: 16, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        {[["high", C.primary, "Chắc chắn"], ["medium", C.warn, "Cần kiểm tra"], ["low", C.error, "Không tìm thấy"]].map(([l, c, t]) => (
          <span key={l} style={{ fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfBadge({ level }) {
  if (!level || level === "high") return null;
  const color = level === "medium" ? C.warn : C.error;
  return <span style={{ background: color, color: "#fff", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{level === "medium" ? "?" : "!"}</span>;
}

function WebsitePreview({ data, images, videos }) {
  const [activeImg, setActiveImg] = useState(0);
  const allMedia = [...(images || []).map(u => ({ type: "image", url: u })), ...(videos || []).map(u => ({ type: "video", url: u }))];

  return (
    <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "8px 16px", background: C.bg, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>Preview</div>
      {allMedia.length > 0 && (
        <>
          <div style={{ position: "relative", background: "#000", aspectRatio: "16/10" }}>
            {allMedia[activeImg]?.type === "video" ? (
              <video src={allMedia[activeImg].url} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <img src={allMedia[activeImg]?.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            {allMedia.length > 1 && (
              <>
                <button style={{ ...s.galleryNav, left: 8 }} onClick={() => setActiveImg(i => (i - 1 + allMedia.length) % allMedia.length)}>‹</button>
                <button style={{ ...s.galleryNav, right: 8 }} onClick={() => setActiveImg(i => (i + 1) % allMedia.length)}>›</button>
              </>
            )}
            <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{activeImg + 1}/{allMedia.length}</div>
          </div>
          <div style={{ display: "flex", gap: 4, padding: 4, overflowX: "auto" }}>
            {allMedia.map((m, i) => (
              <div key={i} style={{ width: 56, height: 40, borderRadius: 4, overflow: "hidden", cursor: "pointer", flexShrink: 0, border: i === activeImg ? `2px solid ${C.primary}` : "2px solid transparent", opacity: i === activeImg ? 1 : 0.6 }} onClick={() => setActiveImg(i)}>
                {m.type === "video" ? (
                  <div style={{ position: "relative", width: "100%", height: "100%" }}>
                    <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#fff", fontSize: 12 }}>▶</div>
                  </div>
                ) : (
                  <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {data.loai_phong && <span style={s.tag}>{data.loai_phong}</span>}
          {data.quan && <span style={s.tag}>{data.quan}</span>}
          {data.khep_kin && <span style={s.tagGreen}>Khép kín</span>}
          {data.pet && <span style={s.tagGreen}>Pet OK</span>}
          {data.xe_dien && <span style={s.tagGreen}>Xe điện</span>}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, marginBottom: 4 }}>{formatVND(data.gia)}/tháng</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{data.dia_chi}{data.quan ? `, ${data.quan}` : ""}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
          {data.dien_tich && <span>{data.dien_tich}m²</span>}
          {data.dien && <span>⚡ {data.dien}</span>}
          {data.nuoc && <span>💧 {data.nuoc}</span>}
        </div>
        {data.noi_that && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4, lineHeight: 1.5 }}>🪑 {data.noi_that}</div>}
        {data.mo_ta && <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", lineHeight: 1.5, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>{data.mo_ta}</div>}
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const s = {
  root: { fontFamily: "'Nunito', 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", color: C.text },
  header: { background: `linear-gradient(135deg, ${C.bgCard} 0%, #0F1A14 100%)`, borderBottom: `1px solid ${C.border}`, padding: "12px 24px", position: "sticky", top: 0, zIndex: 100 },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1400, margin: "0 auto" },
  logoGroup: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { fontSize: 24, background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, borderRadius: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 18, fontWeight: 800, color: C.white, letterSpacing: -0.5 },
  logoSub: { fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  statusDot: (active) => ({ width: 8, height: 8, borderRadius: "50%", background: active ? C.primary : C.accent, boxShadow: `0 0 8px ${active ? C.primary : C.accent}` }),
  statusText: { fontSize: 13, color: C.textMuted },
  main: { maxWidth: 1400, margin: "0 auto", padding: "24px 24px 60px" },

  inputLayout: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" },
  inputLeft: { display: "flex", flexDirection: "column", gap: 16 },
  inputRight: { display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 80 },

  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 },
  stepNum: { background: C.primary, color: C.bg, width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 },

  inputZone: { background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 },
  zoneHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  zoneIcon: (type) => ({
    width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff",
    background: type === "text" ? `linear-gradient(135deg, ${C.blue}, #60A5FA)` : type === "image" ? `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})` : `linear-gradient(135deg, ${C.purple}, #B35CFF)`,
  }),
  zoneTitle: { fontSize: 14, fontWeight: 700, color: C.text },
  zoneDesc: { fontSize: 11, color: C.textMuted },
  fileCount: (n) => ({ marginLeft: "auto", background: n > 0 ? C.primary : C.border, color: n > 0 ? C.bg : C.textMuted, borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700 }),

  textarea: { width: "100%", minHeight: 160, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box" },
  charCount: { fontSize: 11, color: C.textMuted, textAlign: "right", marginTop: 4 },

  dropZone: { border: `2px dashed ${C.border}`, borderRadius: 8, padding: 16, cursor: "pointer", background: C.bgInput, minHeight: 80 },
  dropPlaceholder: { textAlign: "center", color: C.textMuted, fontSize: 13, padding: "12px 0" },
  dropIcon: { fontSize: 28, marginBottom: 6 },
  dropHint: { fontSize: 11, color: C.textDim, marginTop: 4 },

  thumbGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 },
  thumbItem: { position: "relative", borderRadius: 6, overflow: "hidden", aspectRatio: "1", background: C.bgCard },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover" },
  thumbRemove: { position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 },
  thumbAdd: { display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: `2px dashed ${C.border}`, color: C.textMuted, fontSize: 24, aspectRatio: "1", cursor: "pointer" },

  videoList: { display: "flex", flexDirection: "column", gap: 8 },
  videoItem: { display: "flex", alignItems: "center", gap: 10, background: C.bgCard, borderRadius: 8, padding: 8, position: "relative" },
  videoThumb: { width: 64, height: 44, borderRadius: 4, objectFit: "cover", background: "#000" },
  videoName: { fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 },
  videoSize: { fontSize: 11, color: C.textMuted },
  addVideoBtn: { textAlign: "center", color: C.purple, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 8, borderRadius: 6, border: `1px dashed ${C.purple}44` },

  processBtn: (loading, disabled) => ({
    width: "100%", padding: "14px 24px", borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: loading ? C.border : disabled ? C.bgCard : `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    color: loading || disabled ? C.textMuted : C.bg, fontSize: 15, fontWeight: 700, letterSpacing: 0.3, opacity: disabled ? 0.5 : 1,
  }),

  statusCard: { background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 },
  statusIdle: { textAlign: "center" },
  workflow: { textAlign: "left", paddingTop: 16 },
  wfStep: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0" },

  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  summaryItem: { background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 8px", textAlign: "center" },

  reviewLayout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" },

  formGrid: { display: "flex", flexDirection: "column", gap: 12, background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 },
  formLabel: { display: "block", fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  formInput: { width: "100%", padding: "8px 10px", background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  formRow: { display: "flex", gap: 12 },

  tag: { background: C.border, color: C.text, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  tagGreen: { background: C.primaryBg, color: C.primary, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },

  galleryNav: { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" },

  backBtn: { padding: "12px 20px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  confirmBtn: { flex: 1, padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, color: C.bg, fontSize: 14, fontWeight: 700 },
};
