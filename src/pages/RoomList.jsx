import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { C, QUAN_LIST, formatVND } from '../utils/theme';
import { fetchRoomsFromSheets } from '../utils/api';

export default function RoomList() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuan, setSelectedQuan] = useState([]);
  const [selectedKhuVuc, setSelectedKhuVuc] = useState([]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(5000000);
  const [sort, setSort] = useState('newest'); // newest | price_asc | price_desc
  const [search, setSearch] = useState('');

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
      if (search) {
        const q = search.toLowerCase();
        const h = `${r.dia_chi} ${r.quan_huyen} ${r.khu_vuc} ${r.noi_that} ${r.ghi_chu}`.toLowerCase();
        if (!h.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'price_asc') result.sort((a, b) => a.gia - b.gia);
    else if (sort === 'price_desc') result.sort((a, b) => b.gia - a.gia);
    // newest = default order from sheets (latest appended last, reversed)
    else result.sort((a, b) => (b.ngay_input || '').localeCompare(a.ngay_input || ''));

    return result;
  }, [rooms, selectedQuan, selectedKhuVuc, priceMin, priceMax, sort, search]);

  const clearFilters = () => {
    setSelectedQuan([]);
    setSelectedKhuVuc([]);
    setPriceMin(0);
    setPriceMax(5000000);
    setSort('newest');
    setSearch('');
  };

  const hasFilters = selectedQuan.length > 0 || selectedKhuVuc.length > 0 || priceMin > 0 || priceMax < 5000000 || search;

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
          <div style={{ fontSize: 13, color: C.textMuted }}>Zalo: 0961 685 136</div>
        </div>
      </header>

      {/* Hero + Search */}
      <div style={s.hero}>
        <h1 style={s.heroTitle}>Tìm phòng trọ đẹp tại Hà Nội</h1>
        <p style={s.heroDesc}>
          {rooms.length}+ phòng được cập nhật hàng ngày
        </p>
        <div style={s.searchBar}>
          <input
            style={s.searchInput}
            placeholder="Tìm theo địa chỉ, khu vực..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter bar - centered */}
      <div style={s.filterBar}>
        <div style={s.filterInner}>
          <MultiSelect
            label="Quận/Huyện"
            options={QUAN_LIST.map((q) => ({ value: q, label: q }))}
            selected={selectedQuan}
            onChange={setSelectedQuan}
          />
          <MultiSelect
            label="Khu vực"
            options={khuVucOptions.map((o) => ({
              value: `${o.khu_vuc}|||${o.quan_huyen}`,
              label: duplicateKhuVuc[o.khu_vuc] > 1 ? `${o.khu_vuc} (${o.quan_huyen})` : o.khu_vuc,
            }))}
            selected={selectedKhuVuc}
            onChange={setSelectedKhuVuc}
            disabled={khuVucOptions.length === 0}
            placeholder={selectedQuan.length > 0 ? 'Chọn khu vực' : 'Chọn quận trước'}
          />
          <div style={s.priceFilter}>
            <div style={s.filterLabel}>Giá</div>
            <div style={s.priceInputs}>
              <input
                style={s.priceInput}
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(Math.max(0, Number(e.target.value)))}
                step={100000}
                min={0}
                max={50000000}
                placeholder="Từ"
              />
              <span style={{ color: C.textDim }}>-</span>
              <input
                style={s.priceInput}
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(Math.min(50000000, Number(e.target.value)))}
                step={100000}
                min={0}
                max={50000000}
                placeholder="Đến"
              />
            </div>
          </div>
          <div style={s.sortFilter}>
            <div style={s.filterLabel}>Sắp xếp</div>
            <select style={s.sortSelect} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Phòng mới</option>
              <option value="price_asc">Giá thấp đến cao</option>
              <option value="price_desc">Giá cao đến thấp</option>
            </select>
          </div>
          {hasFilters && (
            <button style={s.clearBtn} onClick={clearFilters}>Xoá lọc</button>
          )}
        </div>
      </div>

      {/* Selected tags */}
      {(selectedQuan.length > 0 || selectedKhuVuc.length > 0) && (
        <div style={s.tagBar}>
          {selectedQuan.map((q) => (
            <span key={q} style={s.filterTag} onClick={() => setSelectedQuan((p) => p.filter((x) => x !== q))}>
              {q} x
            </span>
          ))}
          {selectedKhuVuc.map((kv) => {
            const [name, quan] = kv.split('|||');
            const label = duplicateKhuVuc[name] > 1 ? `${name} (${quan})` : name;
            return (
              <span key={kv} style={s.filterTagGreen} onClick={() => setSelectedKhuVuc((p) => p.filter((x) => x !== kv))}>
                {label} x
              </span>
            );
          })}
        </div>
      )}

      {/* Room grid */}
      <main style={s.main}>
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
      </main>

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

// ── MultiSelect dropdown ──────────────────────────
function MultiSelect({ label, options, selected, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

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
        <span style={{ fontSize: 10, color: C.textDim }}>{open ? '\u25B2' : '\u25BC'}</span>
      </div>
      {open && (
        <div style={s.multiDropdown}>
          {options.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: C.textDim, textAlign: 'center' }}>Không có dữ liệu</div>
          ) : (
            <>
              {selected.length > 0 && (
                <div style={s.multiClear} onClick={() => onChange([])}>Bỏ chọn tất cả</div>
              )}
              {options.map((opt) => (
                <div
                  key={opt.value}
                  style={s.multiOption(selected.includes(opt.value))}
                  onClick={() => toggle(opt.value)}
                >
                  <div style={s.multiCheck(selected.includes(opt.value))}>
                    {selected.includes(opt.value) && '\u2713'}
                  </div>
                  <span>{opt.label}</span>
                </div>
              ))}
            </>
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
          <div style={s.cardNoImg}>Chưa có ảnh</div>
        )}
        {(room.images?.length + room.videos?.length) > 1 && (
          <div style={s.cardImgCount}>{room.images?.length + room.videos?.length} media</div>
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
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{room.id}</div>
        )}
      </div>
    </Link>
  );
}

// ── Styles ──────────────────────────────────────────
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
  logoText: { fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: -0.5 },
  logoSub: { fontSize: 11, color: C.textMuted, fontWeight: 600 },
  hero: {
    textAlign: 'center',
    padding: '32px 24px 24px',
    background: C.bgCard,
    borderBottom: `1px solid ${C.border}`,
  },
  heroTitle: { fontSize: 26, fontWeight: 900, color: C.text, marginBottom: 6 },
  heroDesc: { fontSize: 14, color: C.textMuted, marginBottom: 16 },
  searchBar: { maxWidth: 500, margin: '0 auto' },
  searchInput: {
    width: '100%',
    padding: '10px 16px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  // Filter bar
  filterBar: {
    background: C.bgCard,
    borderBottom: `1px solid ${C.border}`,
    padding: '12px 24px',
  },
  filterInner: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: C.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // MultiSelect
  multiWrap: { position: 'relative', minWidth: 160 },
  multiTrigger: {
    padding: '7px 10px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 13,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
  },
  multiDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    minWidth: 220,
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    zIndex: 200,
    maxHeight: 280,
    overflowY: 'auto',
    marginTop: 4,
  },
  multiClear: {
    padding: '6px 12px',
    fontSize: 11,
    color: C.primary,
    cursor: 'pointer',
    borderBottom: `1px solid ${C.border}`,
    fontWeight: 600,
  },
  multiOption: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    background: active ? C.primaryBg : 'transparent',
    color: C.text,
  }),
  multiCheck: (active) => ({
    width: 16,
    height: 16,
    borderRadius: 3,
    border: `2px solid ${active ? C.primary : C.border}`,
    background: active ? C.primary : 'transparent',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  }),
  // Price filter
  priceFilter: { minWidth: 200 },
  priceInputs: { display: 'flex', alignItems: 'center', gap: 6 },
  priceInput: {
    width: 100,
    padding: '7px 8px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 12,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  // Sort
  sortFilter: { minWidth: 140 },
  sortSelect: {
    padding: '7px 10px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 13,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  },
  clearBtn: {
    padding: '7px 14px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textMuted,
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
    alignSelf: 'flex-end',
  },
  // Tag bar
  tagBar: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '8px 24px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterTag: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.text,
    padding: '3px 10px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  filterTagGreen: {
    background: C.primaryBg,
    border: `1px solid ${C.primary}44`,
    color: C.primaryDark,
    padding: '3px 10px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // Main content
  main: { maxWidth: 1400, margin: '0 auto', padding: '16px 24px 60px' },
  resultBar: { marginBottom: 12 },
  emptyState: {
    textAlign: 'center',
    padding: 60,
    color: C.textMuted,
    fontSize: 14,
  },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 16,
  },
  // Card
  card: {
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'box-shadow 0.2s',
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
    fontSize: 13,
  },
  cardImgCount: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  cardBody: { padding: 14 },
  cardTags: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  cardTag: {
    background: C.bg,
    color: C.text,
    padding: '1px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    border: `1px solid ${C.border}`,
  },
  cardTagGreen: {
    background: C.primaryBg,
    color: C.primaryDark,
    padding: '1px 8px',
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
