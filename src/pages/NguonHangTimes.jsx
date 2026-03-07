import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { fetchXlsxImport, postXlsxImport } from '../utils/api';
import NguonHangCustomPanel from './NguonHangCustomPanel';
import * as XLSX from 'xlsx';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Sheets giữ nguyên format gốc (không xử lý bỏ row chú thích)
const RAW_SHEETS = ['Homestay', 'SĐT của đầu tư & Thợ'];

// Rows chú thích cần bỏ (chứa text này ở bất kỳ cell nào)
const LEGEND_TEXTS = ['CĂN HỘ GIÁ TỐT', 'DỪNG BÁN', 'DỪNG CHO THUÊ', 'ĐÃ BÁN'];

export function NguonHangContent() {
  return <NguonHangInner showHeader={false} />;
}

export default function NguonHangTimes() {
  return <NguonHangInner showHeader={true} />;
}

function NguonHangInner({ showHeader }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('company');
  const [sheetsData, setSheetsData] = useState([]);
  const [importDate, setImportDate] = useState(null);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes nhFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .nh-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .nh-table-wrap::-webkit-scrollbar { height: 6px; }
      .nh-table-wrap::-webkit-scrollbar-thumb { background: ${C.textDim}; border-radius: 3px; }
      .nh-row:hover { filter: brightness(0.96); }
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

  // Load saved XLSX data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchXlsxImport();
      const sheets = data.sheets || [];
      setSheetsData(sheets);
      setImportDate(data.importDate || null);
      if (sheets.length > 0 && !activeTab) {
        setActiveTab(sheets[0].name);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Parse XLSX file
  const handleFileImport = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportProgress('Đang đọc file...');
      setError('');

      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { cellStyles: true });

      setImportProgress(`Đang parse ${wb.SheetNames.length} sheets...`);

      const parsedSheets = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const ref = ws['!ref'];
        if (!ref) continue;

        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rawData.length === 0) continue;

        const isRawSheet = RAW_SHEETS.some(rs => sheetName.includes(rs) || rs.includes(sheetName));
        const range = XLSX.utils.decode_range(ref);
        const merges = ws['!merges'] || [];

        // Extract all cell colors
        const cellColors = {};
        for (let r = 0; r <= range.e.r; r++) {
          for (let c = 0; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            if (cell?.s?.patternType === 'solid' && cell.s.fgColor?.rgb) {
              const rgb = cell.s.fgColor.rgb;
              // Skip white and near-white
              if (rgb !== 'FFFFFF' && rgb !== 'ffffff') {
                cellColors[`${r}_${c}`] = `#${rgb}`;
              }
            }
          }
        }

        if (isRawSheet) {
          // Giữ nguyên format gốc cho Homestay, SĐT
          parsedSheets.push({
            name: sheetName,
            type: 'raw',
            data: rawData.slice(0, 500), // Limit rows
            colors: cellColors,
            merges: merges.slice(0, 200),
          });
        } else {
          // Xử lý sheet dữ liệu (Quỹ căn, Hàng đầu tư, etc.)
          const headers = rawData[0].map((h, idx) => {
            const trimmed = (h || '').toString().replace(/\n/g, ' ').trim();
            if (idx === 0 && !trimmed) return 'Ngày Phát Sinh';
            return trimmed || `Col_${idx}`;
          });

          // Filter meaningful columns (bỏ cột trống ở cuối)
          let lastMeaningfulCol = 0;
          for (let c = 0; c < headers.length; c++) {
            if (headers[c] && !headers[c].startsWith('Col_')) {
              lastMeaningfulCol = c;
            }
          }
          // Thêm ít nhất cột tiếp theo nếu có data
          const maxCol = Math.min(lastMeaningfulCol + 2, headers.length);
          const trimmedHeaders = headers.slice(0, maxCol);

          // Process data rows
          const items = [];
          for (let r = 1; r < rawData.length; r++) {
            const row = rawData[r];
            const rowValues = row.slice(0, maxCol);

            // Bỏ dòng chú thích (row 2, 3: "CĂN HỘ GIÁ TỐT", "DỪNG BÁN")
            const rowText = rowValues.map(v => (v || '').toString().trim().toUpperCase()).join(' ');
            if (LEGEND_TEXTS.some(lt => rowText.includes(lt))) continue;

            // Bỏ dòng trống hoàn toàn
            if (!rowValues.some(v => v !== '' && v !== undefined && v !== null)) continue;

            // Build item
            const item = { _row: r };
            const itemColors = {};
            let isGroupHeader = false;

            trimmedHeaders.forEach((h, c) => {
              let val = rowValues[c];

              // Convert Excel serial date to readable date
              if (c <= 1 && typeof val === 'number' && val > 40000 && val < 50000) {
                const date = excelDateToString(val);
                val = date;
              }

              item[h] = val !== undefined && val !== null ? String(val) : '';

              // Get cell color
              const colorKey = `${r}_${c}`;
              if (cellColors[colorKey]) {
                itemColors[h] = cellColors[colorKey];
              }
            });

            // Check nếu là dòng group header (VD: "T01", "P09", "Times City")
            // Group header: chỉ cell đầu tiên có giá trị, các cell khác trống, và có bg cam (FF9900)
            const filledCells = Object.values(item).filter((v, i) => i > 0 && v && v !== '0' && i < 5).length;
            const firstCellColor = cellColors[`${r}_0`];
            if (filledCells <= 1 && firstCellColor === '#FF9900') {
              isGroupHeader = true;
            }
            // Also check merged rows
            const isMerged = merges.some(m => m.s.r === r && (m.e.c - m.s.c) >= 3);
            if (isMerged) isGroupHeader = true;

            if (Object.keys(itemColors).length > 0) {
              item._colors = itemColors;
            }
            if (isGroupHeader) {
              item._isGroup = true;
            }

            items.push(item);
          }

          parsedSheets.push({
            name: sheetName,
            type: 'data',
            headers: trimmedHeaders,
            items: items.slice(0, 2000), // Limit
            totalRows: items.length,
          });
        }
      }

      setImportProgress(`Đang lưu ${parsedSheets.length} sheets...`);

      // Save to API
      await postXlsxImport(parsedSheets);

      setSheetsData(parsedSheets);
      setImportDate(new Date().toLocaleString('vi-VN'));
      if (parsedSheets.length > 0) {
        setActiveTab(parsedSheets[0].name);
      }
      setImportProgress('');
      setImporting(false);
    } catch (err) {
      setError('Lỗi import: ' + err.message);
      setImporting(false);
      setImportProgress('');
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Get current sheet data
  const currentSheet = useMemo(() => {
    return sheetsData.find(s => s.name === activeTab) || null;
  }, [sheetsData, activeTab]);

  // Filtered items for data sheets
  const filtered = useMemo(() => {
    if (!currentSheet || currentSheet.type !== 'data') return [];
    const items = currentSheet.items || [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item =>
      Object.entries(item).some(([k, v]) =>
        k !== '_row' && k !== '_colors' && k !== '_isGroup' &&
        (v || '').toString().toLowerCase().includes(q)
      )
    );
  }, [currentSheet, search]);

  const tabNames = useMemo(() => sheetsData.map(s => s.name), [sheetsData]);

  return (
    <div style={showHeader ? s.root : { fontFamily: F, color: C.text }}>
      {showHeader && (
        <div style={s.header}>
          <div style={s.headerInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => navigate('/')} style={s.backBtn} className="nh-tab">&larr;</button>
              <div>
                <div style={s.headerTitle}>Nguồn Hàng Times City</div>
                <div style={s.headerSub}>Quỹ căn bất động sản</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={showHeader ? s.container : { padding: '0' }}>
        {/* Toggle: Quỹ căn công ty / Phòng của tôi */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setViewMode('company')}
            className="nh-tab"
            style={{ ...s.viewToggle, ...(viewMode === 'company' ? s.viewToggleActive : {}) }}
          >
            Quỹ căn công ty
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className="nh-tab"
            style={{ ...s.viewToggle, ...(viewMode === 'custom' ? s.viewToggleActive : {}) }}
          >
            Phòng của tôi
          </button>
        </div>

        {viewMode === 'custom' && <NguonHangCustomPanel />}

        {viewMode === 'company' && (
          <>
            {/* Import row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                style={s.importBtn}
                className="nh-tab"
              >
                {importing ? '⏳ Đang import...' : '📁 Import XLSX'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
              <button
                onClick={loadData}
                disabled={loading}
                style={s.reloadBtn}
                className="nh-tab"
                title="Tải lại"
              >
                {loading ? '...' : '↻'}
              </button>
              {importDate && (
                <span style={{ fontSize: 11, color: C.textMuted }}>
                  Cập nhật: {importDate}
                </span>
              )}
            </div>

            {importProgress && (
              <div style={{ padding: '8px 16px', background: C.primaryBg, borderRadius: 8, fontSize: 13, color: C.primary, marginBottom: 12 }}>
                {importProgress}
              </div>
            )}

            {error && <div style={s.errorBox}>{error}</div>}
            {loading && <div style={s.loadingBox}>Đang tải dữ liệu...</div>}

            {!loading && sheetsData.length === 0 && !error && (
              <div style={s.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Chưa có dữ liệu</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>
                  Bấm "Import XLSX" để tải file Bảng Hàng lên
                </div>
              </div>
            )}

            {!loading && sheetsData.length > 0 && (
              <>
                {/* Sheet tabs */}
                <div className="nh-tabs-wrap" style={s.tabsWrap}>
                  <div style={s.tabsInner}>
                    {tabNames.map(name => (
                      <button
                        key={name}
                        onClick={() => { setActiveTab(name); setSearch(''); }}
                        className="nh-tab"
                        style={{ ...s.tabBtn, ...(name === activeTab ? s.tabActive : {}) }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                {currentSheet?.type === 'data' && (
                  <>
                    {/* Search */}
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
                        {search && <button onClick={() => setSearch('')} style={s.clearBtn}>&times;</button>}
                      </div>
                      <div style={s.resultCount}>{filtered.length} / {currentSheet.items.length} dòng</div>
                    </div>

                    {/* Data table */}
                    <div className="nh-table-wrap" style={s.tableWrap}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            <th style={s.th}>#</th>
                            {currentSheet.headers.map((h, i) => (
                              <th key={`${h}_${i}`} style={s.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={currentSheet.headers.length + 1} style={s.emptyTd}>
                                Không tìm thấy kết quả
                              </td>
                            </tr>
                          ) : (
                            filtered.map((item, idx) => {
                              const colors = item._colors || {};
                              const isGroup = item._isGroup;

                              if (isGroup) {
                                return (
                                  <tr key={item._row} style={{ background: '#FF9900' }}>
                                    <td colSpan={currentSheet.headers.length + 1} style={{
                                      padding: '8px 12px', fontWeight: 800, fontSize: 13,
                                      color: '#fff', textTransform: 'uppercase',
                                    }}>
                                      {currentSheet.headers.map(h => item[h] || '').filter(Boolean).join(' ')}
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={item._row} className="nh-row" style={s.tr}>
                                  <td style={{ ...s.td, color: C.textDim, fontSize: 11, textAlign: 'center' }}>{idx + 1}</td>
                                  {currentSheet.headers.map((h, ci) => {
                                    const cellBg = colors[h];
                                    const cellStyle = getCellStyle(h, item[h]);
                                    return (
                                      <td key={`${h}_${ci}`} style={{
                                        ...cellStyle,
                                        ...(cellBg ? { background: cellBg } : {}),
                                      }}>
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
                  </>
                )}

                {currentSheet?.type === 'raw' && (
                  <RawSheetView sheet={currentSheet} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Raw sheet view (Homestay, SĐT) ──
function RawSheetView({ sheet }) {
  const data = sheet.data || [];
  const colors = sheet.colors || {};

  if (data.length === 0) return <div style={s.emptyTd}>Không có dữ liệu</div>;

  // Determine max columns
  const maxCols = data.reduce((m, row) => Math.max(m, row.length), 0);

  return (
    <div className="nh-table-wrap" style={s.tableWrap}>
      <table style={s.table}>
        <tbody>
          {data.map((row, r) => {
            // Skip fully empty rows
            if (!row.some(v => v !== '' && v !== undefined && v !== null)) return null;

            return (
              <tr key={r} className="nh-row" style={s.tr}>
                {Array.from({ length: maxCols }, (_, c) => {
                  const val = row[c];
                  const colorKey = `${r}_${c}`;
                  const bg = colors[colorKey];
                  const isHeader = bg === '#FF9900' || bg === '#FCE5CD' || bg === '#C9DAF8' || bg === '#FFD966' || bg === '#F9CB9C' || bg === '#F4CCCC' || bg === '#D9D9D9' || bg === '#A4C2F4';

                  let displayVal = val;
                  if (typeof val === 'number' && val > 40000 && val < 50000 && r > 0) {
                    displayVal = excelDateToString(val);
                  }

                  return (
                    <td key={c} style={{
                      padding: '6px 8px', fontSize: 12, verticalAlign: 'middle',
                      borderBottom: `1px solid ${C.borderLight}`,
                      ...(bg ? { background: bg } : {}),
                      ...(isHeader ? { fontWeight: 700, color: bg === '#FF9900' ? '#fff' : C.text } : {}),
                      whiteSpace: 'nowrap',
                    }}>
                      {displayVal !== undefined && displayVal !== null ? String(displayVal) : ''}
                    </td>
                  );
                })}
              </tr>
            );
          }).filter(Boolean)}
        </tbody>
      </table>
    </div>
  );
}

// ── Helpers ──
function excelDateToString(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const d = new Date(utcMs);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function renderCell(header, value) {
  if (!value || value === '0') return value === '0' ? '0' : '';
  const h = header.toLowerCase();
  if (h.includes('hình') || h.includes('ảnh') || h.includes('image') || h.includes('link')) {
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: C.blue || '#2563EB', fontSize: 12, textDecoration: 'underline' }}>
          Xem
        </a>
      );
    }
  }
  return value;
}

function getCellStyle(header, value) {
  const h = header.toLowerCase();
  const base = { padding: '8px 10px', verticalAlign: 'middle', fontSize: 13 };

  if (h.includes('giá') || h.includes('phí') || h === 'giá' || h === 'phí') {
    return { ...base, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' };
  }
  if (h === 'sđt' || h === 'sdt' || h.includes('điện thoại') || h.includes('sdt')) {
    return { ...base, whiteSpace: 'nowrap' };
  }
  if (h.includes('ghi chú') || h.includes('note')) {
    return { ...base, maxWidth: 200, whiteSpace: 'pre-line', fontSize: 12, color: C.textMuted };
  }
  if (h.includes('ngày') || h.includes('date') || h.includes('cập nhật') || h.includes('phát sinh')) {
    return { ...base, whiteSpace: 'nowrap', fontSize: 12 };
  }
  if (h === 'mã căn' || h.includes('mã')) {
    return { ...base, fontWeight: 600, whiteSpace: 'nowrap' };
  }
  if (h === 'pn' || h === 'm2' || h === 'bc' || h === 'dt (m2)' || h.includes('diện tích')) {
    return { ...base, textAlign: 'center' };
  }
  return base;
}

// ── Styles ──
const s = {
  root: { fontFamily: F, background: C.bg, minHeight: '100vh', color: C.text },
  viewToggle: {
    padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
    background: '#fff', color: C.textMuted, border: `1.5px solid ${C.border}`, cursor: 'pointer',
  },
  viewToggleActive: {
    background: C.primary, color: '#fff', border: '1.5px solid transparent', boxShadow: C.shadowGreen,
  },
  header: {
    background: '#fff', borderBottom: `1px solid ${C.border}`,
    position: 'sticky', top: 0, zIndex: 100, boxShadow: C.shadow,
  },
  headerInner: {
    maxWidth: 1400, margin: '0 auto', padding: '12px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: 800, color: C.primary, letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  backBtn: {
    background: C.primaryBg, borderRadius: 8, width: 36, height: 36, fontSize: 18,
    color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
  },
  importBtn: {
    background: C.gradient, color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: F, boxShadow: C.shadowGreen, transition: 'all 0.15s', whiteSpace: 'nowrap',
  },
  reloadBtn: {
    background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10,
    width: 40, height: 40, fontSize: 20, color: C.primary, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: F,
  },
  container: { maxWidth: 1500, margin: '0 auto', padding: '16px 16px' },
  tabsWrap: { marginBottom: 16, overflowX: 'auto' },
  tabsInner: { display: 'flex', gap: 6, whiteSpace: 'nowrap', paddingBottom: 4 },
  tabBtn: {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: '#fff', color: C.textMuted, border: `1.5px solid ${C.border}`,
  },
  tabActive: {
    background: C.gradient, color: '#fff', border: '1.5px solid transparent', boxShadow: C.shadowGreen,
  },
  filterRow: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 },
  searchWrap: { flex: 1, position: 'relative', minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 },
  searchInput: {
    width: '100%', padding: '10px 36px', border: `1.5px solid ${C.border}`, borderRadius: 10,
    fontSize: 13, fontFamily: F, outline: 'none', background: '#fff', boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', fontSize: 18, color: C.textMuted, cursor: 'pointer', padding: '0 4px',
  },
  resultCount: { fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' },
  errorBox: { background: '#FEF2F2', color: C.error, padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  loadingBox: { textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: C.textMuted },
  tableWrap: {
    background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`,
    boxShadow: C.shadow, animation: 'nhFadeIn 0.3s ease',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 10px', fontWeight: 700, fontSize: 11,
    textTransform: 'uppercase', color: C.textMuted, borderBottom: `2px solid ${C.border}`,
    whiteSpace: 'nowrap', background: '#fff',
  },
  tr: { borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.12s' },
  td: { padding: '8px 10px', verticalAlign: 'middle', fontSize: 13 },
  emptyTd: { textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 },
};
