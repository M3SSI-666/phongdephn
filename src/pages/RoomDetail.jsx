import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { C, formatVND, formatVNDFull } from '../utils/theme';
import { fetchRoomsFromSheets } from '../utils/api';

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState(0);

  useEffect(() => {
    fetchRoomsFromSheets()
      .then((rooms) => {
        const found = rooms.find((r) => String(r.id) === id);
        setRoom(found || null);
      })
      .catch(() => setRoom(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={s.loading}>Đang tải...</div>;
  if (!room) return <div style={s.loading}>Không tìm thấy phòng</div>;

  const allMedia = [
    ...(room.images || []).map((u) => ({ type: 'image', url: u })),
    ...(room.videos || []).map((u) => ({ type: 'video', url: u })),
  ];

  const zaloLink = `https://zalo.me/0961685136`;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <Link to="/" style={s.logo}>
            <div style={s.logoIcon}>P</div>
            <div style={s.logoText}>Phòng Đẹp HN</div>
          </Link>
          <Link to="/" style={s.backLink}>
            Quay lại danh sách
          </Link>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.layout}>
          {/* Left - Media + Info */}
          <div>
            {/* Gallery */}
            {allMedia.length > 0 && (
              <div style={s.gallery}>
                <div style={s.mainMedia}>
                  {allMedia[activeMedia]?.type === 'video' ? (
                    <video
                      src={allMedia[activeMedia].url}
                      controls
                      style={s.mainMediaContent}
                    />
                  ) : (
                    <img
                      src={allMedia[activeMedia]?.url}
                      alt=""
                      style={s.mainMediaContent}
                    />
                  )}
                  {allMedia.length > 1 && (
                    <>
                      <button
                        style={{ ...s.navBtn, left: 12 }}
                        onClick={() =>
                          setActiveMedia(
                            (i) => (i - 1 + allMedia.length) % allMedia.length
                          )
                        }
                      >
                        {'<'}
                      </button>
                      <button
                        style={{ ...s.navBtn, right: 12 }}
                        onClick={() =>
                          setActiveMedia((i) => (i + 1) % allMedia.length)
                        }
                      >
                        {'>'}
                      </button>
                    </>
                  )}
                  <div style={s.mediaCounter}>
                    {activeMedia + 1}/{allMedia.length}
                  </div>
                </div>
                {allMedia.length > 1 && (
                  <div style={s.thumbRow}>
                    {allMedia.map((m, i) => (
                      <div
                        key={i}
                        style={s.thumb(i === activeMedia)}
                        onClick={() => setActiveMedia(i)}
                      >
                        {m.type === 'video' ? (
                          <video src={m.url} style={s.thumbMedia} muted />
                        ) : (
                          <img src={m.url} alt="" style={s.thumbMedia} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Details */}
            <div style={s.detailCard}>
              <div style={s.tags}>
                {room.loai_phong && <span style={s.tag}>{room.loai_phong}</span>}
                {room.quan && <span style={s.tag}>{room.quan}</span>}
                {room.khep_kin && <span style={s.tagGreen}>Khép kín</span>}
                {room.pet && <span style={s.tagGreen}>Pet OK</span>}
                {room.xe_dien && <span style={s.tagGreen}>Xe điện</span>}
              </div>

              <h1 style={s.title}>
                {room.loai_phong || 'Phòng trọ'} - {room.dia_chi}
                {room.quan ? `, ${room.quan}` : ''}
              </h1>

              <div style={s.price}>{formatVND(room.gia)}/tháng</div>

              {/* Specs */}
              <div style={s.specsGrid}>
                {room.dien_tich && (
                  <div style={s.specItem}>
                    <div style={s.specLabel}>Diện tích</div>
                    <div style={s.specValue}>{room.dien_tich} m2</div>
                  </div>
                )}
                {room.dien && (
                  <div style={s.specItem}>
                    <div style={s.specLabel}>Điện</div>
                    <div style={s.specValue}>{room.dien}</div>
                  </div>
                )}
                {room.nuoc && (
                  <div style={s.specItem}>
                    <div style={s.specLabel}>Nước</div>
                    <div style={s.specValue}>{room.nuoc}</div>
                  </div>
                )}
                {room.internet && (
                  <div style={s.specItem}>
                    <div style={s.specLabel}>Internet</div>
                    <div style={s.specValue}>{room.internet}</div>
                  </div>
                )}
              </div>

              {room.noi_that && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>Nội thất</h3>
                  <p style={s.sectionText}>{room.noi_that}</p>
                </div>
              )}

              {room.mo_ta && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>Mô tả</h3>
                  <p style={s.sectionText}>{room.mo_ta}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right - Contact */}
          <div style={s.contactCard}>
            <div style={s.contactTitle}>Liên hệ xem phòng</div>
            <div style={s.contactPrice}>
              {formatVNDFull(room.gia)}
              <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>
                /tháng
              </span>
            </div>
            <div style={s.contactAddr}>
              {room.dia_chi}
              {room.quan ? `, ${room.quan}` : ''}
            </div>

            <a href={zaloLink} target="_blank" rel="noopener noreferrer" style={s.zaloBtn}>
              Nhắn Zalo xem phòng
            </a>
            <a href="tel:0961685136" style={s.phoneBtn}>
              Gọi: 0961 685 136
            </a>

            <div style={s.contactNote}>
              Nói mã phòng <strong>{room.ma_toa || 'N/A'}</strong> để được hỗ trợ nhanh hơn
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const s = {
  page: {
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: C.textMuted,
    fontFamily: "'Nunito', sans-serif",
    background: C.bg,
  },
  header: {
    background: C.bgCard,
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
    maxWidth: 1200,
    margin: '0 auto',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  logoIcon: {
    fontSize: 18,
    fontWeight: 900,
    color: '#fff',
    background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    borderRadius: 8,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 16, fontWeight: 800, color: C.white },
  backLink: {
    fontSize: 13,
    color: C.primary,
    textDecoration: 'none',
    fontWeight: 600,
  },
  main: { maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: 24,
    alignItems: 'start',
  },
  gallery: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mainMedia: { position: 'relative', aspectRatio: '16/10', background: '#000' },
  mainMediaContent: { width: '100%', height: '100%', objectFit: 'contain' },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
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
  mediaCounter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    padding: '2px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  thumbRow: { display: 'flex', gap: 4, padding: 4, overflowX: 'auto' },
  thumb: (active) => ({
    width: 72,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    border: active ? `2px solid ${C.primary}` : '2px solid transparent',
    opacity: active ? 1 : 0.6,
  }),
  thumbMedia: { width: '100%', height: '100%', objectFit: 'cover' },
  detailCard: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 24,
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: {
    background: C.border,
    color: C.text,
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  tagGreen: {
    background: C.primaryBg,
    color: C.primary,
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  title: { fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8, lineHeight: 1.3 },
  price: { fontSize: 26, fontWeight: 900, color: C.primary, marginBottom: 20 },
  specsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: `1px solid ${C.border}`,
  },
  specItem: {
    background: C.bg,
    borderRadius: 8,
    padding: '10px 14px',
    border: `1px solid ${C.border}`,
  },
  specLabel: { fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 2 },
  specValue: { fontSize: 14, fontWeight: 700, color: C.text },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    marginBottom: 6,
  },
  sectionText: { fontSize: 13, color: C.textMuted, lineHeight: 1.6 },
  contactCard: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 24,
    position: 'sticky',
    top: 80,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: `1px solid ${C.border}`,
  },
  contactPrice: {
    fontSize: 22,
    fontWeight: 800,
    color: C.primary,
    marginBottom: 4,
  },
  contactAddr: {
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 20,
    lineHeight: 1.4,
  },
  zaloBtn: {
    display: 'block',
    width: '100%',
    padding: '12px 0',
    borderRadius: 8,
    border: 'none',
    background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    color: C.bg,
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    textDecoration: 'none',
    marginBottom: 10,
    boxSizing: 'border-box',
  },
  phoneBtn: {
    display: 'block',
    width: '100%',
    padding: '12px 0',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.text,
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    textDecoration: 'none',
    marginBottom: 16,
    boxSizing: 'border-box',
  },
  contactNote: {
    fontSize: 12,
    color: C.textDim,
    textAlign: 'center',
    lineHeight: 1.5,
  },
};
