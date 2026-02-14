import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { C, QUAN_LIST, LOAI_PHONG, formatVND } from '../utils/theme';
import { fetchRoomsFromSheets } from '../utils/api';

const PRICE_RANGES = [
  { label: 'Tất cả', min: 0, max: Infinity },
  { label: 'Dưới 3 triệu', min: 0, max: 3000000 },
  { label: '3 - 5 triệu', min: 3000000, max: 5000000 },
  { label: '5 - 7 triệu', min: 5000000, max: 7000000 },
  { label: '7 - 10 triệu', min: 7000000, max: 10000000 },
  { label: 'Trên 10 triệu', min: 10000000, max: Infinity },
];

export default function RoomList() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    quan_huyen: '',
    loai_phong: '',
    priceRange: 0,
    search: '',
  });

  useEffect(() => {
    fetchRoomsFromSheets()
      .then(setRooms)
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const range = PRICE_RANGES[filters.priceRange];
    return rooms.filter((r) => {
      if (filters.quan_huyen && r.quan_huyen !== filters.quan_huyen) return false;
      if (filters.loai_phong && r.loai_phong !== filters.loai_phong) return false;
      if (r.gia < range.min || r.gia > range.max) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${r.dia_chi} ${r.quan_huyen} ${r.khu_vuc} ${r.noi_that} ${r.ghi_chu}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rooms, filters]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <Link to="/" style={s.logo}>
            <div style={s.logoIcon}>P</div>
            <div>
              <div style={s.logoText}>Phòng Đẹp HN</div>
              <div style={s.logoSub}>Tìm phòng trọ Hà Nội</div>
            </div>
          </Link>
          <div style={s.headerContact}>
            <span style={{ fontSize: 13, color: C.textMuted }}>Zalo: 0961 685 136</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={s.hero}>
        <h1 style={s.heroTitle}>Tìm phòng trọ đẹp tại Hà Nội</h1>
        <p style={s.heroDesc}>
          {rooms.length}+ phòng được cập nhật hàng ngày. Lọc theo quận, giá, loại phòng.
        </p>
        <div style={s.searchBar}>
          <input
            style={s.searchInput}
            placeholder="Tìm theo địa chỉ, khu vực..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>
      </div>

      <main style={s.main}>
        <div style={s.layout}>
          {/* Sidebar filters */}
          <aside style={s.sidebar}>
            <h3 style={s.filterTitle}>Bộ lọc</h3>

            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Quận/Huyện</label>
              <select
                style={s.filterSelect}
                value={filters.quan_huyen}
                onChange={(e) => updateFilter('quan_huyen', e.target.value)}
              >
                <option value="">Tất cả</option>
                {QUAN_LIST.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Loại phòng</label>
              <select
                style={s.filterSelect}
                value={filters.loai_phong}
                onChange={(e) => updateFilter('loai_phong', e.target.value)}
              >
                <option value="">Tất cả</option>
                {LOAI_PHONG.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Mức giá</label>
              {PRICE_RANGES.map((range, i) => (
                <div
                  key={i}
                  style={s.radioItem(filters.priceRange === i)}
                  onClick={() => updateFilter('priceRange', i)}
                >
                  <div style={s.radio(filters.priceRange === i)} />
                  <span>{range.label}</span>
                </div>
              ))}
            </div>

            <button
              style={s.resetBtn}
              onClick={() =>
                setFilters({
                  quan_huyen: '',
                  loai_phong: '',
                  priceRange: 0,
                  search: '',
                })
              }
            >
              Xoá bộ lọc
            </button>
          </aside>

          {/* Room grid */}
          <div style={s.content}>
            <div style={s.resultBar}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                {filtered.length} phòng
              </span>
            </div>

            {loading ? (
              <div style={s.emptyState}>Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>--</div>
                <div>Không tìm thấy phòng phù hợp</div>
                <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                  Thử điều chỉnh bộ lọc
                </div>
              </div>
            ) : (
              <div style={s.roomGrid}>
                {filtered.map((room, i) => (
                  <RoomCard key={room.id || i} room={room} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Phòng Đẹp HN - Tìm phòng trọ đẹp, giá tốt tại Hà Nội
          </div>
          <div style={{ fontSize: 13, color: C.textDim }}>Zalo: 0961 685 136</div>
        </div>
      </footer>
    </div>
  );
}

function RoomCard({ room }) {
  const mainImage = room.images?.[0];

  return (
    <Link to={`/phong/${room.id}`} style={s.card}>
      <div style={s.cardImage}>
        {mainImage ? (
          <img src={mainImage} alt="" style={s.cardImg} />
        ) : (
          <div style={s.cardNoImg}>Chưa có ảnh</div>
        )}
        {room.images?.length > 1 && (
          <div style={s.cardImgCount}>{room.images.length} ảnh</div>
        )}
      </div>
      <div style={s.cardBody}>
        <div style={s.cardTags}>
          {room.loai_phong && <span style={s.cardTag}>{room.loai_phong}</span>}
          {room.quan_huyen && <span style={s.cardTag}>{room.quan_huyen}</span>}
          {room.khu_vuc && <span style={s.cardTagGreen}>{room.khu_vuc}</span>}
        </div>
        <div style={s.cardPrice}>{formatVND(room.gia)}/tháng</div>
        <div style={s.cardAddr}>
          {room.dia_chi}
          {room.quan_huyen ? `, ${room.quan_huyen}` : ''}
        </div>
        <div style={s.cardMeta}>
          <span>Điện: {room.gia_dien || '-'}</span>
          <span>Nước: {room.gia_nuoc || '-'}</span>
          <span>Net: {room.gia_internet || '-'}</span>
        </div>
        {room.id && (
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
            {room.id}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Styles ──────────────────────────────────────────────────
const s = {
  page: {
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
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
    maxWidth: 1400,
    margin: '0 auto',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
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
  },
  headerContact: { display: 'flex', alignItems: 'center', gap: 8 },
  hero: {
    textAlign: 'center',
    padding: '40px 24px 32px',
    background: `linear-gradient(180deg, ${C.bgCard} 0%, ${C.bg} 100%)`,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: C.white,
    marginBottom: 8,
  },
  heroDesc: { fontSize: 14, color: C.textMuted, marginBottom: 20 },
  searchBar: { maxWidth: 500, margin: '0 auto' },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    background: C.bgInput,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    color: C.text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  main: { maxWidth: 1400, margin: '0 auto', padding: '0 24px 60px' },
  layout: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' },
  sidebar: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 20,
    position: 'sticky',
    top: 80,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: `1px solid ${C.border}`,
  },
  filterGroup: { marginBottom: 16 },
  filterLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: C.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSelect: {
    width: '100%',
    padding: '8px 10px',
    background: C.bgInput,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: C.text,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  radioItem: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    cursor: 'pointer',
    fontSize: 13,
    color: active ? C.text : C.textMuted,
  }),
  radio: (active) => ({
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `2px solid ${active ? C.primary : C.border}`,
    background: active ? C.primary : 'transparent',
    flexShrink: 0,
  }),
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    cursor: 'pointer',
    fontSize: 13,
    color: C.text,
  },
  checkbox: (checked) => ({
    width: 16,
    height: 16,
    borderRadius: 4,
    border: `2px solid ${checked ? C.primary : C.border}`,
    background: checked ? C.primary : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: C.bg,
    fontWeight: 700,
    flexShrink: 0,
  }),
  resetBtn: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textMuted,
    fontSize: 12,
    cursor: 'pointer',
    marginTop: 8,
  },
  content: { minHeight: 400 },
  resultBar: { marginBottom: 16 },
  emptyState: {
    textAlign: 'center',
    padding: 60,
    color: C.textMuted,
    fontSize: 14,
  },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.2s',
  },
  cardImage: {
    position: 'relative',
    aspectRatio: '16/10',
    background: '#111',
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardNoImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: C.textDim,
    fontSize: 13,
  },
  cardImgCount: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  cardBody: { padding: 14 },
  cardTags: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  cardTag: {
    background: C.border,
    color: C.text,
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  cardTagGreen: {
    background: C.primaryBg,
    color: C.primary,
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: 800,
    color: C.primary,
    marginBottom: 4,
  },
  cardAddr: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  cardMeta: {
    display: 'flex',
    gap: 10,
    fontSize: 11,
    color: C.textDim,
  },
  footer: {
    borderTop: `1px solid ${C.border}`,
    padding: '20px 24px',
    background: C.bgCard,
  },
  footerInner: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
};
