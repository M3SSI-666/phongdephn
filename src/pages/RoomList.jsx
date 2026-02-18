import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { C, QUAN_LIST, formatVND } from '../utils/theme';
import { fetchRoomsFromSheets } from '../utils/api';

// Format number with Vietnamese dot separator: 5200000 → "5.200.000"
const fmtPrice = (v) => {
  if (!v && v !== 0) return '';
  return Number(v).toLocaleString('vi-VN');
};

// Parse Vietnamese price string back to number: "5.200.000" → 5200000
const parsePrice = (str) => {
  const cleaned = str.replace(/\./g, '').replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
};

export default function RoomList() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuan, setSelectedQuan] = useState([]);
  const [selectedKhuVuc, setSelectedKhuVuc] = useState([]);
  const [priceMin, setPriceMin] = useState(2000000);
  const [priceMax, setPriceMax] = useState(5000000);
  const [priceMinText, setPriceMinText] = useState('2.000.000');
  const [priceMaxText, setPriceMaxText] = useState('5.000.000');
  const [sort, setSort] = useState('price_asc');

  useEffect(() => {
    fetchRoomsFromSheets()
      .then(setRooms)
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  // Build khu_vuc options based on selected quận, with quận prefix for disambiguation
  const khuVucOptions = useMemo(() => {
    const map = new Map();
    rooms.forEach((r) => {
      if (!r.khu_vuc) return;
      if (selectedQuan.length > 0 && !selectedQuan.includes(r.quan_huyen)) return;
      const key = `${r.khu_vuc}|||${r.quan_huyen}`;
      if (!map.has(key)) {
        map.set(key, { khu_vuc: r.khu_vuc, quan_huyen: r.quan_huyen });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.khu_vuc.localeCompare(b.khu_vuc, 'vi'));
  }, [rooms, selectedQuan]);

  // Check for duplicate khu_vuc names across quận
  const duplicateKhuVuc = useMemo(() => {
    const counts = {};
    khuVucOptions.forEach((o) => {
      counts[o.khu_vuc] = (counts[o.khu_vuc] || 0) + 1;
    });
    return counts;
  }, [khuVucOptions]);

  // When selectedQuan changes, remove khuVuc selections that no longer apply
  useEffect(() => {
    if (selectedQuan.length === 0) return;
    setSelectedKhuVuc((prev) =>
      prev.filter((kv) => {
        const [, quan] = kv.split('|||');
        return selectedQuan.includes(quan);
      })
    );
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
    else result.sort((a, b) => (b.ngay_input || '').localeCompare(a.ngay_input || ''));

    return result;
  }, [rooms, selectedQuan, selectedKhuVuc, priceMin, priceMax, sort]);

  const clearFilters = () => {
    setSelectedQuan([]);
    setSelectedKhuVuc([]);
    setPriceMin(2000000);
    setPriceMax(5000000);
    setPriceMinText('2.000.000');
    setPriceMaxText('5.000.000');
    setSort('price_asc');
  };

  const hasFilters = selectedQuan.length > 0 || selectedKhuVuc.length > 0 || priceMin !== 2000000 || priceMax !== 5000000;

  const handlePriceMinChange = (text) => {
    setPriceMinText(text);
    const num = parsePrice(text);
    setPriceMin(num);
  };

  const handlePriceMinBlur = () => {
    setPriceMinText(priceMin > 0 ? fmtPrice(priceMin) : '');
  };

  const handlePriceMaxChange = (text) => {
    setPriceMaxText(text);
    const num = parsePrice(text);
    setPriceMax(num || 50000000);
  };

  const handlePriceMaxBlur = () => {
    setPriceMaxText(priceMax > 0 ? fmtPrice(priceMax) : '');
  };

  return (
    <div style={s.page}>
      {/* Header with logo branding */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <Link to="/" style={s.logo}>
            <div style={s.logoIcon}>
              <span style={s.logoIconEmoji}>🏠</span>
            </div>
            <div>
              <div style={s.logoText}>PHÒNG ĐẸP</div>
              <div style={s.logoSlogan}>GIÁ YÊU</div>
            </div>
          </Link>
          <div style={s.headerRight}>
            <a href="https://zalo.me/0961685136" target="_blank" rel="noopener noreferrer" style={s.headerZalo}>
              💬 Zalo tư vấn
            </a>
            <a href="tel:0961685136" style={s.headerPhone}>
              📞 0961 685 136
            </a>
          </div>
        </div>
      </header>

      {/* Brand banner */}
      <div style={s.banner}>
        <div style={s.bannerInner}>
          <div style={s.bannerLeft}>
            <h1 style={s.bannerTitle}>
              <span style={s.bannerHighlight}>Phòng Đẹp</span> - <span style={s.bannerAccent}>Giá Yêu</span>
            </h1>
            <p style={s.bannerDesc}>
              Kênh phòng trọ uy tín tại Hà Nội • {rooms.length > 0 ? `${rooms.length} phòng` : 'Đang cập nhật'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar - centered, bigger */}
      <div style={s.filterBar}>
        <div style={s.filterInner}>
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
          <div style={s.priceFilter}>
            <div style={s.filterLabel}>Giá phòng</div>
            <div style={s.priceInputs}>
              <input
                style={s.priceInput}
                type="text"
                inputMode="numeric"
                value={priceMinText}
                onChange={(e) => handlePriceMinChange(e.target.value)}
                onBlur={handlePriceMinBlur}
                onFocus={() => setPriceMinText(priceMin > 0 ? String(priceMin) : '')}
                placeholder="Từ"
              />
              <span style={{ color: C.textDim, fontSize: 14, fontWeight: 600 }}>→</span>
              <input
                style={s.priceInput}
                type="text"
                inputMode="numeric"
                value={priceMaxText}
                onChange={(e) => handlePriceMaxChange(e.target.value)}
                onBlur={handlePriceMaxBlur}
                onFocus={() => setPriceMaxText(priceMax > 0 ? String(priceMax) : '')}
                placeholder="Đến"
              />
            </div>
          </div>
          <div style={s.sortFilter}>
            <div style={s.filterLabel}>Sắp xếp</div>
            <select style={s.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="price_asc">Giá thấp → cao</option>
              <option value="price_desc">Giá cao → thấp</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
          {hasFilters && (
            <button style={s.clearBtn} onClick={clearFilters}>✕ Xoá bộ lọc</button>
          )}
        </div>
      </div>

      {/* Selected tags */}
      {(selectedQuan.length > 0 || selectedKhuVuc.length > 0) && (
        <div style={s.tagBar}>
          {selectedQuan.map((q) => (
            <span key={q} style={s.filterTag} onClick={() => setSelectedQuan((p) => p.filter((x) => x !== q))}>
              {q} ✕
            </span>
          ))}
          {selectedKhuVuc.map((kv) => {
            const [name, quan] = kv.split('|||');
            const label = duplicateKhuVuc[name] > 1 ? `${name} (${quan})` : name;
            return (
              <span key={kv} style={s.filterTagGreen} onClick={() => setSelectedKhuVuc((p) => p.filter((x) => x !== kv))}>
                {label} ✕
              </span>
            );
          })}
        </div>
      )}

      {/* Room grid */}
      <main style={s.main}>
        <div style={s.resultBar}>
          <span style={s.resultCount}>
            {filtered.length} phòng {hasFilters ? 'phù hợp' : ''}
          </span>
        </div>

        {loading ? (
          <div style={s.emptyState}>Đang tải phòng...</div>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Không tìm thấy phòng phù hợp</div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 6 }}>
              Thử điều chỉnh bộ lọc để xem thêm phòng
            </div>
          </div>
        ) : (
          <div style={s.roomGrid}>
            {filtered.map((room, i) => (
              <RoomCard key={room.id || i} room={room} />
            ))}
          </div>
        )}
      </main>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerBrand}>
            <span style={s.footerLogo}>🏠</span>
            <span style={s.footerName}>Phòng Đẹp - Giá Yêu</span>
          </div>
          <div style={s.footerContact}>
            <span>Zalo: 0961 685 136</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Searchable MultiSelect dropdown ──────────────────────────
function SearchableMultiSelect({ label, options, selected, onChange, disabled, placeholder, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div ref={ref} style={s.multiWrap}>
      <div style={s.filterLabel}>{label}</div>
      <div
        style={{ ...s.multiTrigger, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length === 0
            ? (placeholder || 'Tất cả')
            : `${selected.length} đã chọn`}
        </span>
        <span style={{ fontSize: 11, color: C.textDim }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={s.multiDropdown}>
          {/* Search input */}
          <div style={s.multiSearchWrap}>
            <input
              ref={searchRef}
              style={s.multiSearchInput}
              type="text"
              placeholder={searchPlaceholder || 'Tìm kiếm...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {selected.length > 0 && (
            <div style={s.multiClear} onClick={() => { onChange([]); setSearch(''); }}>Bỏ chọn tất cả</div>
          )}
          {filteredOptions.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: C.textDim, textAlign: 'center' }}>
              {search ? 'Không tìm thấy' : 'Không có dữ liệu'}
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                style={s.multiOption(selected.includes(opt.value))}
                onClick={() => toggle(opt.value)}
              >
                <div style={s.multiCheck(selected.includes(opt.value))}>
                  {selected.includes(opt.value) && '✓'}
                </div>
                <span>{opt.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Room Card ──────────────────────────────────────
function RoomCard({ room }) {
  const mainImage = room.images?.[0];
  const mainVideo = room.videos?.[0];

  return (
    <Link to={`/phong/${room.id}`} style={s.card}>
      <div style={s.cardImage}>
        {mainVideo ? (
          <video src={mainVideo} style={s.cardImg} muted />
        ) : mainImage ? (
          <img src={mainImage} alt="" style={s.cardImg} />
        ) : (
          <div style={s.cardNoImg}>📷 Chưa có ảnh</div>
        )}
        {(room.images?.length + room.videos?.length) > 1 && (
          <div style={s.cardImgCount}>📸 {room.images?.length + room.videos?.length}</div>
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
          📍 {room.dia_chi}
          {room.quan_huyen ? `, ${room.quan_huyen}` : ''}
        </div>
        <div style={s.cardMeta}>
          <span>⚡ {room.gia_dien || '-'}</span>
          <span>💧 {room.gia_nuoc || '-'}</span>
          <span>📶 {room.gia_internet || '-'}</span>
        </div>
        {room.id && (
          <div style={s.cardId}>Mã: {room.id}</div>
        )}
      </div>
    </Link>
  );
}

// ── Styles ──────────────────────────────────────────
const FONT = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const s = {
  page: {
    fontFamily: FONT,
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
  },
  // Header
  header: {
    background: C.bgCard,
    borderBottom: `1px solid ${C.border}`,
    padding: '10px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1400,
    margin: '0 auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconEmoji: {
    fontSize: 22,
    filter: 'brightness(10)',
  },
  logoText: {
    fontSize: 17,
    fontWeight: 800,
    color: C.primaryDark,
    letterSpacing: 0.5,
    lineHeight: 1.1,
    fontFamily: FONT,
  },
  logoSlogan: {
    fontSize: 13,
    fontWeight: 700,
    color: C.accent,
    letterSpacing: 1,
    lineHeight: 1.2,
    fontFamily: FONT,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerZalo: {
    fontSize: 13,
    fontWeight: 600,
    color: C.primary,
    textDecoration: 'none',
    padding: '6px 14px',
    borderRadius: 8,
    background: C.primaryBg,
    fontFamily: FONT,
  },
  headerPhone: {
    fontSize: 13,
    fontWeight: 600,
    color: C.textMuted,
    textDecoration: 'none',
    fontFamily: FONT,
  },
  // Banner
  banner: {
    background: `linear-gradient(135deg, ${C.primaryDark}08, ${C.primary}12)`,
    borderBottom: `1px solid ${C.border}`,
    padding: '24px 24px 20px',
  },
  bannerInner: {
    maxWidth: 1400,
    margin: '0 auto',
    textAlign: 'center',
  },
  bannerLeft: {},
  bannerTitle: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 6,
    fontFamily: FONT,
    lineHeight: 1.2,
  },
  bannerHighlight: {
    color: C.primaryDark,
  },
  bannerAccent: {
    color: C.accent,
  },
  bannerDesc: {
    fontSize: 14,
    color: C.textMuted,
    fontWeight: 500,
    fontFamily: FONT,
  },
  // Filter bar
  filterBar: {
    background: C.bgCard,
    borderBottom: `1px solid ${C.border}`,
    padding: '14px 24px',
  },
  filterInner: {
    maxWidth: 1000,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: C.textMuted,
    marginBottom: 5,
    letterSpacing: 0.3,
    fontFamily: FONT,
    textAlign: 'center',
  },
  // MultiSelect
  multiWrap: { position: 'relative', minWidth: 170 },
  multiTrigger: {
    padding: '9px 12px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 150,
    fontFamily: FONT,
    fontWeight: 500,
  },
  multiDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    minWidth: 240,
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
    zIndex: 200,
    maxHeight: 340,
    overflowY: 'auto',
    marginTop: 4,
  },
  multiSearchWrap: {
    padding: '8px 10px',
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    background: C.bgCard,
    zIndex: 1,
  },
  multiSearchInput: {
    width: '100%',
    padding: '7px 10px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 13,
    color: C.text,
    outline: 'none',
    background: C.bg,
    fontFamily: FONT,
    fontWeight: 500,
    boxSizing: 'border-box',
  },
  multiClear: {
    padding: '8px 14px',
    fontSize: 12,
    color: C.primary,
    cursor: 'pointer',
    borderBottom: `1px solid ${C.border}`,
    fontWeight: 700,
    fontFamily: FONT,
  },
  multiOption: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    fontSize: 14,
    cursor: 'pointer',
    background: active ? C.primaryBg : 'transparent',
    color: C.text,
    fontFamily: FONT,
    fontWeight: active ? 600 : 400,
  }),
  multiCheck: (active) => ({
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `2px solid ${active ? C.primary : C.border}`,
    background: active ? C.primary : 'transparent',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  }),
  // Price filter
  priceFilter: { minWidth: 240 },
  priceInputs: { display: 'flex', alignItems: 'center', gap: 8 },
  priceInput: {
    width: 115,
    padding: '9px 10px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 13,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: FONT,
    fontWeight: 500,
    textAlign: 'right',
  },
  // Sort
  sortFilter: { minWidth: 150 },
  sortSelect: {
    padding: '9px 12px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    fontFamily: FONT,
    fontWeight: 500,
  },
  clearBtn: {
    padding: '9px 16px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textMuted,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 600,
    alignSelf: 'flex-end',
    fontFamily: FONT,
  },
  // Tag bar
  tagBar: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '10px 24px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  filterTag: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.text,
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  filterTagGreen: {
    background: C.primaryBg,
    border: `1px solid ${C.primary}44`,
    color: C.primaryDark,
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
  },
  // Main content
  main: { maxWidth: 1400, margin: '0 auto', padding: '20px 24px 60px' },
  resultBar: { marginBottom: 14 },
  resultCount: {
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    fontFamily: FONT,
  },
  emptyState: {
    textAlign: 'center',
    padding: 60,
    color: C.textMuted,
    fontSize: 14,
    fontFamily: FONT,
  },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 18,
  },
  // Card
  card: {
    background: C.bgCard,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'box-shadow 0.2s, transform 0.2s',
  },
  cardImage: {
    position: 'relative',
    aspectRatio: '16/10',
    background: '#f0f0f0',
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardNoImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: C.textDim,
    fontSize: 14,
    fontFamily: FONT,
  },
  cardImgCount: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: FONT,
  },
  cardBody: { padding: 16 },
  cardTags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  cardTag: {
    background: C.bg,
    color: C.text,
    padding: '2px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    border: `1px solid ${C.border}`,
    fontFamily: FONT,
  },
  cardTagGreen: {
    background: C.primaryBg,
    color: C.primaryDark,
    padding: '2px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: FONT,
  },
  cardPrice: {
    fontSize: 20,
    fontWeight: 800,
    color: C.primary,
    marginBottom: 5,
    fontFamily: FONT,
  },
  cardAddr: {
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 8,
    lineHeight: 1.5,
    fontFamily: FONT,
    fontWeight: 500,
  },
  cardMeta: {
    display: 'flex',
    gap: 12,
    fontSize: 12,
    color: C.textDim,
    fontFamily: FONT,
    fontWeight: 500,
  },
  cardId: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 6,
    fontFamily: FONT,
    fontWeight: 500,
  },
  // Footer
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
  footerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  footerLogo: {
    fontSize: 18,
  },
  footerName: {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    fontFamily: FONT,
  },
  footerContact: {
    fontSize: 13,
    color: C.textMuted,
    fontFamily: FONT,
    fontWeight: 500,
  },
};
