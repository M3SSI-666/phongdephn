import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { C, formatVND, formatVNDFull } from '../utils/theme';
import { fetchRoomsFromSheets } from '../utils/api';

/* ── Inject responsive CSS ── */
const RD_STYLE_ID = 'roomdetail-responsive';
if (typeof document !== 'undefined' && !document.getElementById(RD_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RD_STYLE_ID;
  style.textContent = `
    @media (max-width: 768px) {
      .rd-layout { grid-template-columns: 1fr !important; }
      .rd-contact { position: static !important; }
      .rd-main-media { aspect-ratio: 16/10 !important; }
      .rd-suggest-grid { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 480px) {
      .rd-suggest-grid { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
}

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState(0);

  useEffect(() => {
    fetchRoomsFromSheets()
      .then((rooms) => {
        setAllRooms(rooms);
        const found = rooms.find((r) => String(r.id) === id);
        setRoom(found || null);
      })
      .catch(() => setRoom(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={s.loading}>Đang tải...</div>;
  if (!room) return <div style={s.loading}>Không tìm thấy phòng</div>;

  const allMedia = [
    ...(room.videos || []).map((u) => ({ type: 'video', url: u })),
    ...(room.images || []).map((u) => ({ type: 'image', url: u })),
  ];

  const zaloLink = `https://zalo.me/0961685136`;

  // Phòng gợi ý: ưu tiên cùng khu vực, rồi cùng quận/huyện, giá ±30%
  const suggestedRooms = (() => {
    const norm = (s) => (s || '').trim().toLowerCase();
    const priceFit = (r) => Math.abs(r.gia - room.gia) / (room.gia || 1) <= 0.3;
    const notSelf = (r) => r.id !== room.id;

    // Ưu tiên 1: cùng khu vực + giá tương đồng
    const sameKhuVuc = allRooms.filter((r) =>
      notSelf(r) && norm(r.khu_vuc) === norm(room.khu_vuc) && room.khu_vuc && priceFit(r)
    );
    if (sameKhuVuc.length >= 4) return sameKhuVuc.slice(0, 4);

    // Ưu tiên 2: cùng quận/huyện + giá tương đồng
    const usedIds = new Set(sameKhuVuc.map((r) => r.id));
    const sameQuan = allRooms.filter((r) =>
      notSelf(r) && !usedIds.has(r.id) && norm(r.quan_huyen) === norm(room.quan_huyen) && room.quan_huyen && priceFit(r)
    );

    return [...sameKhuVuc, ...sameQuan].slice(0, 4);
  })();

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <Link to="/" style={s.logo}>
            <div style={s.logoMark}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10.5Z" fill="white" fillOpacity="0.9"/>
                <path d="M9 21V13H15V21" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={s.logoText}>PHÒNG ĐẸP</div>
              <div style={s.logoSlogan}>GIÁ YÊU</div>
            </div>
          </Link>
          <Link to="/" style={s.backLink}>
            ← Quay lại danh sách
          </Link>
        </div>
      </header>

      <main style={s.main}>
        <div className="rd-layout" style={s.layout}>
          {/* Left - Media + Info */}
          <div>
            {/* Gallery */}
            {allMedia.length > 0 && (
              <div style={s.gallery}>
                <div className="rd-main-media" style={s.mainMedia}>
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
                {room.quan_huyen && <span style={s.tag}>{room.quan_huyen}</span>}
                {room.khu_vuc && <span style={s.tagGreen}>{room.khu_vuc}</span>}
              </div>

              <h1 style={s.title}>
                {room.loai_phong || 'Phòng trọ'} - {room.dia_chi}
                {room.quan_huyen ? `, ${room.quan_huyen}` : ''}
              </h1>

              <div style={s.price}>{formatVND(room.gia)}/tháng</div>

              {room.id && (
                <div style={{ fontSize: 14, marginBottom: 16 }}>
                  <span style={{ fontWeight: 800, color: C.error }}>Mã phòng: {room.id}</span>
                </div>
              )}

              {/* Chi phí điện / nước / internet - 1 dòng */}
              <div style={s.utilityRow}>
                <div style={s.utilityItem}>
                  <span style={s.utilityLabel}>Điện</span>
                  <span style={s.utilityValue}>{room.gia_dien || '-'}</span>
                </div>
                <div style={s.utilityDivider} />
                <div style={s.utilityItem}>
                  <span style={s.utilityLabel}>Nước</span>
                  <span style={s.utilityValue}>{room.gia_nuoc || '-'}</span>
                </div>
                <div style={s.utilityDivider} />
                <div style={s.utilityItem}>
                  <span style={s.utilityLabel}>Internet</span>
                  <span style={s.utilityValue}>{room.gia_internet || '-'}</span>
                </div>
              </div>

              {/* Dịch vụ chung - dòng riêng */}
              <div style={s.serviceSection}>
                <h3 style={s.sectionTitle}>Phí dịch vụ chung</h3>
                <p style={s.sectionText}>{room.dich_vu_chung || '-'}</p>
              </div>

              {room.noi_that && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>Nội thất</h3>
                  <p style={s.sectionText}>{room.noi_that}</p>
                </div>
              )}

              {room.ghi_chu && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>Ghi chú</h3>
                  <ul style={s.noteList}>
                    {room.ghi_chu.split(',').map((item, i) => {
                      const trimmed = item.trim();
                      return trimmed ? <li key={i} style={s.noteItem}>{trimmed}</li> : null;
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right - Contact */}
          <div className="rd-contact" style={s.contactCard}>
            <div style={s.contactTitle}>Liên hệ xem phòng</div>
            <div style={s.contactPrice}>
              {formatVNDFull(room.gia)}
              <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>
                /tháng
              </span>
            </div>
            <div style={s.contactAddr}>
              {room.dia_chi}
              {room.quan_huyen ? `, ${room.quan_huyen}` : ''}
            </div>

            <a href={zaloLink} target="_blank" rel="noopener noreferrer" style={s.zaloBtn}>
              Đặt lịch xem phòng tại đây
            </a>

            <div style={s.contactNote}>
              Nói <span style={{ fontWeight: 800, color: C.error }}>Mã phòng: {room.id || 'N/A'}</span> để được hỗ trợ nhanh hơn
            </div>
          </div>
        </div>

        {/* Phòng gợi ý */}
        {suggestedRooms.length > 0 && (
          <div style={s.suggestSection}>
            <h2 style={s.suggestTitle}>Các phòng bạn có thể quan tâm</h2>
            <div className="rd-suggest-grid" style={s.suggestGrid}>
              {suggestedRooms.map((r) => (
                <Link key={r.id} to={`/phong/${r.id}`} style={s.suggestCard} onClick={() => window.scrollTo(0, 0)}>
                  <div style={s.suggestMedia}>
                    {r.images?.[0] ? (
                      <img src={r.images[0]} alt="" style={s.suggestImg} loading="lazy" />
                    ) : (
                      <div style={s.suggestNoImg}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      </div>
                    )}
                    <div style={s.suggestPriceTag}>{formatVND(r.gia)}/th</div>
                  </div>
                  <div style={s.suggestBody}>
                    <div style={s.suggestAddr}>{r.dia_chi}</div>
                    <div style={s.suggestMeta}>
                      {r.loai_phong && <span style={s.suggestMetaTag}>{r.loai_phong}</span>}
                      <span style={s.suggestMetaTag}>{r.khu_vuc}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const FONT = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const s = {
  page: {
    fontFamily: FONT,
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
    fontFamily: FONT,
    background: C.bg,
  },
  header: {
    background: C.bgCard,
    borderBottom: `1px solid ${C.border}`,
    padding: '10px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: C.shadow,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1200,
    margin: '0 auto',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 9,
    background: C.gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: C.shadowGreen,
  },
  logoText: {
    fontSize: 15,
    fontWeight: 800,
    color: C.primaryDark,
    letterSpacing: 0.5,
    lineHeight: 1.1,
    fontFamily: FONT,
  },
  logoSlogan: {
    fontSize: 11,
    fontWeight: 700,
    color: C.accent,
    letterSpacing: 1.2,
    lineHeight: 1.2,
    fontFamily: FONT,
  },
  backLink: {
    fontSize: 13,
    color: C.primary,
    textDecoration: 'none',
    fontWeight: 600,
    fontFamily: FONT,
  },
  main: { maxWidth: 1200, margin: '0 auto', padding: '16px 12px 60px' },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: 20,
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
    background: C.bg,
    color: C.text,
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${C.border}`,
  },
  tagGreen: {
    background: C.primaryBg,
    color: C.primaryDark,
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  title: { fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8, lineHeight: 1.3 },
  price: { fontSize: 26, fontWeight: 900, color: C.primary, marginBottom: 20 },
  utilityRow: {
    display: 'flex',
    alignItems: 'center',
    background: C.bg,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    padding: '12px 0',
    marginBottom: 16,
  },
  utilityItem: {
    flex: 1,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  utilityLabel: { fontSize: 11, color: C.textMuted, fontWeight: 600 },
  utilityValue: { fontSize: 13, fontWeight: 700, color: C.text },
  utilityDivider: {
    width: 1,
    height: 28,
    background: C.border,
    flexShrink: 0,
  },
  serviceSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: `1px solid ${C.border}`,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    marginBottom: 6,
  },
  sectionText: { fontSize: 13, color: C.textMuted, lineHeight: 1.6 },
  noteList: {
    margin: 0,
    paddingLeft: 18,
    listStyleType: 'disc',
  },
  noteItem: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 1.8,
  },
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
    background: C.gradient,
    color: '#fff',
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

  /* ── Phòng gợi ý ── */
  suggestSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: `1px solid ${C.border}`,
  },
  suggestTitle: {
    fontSize: 18, fontWeight: 800, color: C.text,
    marginBottom: 16, fontFamily: FONT,
  },
  suggestGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  suggestCard: {
    background: C.bgCard, borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: 'hidden', textDecoration: 'none', color: 'inherit',
    boxShadow: C.shadow,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  suggestMedia: {
    position: 'relative', aspectRatio: '16/10',
    background: '#F1F5F9', overflow: 'hidden',
  },
  suggestImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  suggestNoImg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', background: '#F1F5F9',
  },
  suggestPriceTag: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
    padding: '16px 12px 8px',
    color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: FONT,
  },
  suggestBody: { padding: '10px 12px 12px' },
  suggestAddr: {
    fontSize: 13, color: C.text, fontWeight: 500,
    marginBottom: 6, lineHeight: 1.4, fontFamily: FONT,
  },
  suggestMeta: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  suggestMetaTag: {
    background: C.primaryBg, color: C.primaryDark,
    padding: '2px 8px', borderRadius: 4,
    fontSize: 11, fontWeight: 600, fontFamily: FONT,
  },
};
