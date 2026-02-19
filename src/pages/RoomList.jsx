import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { C, QUAN_LIST, formatVND } from '../utils/theme';
import { fetchRoomsFromSheets } from '../utils/api';

/* ── Helpers ─────────────────────────────────────── */
const fmtPrice = (v) => {
  if (!v && v !== 0) return '';
  return Number(v).toLocaleString('vi-VN');
};
const parsePrice = (str) => {
  const cleaned = str.replace(/\./g, '').replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
};
const BANNER_URL = 'https://res.cloudinary.com/dhhdnqixb/image/upload/v1771376609/xyqawri4hmmexpnf5prj.png';

/* ── Inject CSS for hover & animations ────────────── */
const STYLE_ID = 'roomlist-pro-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .room-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
    .room-card:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(34,197,94,0.13), 0 4px 12px rgba(0,0,0,0.06) !important; }
    .filter-tag { transition: all 0.18s ease; }
    .filter-tag:hover { transform: scale(1.05); }
    .zalo-btn { transition: all 0.2s ease; }
    .zalo-btn:hover { transform: scale(1.04); box-shadow: 0 4px 16px rgba(34,197,94,0.3); }
    .multi-opt { transition: background 0.15s ease; }
    .multi-opt:hover { background: ${C.primaryBg} !important; }
    .search-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px ${C.primaryGlow} !important; }
    .filter-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px ${C.primaryGlow} !important; }
    @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .fade-in { animation: fadeInUp 0.3s ease forwards; }
    .rl-desktop-header { display: flex; }
    .rl-mobile-banner { display: none; }
    @media (max-width: 768px) {
      .rl-desktop-header { display: none !important; }
      .rl-mobile-banner { display: block !important; }
      .rl-filter-card { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
      .rl-filter-card > div { min-width: 0 !important; }
      .rl-grid { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export default function RoomList() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuan, setSelectedQuan] = useState([]);
  const [selectedKhuVuc, setSelectedKhuVuc] = useState([]);
  const [priceMin, setPriceMin] = useState(2000000);
  const [priceMax, setPriceMax] = useState(15000000);
  const [priceMinText, setPriceMinText] = useState('2.000.000');
  const [priceMaxText, setPriceMaxText] = useState('15.000.000');
  const [sort, setSort] = useState('price_asc');

  useEffect(() => {
    fetchRoomsFromSheets()
      .then(setRooms)
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const khuVucOptions = useMemo(() => {
    const map = new Map();
    rooms.forEach((r) => {
      if (!r.khu_vuc) return;
      if (selectedQuan.length > 0 && !selectedQuan.includes(r.quan_huyen)) return;
      const key = `${r.khu_vuc}|||${r.quan_huyen}`;
      if (!map.has(key)) map.set(key, { khu_vuc: r.khu_vuc, quan_huyen: r.quan_huyen });
    });
    return Array.from(map.values()).sort((a, b) => a.khu_vuc.localeCompare(b.khu_vuc, 'vi'));
  }, [rooms, selectedQuan]);

  const duplicateKhuVuc = useMemo(() => {
    const counts = {};
    khuVucOptions.forEach((o) => { counts[o.khu_vuc] = (counts[o.khu_vuc] || 0) + 1; });
    return counts;
  }, [khuVucOptions]);

  useEffect(() => {
    if (selectedQuan.length === 0) return;
    setSelectedKhuVuc((prev) => prev.filter((kv) => {
      const [, quan] = kv.split('|||');
      return selectedQuan.includes(quan);
    }));
  }, [selectedQuan]);

  const filtered = useMemo(() => {
    let result = rooms.filter((r) => {
      if (selectedQuan.length > 0 && !selectedQuan.includes(r.quan_huyen)) return false;
      if (selectedKhuVuc.length > 0) {
        const key = `${r.khu_vuc}|||${r.quan_huyen}`;
        if (!selectedKhuVuc.includes(key)) return false;
      }
      if (r.gia < priceMin || r.gia > priceMax) return false;
      return true;
    });
    if (sort === 'price_asc') result.sort((a, b) => a.gia - b.gia);
    else if (sort === 'price_desc') result.sort((a, b) => b.gia - a.gia);
    return result;
  }, [rooms, selectedQuan, selectedKhuVuc, priceMin, priceMax, sort]);

  const clearFilters = () => {
    setSelectedQuan([]); setSelectedKhuVuc([]);
    setPriceMin(2000000); setPriceMax(15000000);
    setPriceMinText('2.000.000'); setPriceMaxText('15.000.000');
    setSort('price_asc');
  };
  const hasFilters = selectedQuan.length > 0 || selectedKhuVuc.length > 0 || priceMin !== 2000000 || priceMax !== 15000000;

  const handlePriceMinChange = (t) => { setPriceMinText(t); setPriceMin(parsePrice(t)); };
  const handlePriceMinBlur = () => { setPriceMinText(priceMin > 0 ? fmtPrice(priceMin) : ''); };
  const handlePriceMaxChange = (t) => { setPriceMaxText(t); setPriceMax(parsePrice(t) || 50000000); };
  const handlePriceMaxBlur = () => { setPriceMaxText(priceMax > 0 ? fmtPrice(priceMax) : ''); };

  return (
    <div style={s.page}>
      {/* ─── DESKTOP HEADER (ẩn trên mobile) ─── */}
      <header className="rl-desktop-header" style={s.desktopHeader}>
        <div style={s.desktopHeaderInner}>
          <Link to="/" style={s.desktopLogo}>
            <div style={s.desktopLogoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10.5Z" fill="white" fillOpacity="0.9"/>
                <path d="M9 21V13H15V21" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={s.desktopLogoText}>Phòng Đẹp - Giá Yêu</span>
          </Link>
          <span style={s.desktopSlogan}>Kênh tìm phòng uy tín tại Hà Nội</span>
        </div>
      </header>

      {/* ─── MOBILE BANNER (ẩn trên desktop) ─── */}
      <div className="rl-mobile-banner" style={s.mobileBanner}>
        <img src={BANNER_URL} alt="" style={s.bannerImg} />
        <div style={s.bannerOverlay} />
        <div style={s.bannerContent}>
          <h1 style={s.bannerHeadline}>Phòng Đẹp - Giá Yêu</h1>
          <p style={s.bannerDesc}>Kênh tìm phòng uy tín tại Hà Nội</p>
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div style={s.filterSection}>
        <div className="rl-filter-card" style={s.filterCard}>
          <SearchableMultiSelect
            label="Quận / Huyện"
            options={QUAN_LIST.map((q) => ({ value: q, label: q }))}
            selected={selectedQuan}
            onChange={setSelectedQuan}
            searchPlaceholder="Nhập tên quận..."
          />
          <SearchableMultiSelect
            label="Khu vực"
            options={khuVucOptions.map((o) => ({
              value: `${o.khu_vuc}|||${o.quan_huyen}`,
              label: duplicateKhuVuc[o.khu_vuc] > 1 ? `${o.khu_vuc} (${o.quan_huyen})` : o.khu_vuc,
            }))}
            selected={selectedKhuVuc}
            onChange={setSelectedKhuVuc}
            disabled={khuVucOptions.length === 0}
            placeholder={selectedQuan.length > 0 ? 'Chọn khu vực' : 'Chọn quận trước'}
            searchPlaceholder="Nhập tên khu vực..."
          />
          <div style={s.filterGroup}>
            <div style={s.filterLabel}>Giá phòng</div>
            <div style={s.priceRow}>
              <input className="filter-input" style={s.priceInput} type="text" inputMode="numeric"
                value={priceMinText}
                onChange={(e) => handlePriceMinChange(e.target.value)}
                onBlur={handlePriceMinBlur}
                onFocus={() => setPriceMinText(priceMin > 0 ? String(priceMin) : '')}
                placeholder="Từ" />
              <span style={s.priceSep}>→</span>
              <input className="filter-input" style={s.priceInput} type="text" inputMode="numeric"
                value={priceMaxText}
                onChange={(e) => handlePriceMaxChange(e.target.value)}
                onBlur={handlePriceMaxBlur}
                onFocus={() => setPriceMaxText(priceMax > 0 ? String(priceMax) : '')}
                placeholder="Đến" />
            </div>
          </div>
          <div style={s.filterGroup}>
            <div style={s.filterLabel}>Sắp xếp</div>
            <select className="filter-input" style={s.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="price_asc">Giá thấp → cao</option>
              <option value="price_desc">Giá cao → thấp</option>
            </select>
          </div>
          {hasFilters && (
            <button style={s.clearBtn} onClick={clearFilters}>✕ Xoá bộ lọc</button>
          )}
        </div>
      </div>

      {/* ─── FILTER TAGS ─── */}
      {(selectedQuan.length > 0 || selectedKhuVuc.length > 0) && (
        <div style={s.tagBar}>
          {selectedQuan.map((q) => (
            <span key={q} className="filter-tag" style={s.tag} onClick={() => setSelectedQuan((p) => p.filter((x) => x !== q))}>
              {q} ✕
            </span>
          ))}
          {selectedKhuVuc.map((kv) => {
            const [name, quan] = kv.split('|||');
            const label = duplicateKhuVuc[name] > 1 ? `${name} (${quan})` : name;
            return (
              <span key={kv} className="filter-tag" style={s.tagGreen} onClick={() => setSelectedKhuVuc((p) => p.filter((x) => x !== kv))}>
                {label} ✕
              </span>
            );
          })}
        </div>
      )}

      {/* ─── ROOM GRID ─── */}
      <main style={s.main}>
        <div style={s.resultBar}>
          <span style={s.resultCount}>{filtered.length} phòng{hasFilters ? ' phù hợp' : ''}</span>
        </div>

        {loading ? (
          <div style={s.empty}>
            <div style={s.spinner} />
            <div style={{ marginTop: 12 }}>Đang tải phòng...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty} className="fade-in">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Không tìm thấy phòng phù hợp</div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 6 }}>Thử điều chỉnh bộ lọc để xem thêm phòng</div>
          </div>
        ) : (
          <div className="rl-grid" style={s.grid}>
            {filtered.map((room, i) => (
              <RoomCard key={room.id || i} room={room} />
            ))}
          </div>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerBrand}>
            <div style={s.footerDot} />
            <span style={s.footerName}>Phòng Đẹp — Giá Yêu</span>
          </div>
          <div style={s.footerRight}>
            <span style={s.footerText}>Zalo: 0961 685 136</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEARCHABLE MULTI-SELECT
   ══════════════════════════════════════════════════════ */
function SearchableMultiSelect({ label, options, selected, onChange, disabled, placeholder, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (open && searchRef.current) searchRef.current.focus(); }, [open]);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  const filteredOpts = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div ref={ref} style={s.filterGroup}>
      <div style={s.filterLabel}>{label}</div>
      <div
        style={{ ...s.selectTrigger, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span style={s.selectText}>
          {selected.length === 0 ? (placeholder || 'Tất cả') : `${selected.length} đã chọn`}
        </span>
        <span style={s.selectArrow}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={s.dropdown} className="fade-in">
          <div style={s.dropSearch}>
            <input ref={searchRef} className="search-input" style={s.dropSearchInput}
              type="text" placeholder={searchPlaceholder || 'Tìm kiếm...'}
              value={search} onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()} />
          </div>
          {selected.length > 0 && (
            <div style={s.dropClear} onClick={() => { onChange([]); setSearch(''); }}>Bỏ chọn tất cả</div>
          )}
          <div style={s.dropList}>
            {filteredOpts.length === 0 ? (
              <div style={s.dropEmpty}>{search ? 'Không tìm thấy' : 'Không có dữ liệu'}</div>
            ) : (
              filteredOpts.map((opt) => (
                <div key={opt.value} className="multi-opt"
                  style={s.dropOpt(selected.includes(opt.value))}
                  onClick={() => toggle(opt.value)}
                >
                  <div style={s.dropCheck(selected.includes(opt.value))}>
                    {selected.includes(opt.value) && '✓'}
                  </div>
                  <span>{opt.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROOM CARD
   ══════════════════════════════════════════════════════ */
function RoomCard({ room }) {
  const mainImage = room.images?.[0];
  const mediaCount = (room.images?.length || 0) + (room.videos?.length || 0);

  return (
    <Link to={`/phong/${room.id}`} className="room-card" style={s.card}>
      <div style={s.cardMedia}>
        {mainImage ? (
          <img src={mainImage} alt="" style={s.cardImg} loading="lazy" />
        ) : (
          <div style={s.cardNoImg}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
        )}
        {/* Overlays */}
        {mediaCount > 1 && <div style={s.cardMediaCount}>{mediaCount} ảnh</div>}
        {/* Price overlay */}
        <div style={s.cardPriceOverlay}>
          {formatVND(room.gia)}<span style={s.cardPriceUnit}>/tháng</span>
        </div>
      </div>
      <div style={s.cardBody}>
        <div style={s.cardTags}>
          {room.loai_phong && <span style={s.cardTag}>{room.loai_phong}</span>}
          {room.quan_huyen && <span style={s.cardTag}>{room.quan_huyen}</span>}
          {room.khu_vuc && <span style={s.cardTagHL}>{room.khu_vuc}</span>}
        </div>
        <div style={s.cardAddr}>
          {room.dia_chi}{room.quan_huyen ? `, ${room.quan_huyen}` : ''}
        </div>
        <div style={s.cardUtils}>
          <span style={s.cardUtil}>⚡ {room.gia_dien || '—'}</span>
          <span style={s.cardUtilDot}>•</span>
          <span style={s.cardUtil}>💧 {room.gia_nuoc || '—'}</span>
          <span style={s.cardUtilDot}>•</span>
          <span style={s.cardUtil}>📶 {room.gia_internet || '—'}</span>
        </div>
      </div>
    </Link>
  );
}

/* ══════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════ */
const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const s = {
  /* ── Page ── */
  page: { fontFamily: F, background: C.bg, minHeight: '100vh', color: C.text },

  /* ── Desktop Header ── */
  desktopHeader: {
    background: C.gradient,
    padding: '0 24px',
    height: 56,
    alignItems: 'center',
    position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 2px 12px rgba(34,197,94,0.15)',
  },
  desktopHeaderInner: {
    width: '100%', maxWidth: 1320, margin: '0 auto', height: '100%',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  desktopLogo: {
    display: 'flex', alignItems: 'center', gap: 10,
    textDecoration: 'none',
  },
  desktopLogoIcon: {
    width: 36, height: 36, borderRadius: 9,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  desktopLogoText: {
    fontSize: 18, fontWeight: 900, color: '#fff',
    letterSpacing: 0.5, fontFamily: F,
  },
  desktopSlogan: {
    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
    fontFamily: F, letterSpacing: 0.3,
  },

  /* ── Mobile Banner ── */
  mobileBanner: {
    position: 'relative',
    width: '100%',
    height: 170,
    overflow: 'hidden',
  },
  bannerImg: {
    width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: 'center 40%',
    display: 'block',
  },
  bannerOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)',
  },
  bannerContent: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '0 24px', textAlign: 'center',
  },
  bannerHeadline: {
    fontSize: 24, fontWeight: 900, color: '#fff',
    fontFamily: F, margin: 0, letterSpacing: 1,
    textShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  bannerDesc: {
    fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
    fontFamily: F, margin: 0,
    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },

  /* ── Filter Section ── */
  filterSection: { padding: '16px 24px', background: C.bg },
  filterCard: {
    maxWidth: 1020, margin: '0 auto',
    background: C.bgCard,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    boxShadow: C.shadowMd,
    padding: '16px 20px',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    gap: 14, flexWrap: 'wrap',
  },
  filterGroup: { position: 'relative', minWidth: 170 },
  filterLabel: {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, textAlign: 'center', fontFamily: F,
  },

  /* ── Select trigger ── */
  selectTrigger: {
    padding: '9px 12px',
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    fontSize: 14, color: C.text,
    display: 'flex', alignItems: 'center', gap: 8,
    minWidth: 155, fontFamily: F, fontWeight: 500,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  selectText: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  selectArrow: { fontSize: 10, color: C.textDim },

  /* ── Dropdown ── */
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, minWidth: 250,
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
    boxShadow: C.shadowLg, zIndex: 200, marginTop: 6, overflow: 'hidden',
  },
  dropSearch: {
    padding: '10px 12px', borderBottom: `1px solid ${C.border}`,
    background: C.bgCard, position: 'sticky', top: 0, zIndex: 1,
  },
  dropSearchInput: {
    width: '100%', padding: '8px 12px',
    border: `1px solid ${C.border}`, borderRadius: 8,
    fontSize: 13, color: C.text, outline: 'none',
    background: C.bg, fontFamily: F, fontWeight: 500,
    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  dropClear: {
    padding: '8px 14px', fontSize: 12, color: C.primary,
    cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
    fontWeight: 700, fontFamily: F,
  },
  dropList: { maxHeight: 260, overflowY: 'auto' },
  dropEmpty: { padding: 16, fontSize: 13, color: C.textDim, textAlign: 'center' },
  dropOpt: (active) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 14px', fontSize: 14, cursor: 'pointer',
    background: active ? C.primaryBg : 'transparent',
    color: C.text, fontFamily: F, fontWeight: active ? 600 : 400,
  }),
  dropCheck: (active) => ({
    width: 18, height: 18, borderRadius: 5,
    border: `2px solid ${active ? C.primary : C.border}`,
    background: active ? C.primary : 'transparent',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
    transition: 'all 0.15s ease',
  }),

  /* ── Price inputs ── */
  priceRow: { display: 'flex', alignItems: 'center', gap: 8 },
  priceSep: { color: C.textDim, fontSize: 14, fontWeight: 600 },
  priceInput: {
    width: 115, padding: '9px 10px',
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    fontSize: 13, color: C.text, outline: 'none',
    boxSizing: 'border-box', fontFamily: F, fontWeight: 500, textAlign: 'right',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },

  /* ── Sort ── */
  sortSelect: {
    padding: '9px 12px', width: '100%', minWidth: 155,
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    fontSize: 14, color: C.text, outline: 'none',
    boxSizing: 'border-box', fontFamily: F, fontWeight: 500,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  clearBtn: {
    padding: '9px 18px', borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.bgCard,
    color: C.textMuted, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: F, alignSelf: 'flex-end',
    transition: 'all 0.2s ease',
  },

  /* ── Tag bar ── */
  tagBar: {
    maxWidth: 1020, margin: '0 auto', padding: '8px 24px',
    display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
  },
  tag: {
    background: C.bgCard, border: `1px solid ${C.border}`, color: C.text,
    padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: F, boxShadow: C.shadow,
  },
  tagGreen: {
    background: C.primaryBg, border: `1px solid ${C.primaryDark}33`, color: C.primaryDark,
    padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: F,
  },

  /* ── Main ── */
  main: { maxWidth: 1320, margin: '0 auto', padding: '20px 24px 64px' },
  resultBar: { marginBottom: 16 },
  resultCount: { fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F },
  empty: {
    textAlign: 'center', padding: 64,
    color: C.textMuted, fontSize: 14, fontFamily: F,
  },
  spinner: {
    width: 32, height: 32, border: `3px solid ${C.border}`,
    borderTopColor: C.primary, borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
    gap: 20,
  },

  /* ── Card ── */
  card: {
    background: C.bgCard, borderRadius: 16,
    border: `1px solid ${C.border}`,
    overflow: 'hidden', textDecoration: 'none', color: 'inherit',
    boxShadow: C.shadow,
  },
  cardMedia: {
    position: 'relative', aspectRatio: '16/10',
    background: '#F1F5F9', overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cardNoImg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', background: '#F1F5F9',
  },
  cardMediaCount: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(0,0,0,0.55)', color: '#fff',
    padding: '3px 10px', borderRadius: 6,
    fontSize: 11, fontWeight: 600, fontFamily: F,
  },
  cardPriceOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
    padding: '20px 14px 10px',
    color: '#fff', fontSize: 20, fontWeight: 800, fontFamily: F,
  },
  cardPriceUnit: { fontSize: 13, fontWeight: 500, opacity: 0.85 },
  cardBody: { padding: '12px 16px 16px' },
  cardTags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  cardTag: {
    background: C.bg, color: C.textMuted,
    padding: '2px 9px', borderRadius: 5,
    fontSize: 11, fontWeight: 600, fontFamily: F,
  },
  cardTagHL: {
    background: C.primaryBg, color: C.primaryDark,
    padding: '2px 9px', borderRadius: 5,
    fontSize: 11, fontWeight: 700, fontFamily: F,
  },
  cardAddr: {
    fontSize: 13, color: C.text, fontWeight: 500,
    marginBottom: 8, lineHeight: 1.45, fontFamily: F,
  },
  cardUtils: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
    fontSize: 12, color: C.textDim, fontFamily: F, fontWeight: 500,
  },
  cardUtil: {},
  cardUtilDot: { color: C.border },

  /* ── Footer ── */
  footer: {
    borderTop: `1px solid ${C.border}`,
    padding: '20px 24px', background: C.bgCard,
  },
  footerInner: {
    maxWidth: 1320, margin: '0 auto',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  footerBrand: { display: 'flex', alignItems: 'center', gap: 8 },
  footerDot: {
    width: 8, height: 8, borderRadius: '50%', background: C.primary,
  },
  footerName: { fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F },
  footerRight: {},
  footerText: { fontSize: 13, color: C.textMuted, fontFamily: F, fontWeight: 500 },
};
