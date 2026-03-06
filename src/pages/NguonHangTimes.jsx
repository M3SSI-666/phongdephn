import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { fetchNguonHangTabs, fetchNguonHangData } from '../utils/api';
import NguonHangCustomPanel from './NguonHangCustomPanel';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

export function NguonHangContent() {
  return <NguonHangInner showHeader={false} />;
}

export default function NguonHangTimes() {
  return <NguonHangInner showHeader={true} />;
}

function NguonHangInner({ showHeader }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('company'); // 'company' | 'custom'
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [headers, setHeaders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes nhFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .nh-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .nh-table-wrap::-webkit-scrollbar { height: 6px; }
      .nh-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      .nh-row:hover { background: ${C.primaryBg} !important; }
      .nh-tab { cursor: pointer; transition: all 0.15s; border: none; font-family: ${F}; }
      .nh-tab:hover { background: ${C.primaryBg} !important; }
      @media (max-width: 640px) {
        .nh-tabs-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .nh-tabs-wrap::-webkit-scrollbar { height: 4px; }
        .nh-tabs-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 2px; }
        .nh-header-row { flex-direction: column !important; gap: 10px !important; align-items: stretch !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Tải danh sách tabs
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchNguonHangTabs();
        const tabList = data.tabs || [];
        setTabs(tabList);
        if (tabList.length > 0) {
          setActiveTab(tabList[0]);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Tải dữ liệu khi đổi tab
  const loadTabData = useCallback(async (tabName) => {
    if (!tabName) return;
    try {
      setLoadingData(true);
      setError('');
      const data = await fetchNguonHangData(tabName);
      setHeaders(data.headers || []);
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
      setHeaders([]);
      setItems([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab) {
      loadTabData(activeTab);
      setSearch('');
    }
  }, [activeTab, loadTabData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
      headers.some((h) => (item[h] || '').toString().toLowerCase().includes(q))
    );
  }, [items, search, headers]);

  const handleTabClick = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  return (
    <div style={showHeader ? s.root : { fontFamily: F, color: C.text }}>
      {/* Header */}
      {showHeader && (
        <div style={s.header}>
          <div style={s.headerInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate('/')} style={s.backBtn} className="nh-tab">
                &larr;
              </button>
              <div>
                <div style={s.headerTitle}>Nguồn Hàng Times City</div>
                <div style={s.headerSub}>Quỹ căn bất động sản — Chỉ xem</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => loadTabData(activeTab)}
                disabled={loadingData}
                style={s.reloadBtn}
                className="nh-tab"
                title="Tải lại dữ liệu"
              >
                {loadingData ? '...' : '↻'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={showHeader ? s.container : { padding: '0' }}>
        {/* Toggle: Quỹ căn công ty / Phòng của tôi */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setViewMode('company')}
            className="nh-tab"
            style={{
              ...s.viewToggle,
              ...(viewMode === 'company' ? s.viewToggleActive : {}),
            }}
          >
            Quỹ căn công ty
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className="nh-tab"
            style={{
              ...s.viewToggle,
              ...(viewMode === 'custom' ? s.viewToggleActive : {}),
            }}
          >
            Phòng của tôi
          </button>
        </div>

        {viewMode === 'custom' && <NguonHangCustomPanel />}

        {viewMode === 'company' && loading && <div style={s.loadingBox}>Đang tải danh sách tab...</div>}

        {viewMode === 'company' && !loading && tabs.length > 0 && (
          <>
            {/* Tabs */}
            <div className="nh-tabs-wrap" style={s.tabsWrap}>
              <div style={s.tabsInner}>
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className="nh-tab"
                    style={{
                      ...s.tabBtn,
                      ...(tab === activeTab ? s.tabActive : {}),
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Search + count */}
            <div className="nh-header-row" style={s.filterRow}>
              <div style={s.searchWrap}>
                <span style={s.searchIcon}>&#128269;</span>
                <input
                  type="text"
                  placeholder="Tìm kiếm theo bất kỳ cột nào..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={s.searchInput}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={s.clearBtn}>&times;</button>
                )}
              </div>
              <div style={s.resultCount}>
                {filtered.length} / {items.length} căn
              </div>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}
            {loadingData && <div style={s.loadingBox}>Đang tải dữ liệu...</div>}

            {/* Table */}
            {!loadingData && !error && (
              <div className="nh-table-wrap" style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      {headers.map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={headers.length + 1} style={s.emptyTd}>
                          {items.length === 0 ? 'Không có dữ liệu trong tab này' : 'Không tìm thấy kết quả'}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((item, idx) => {
                        const rowBg = item._rowColor || undefined;
                        const cellColors = item._colors || {};
                        return (
                          <tr key={item._rowIndex || idx} className="nh-row" style={{ ...s.tr, ...(rowBg ? { background: rowBg } : {}) }}>
                            <td style={{ ...s.td, color: C.textDim, fontSize: 11, textAlign: 'center', ...(rowBg ? { background: rowBg } : {}) }}>{idx + 1}</td>
                            {headers.map((h) => {
                              const cellBg = cellColors[h] || rowBg || undefined;
                              return (
                                <td key={h} style={{ ...getCellStyle(h, item[h]), ...(cellBg ? { background: cellBg } : {}) }}>
                                  {renderCell(h, item[h])}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {viewMode === 'company' && !loading && tabs.length === 0 && !error && (
          <div style={s.emptyTd}>Không tìm thấy tab nào trong sheet</div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──
function renderCell(header, value) {
  if (!value) return '';
  const h = header.toLowerCase();
  // Nếu giá trị là link hình ảnh
  if (h.includes('hình') || h.includes('ảnh') || h.includes('image') || h.includes('link')) {
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 12, textDecoration: 'underline' }}>
          Xem
        </a>
      );
    }
  }
  return value;
}

function getCellStyle(header, value) {
  const h = header.toLowerCase();
  const base = {
    padding: '8px 10px',
    verticalAlign: 'middle',
    fontSize: 13,
  };

  if (h.includes('giá') || h.includes('phí') || h === 'giá' || h === 'phí') {
    return { ...base, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' };
  }
  if (h === 'sđt' || h === 'sdt' || h.includes('điện thoại')) {
    return { ...base, whiteSpace: 'nowrap' };
  }
  if (h.includes('ghi chú') || h.includes('note')) {
    return { ...base, maxWidth: 200, whiteSpace: 'pre-line', fontSize: 12, color: C.textMuted };
  }
  if (h.includes('ngày') || h.includes('date') || h.includes('cập nhật')) {
    return { ...base, whiteSpace: 'nowrap', fontSize: 12 };
  }
  if (h === 'mã căn' || h.includes('mã')) {
    return { ...base, fontWeight: 600, whiteSpace: 'nowrap' };
  }
  if (h === 'pn' || h === 'm2' || h === 'bc') {
    return { ...base, textAlign: 'center' };
  }
  return base;
}

// ── Styles ──
const s = {
  root: {
    fontFamily: F,
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
  },
  viewToggle: {
    padding: '10px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    background: '#fff',
    color: C.textMuted,
    border: `1.5px solid ${C.border}`,
    cursor: 'pointer',
  },
  viewToggleActive: {
    background: C.primary,
    color: '#fff',
    border: '1.5px solid transparent',
    boxShadow: C.shadowGreen,
  },
  header: {
    background: '#fff',
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: C.shadow,
  },
  headerInner: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: C.primary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  backBtn: {
    background: C.primaryBg,
    borderRadius: 8,
    width: 36,
    height: 36,
    fontSize: 18,
    color: C.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  reloadBtn: {
    background: '#fff',
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    width: 40,
    height: 40,
    fontSize: 20,
    color: C.primary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontFamily: F,
  },
  container: {
    maxWidth: 1500,
    margin: '0 auto',
    padding: '16px 16px',
  },
  tabsWrap: {
    marginBottom: 16,
    overflowX: 'auto',
  },
  tabsInner: {
    display: 'flex',
    gap: 6,
    whiteSpace: 'nowrap',
    paddingBottom: 4,
  },
  tabBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: '#fff',
    color: C.textMuted,
    border: `1.5px solid ${C.border}`,
  },
  tabActive: {
    background: C.gradient,
    color: '#fff',
    border: '1.5px solid transparent',
    boxShadow: C.shadowGreen,
  },
  filterRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  searchWrap: {
    flex: 1,
    position: 'relative',
    minWidth: 200,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 14,
    opacity: 0.5,
  },
  searchInput: {
    width: '100%',
    padding: '10px 36px 10px 36px',
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 13,
    fontFamily: F,
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: C.textMuted,
    cursor: 'pointer',
    padding: '0 4px',
  },
  resultCount: {
    fontSize: 12,
    color: C.textMuted,
    whiteSpace: 'nowrap',
  },
  errorBox: {
    background: '#FEF2F2',
    color: C.error,
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  loadingBox: {
    textAlign: 'center',
    padding: 40,
    color: C.textMuted,
    fontSize: 14,
  },
  tableWrap: {
    background: '#fff',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
    animation: 'nhFadeIn 0.3s ease',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 10px',
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase',
    color: C.textMuted,
    borderBottom: `2px solid ${C.border}`,
    whiteSpace: 'nowrap',
    background: '#fff',
  },
  tr: {
    borderBottom: `1px solid ${C.borderLight}`,
    transition: 'background 0.12s',
  },
  td: {
    padding: '8px 10px',
    verticalAlign: 'middle',
    fontSize: 13,
  },
  emptyTd: {
    textAlign: 'center',
    padding: 40,
    color: C.textMuted,
    fontSize: 14,
  },
};
