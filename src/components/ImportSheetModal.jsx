import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { C } from '../utils/theme';
import { normHeader, MA_CAN_RE } from '../utils/quyCanShared';
import { IMPORT_TARGETS, claimSheets, buildDiff, writeImportLog } from '../utils/importQuyCan';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Bảng nào bị xoá quá tỷ lệ này thì hỏi lại trước khi ghi.
const DELETE_WARN_RATIO = 0.3;

// Parse 1 sheet -> danh sách payload thô. Hàm thuần để chạy được cho cả 3 config.
function parseSheet(ws, config, sheetName = '') {
  if (!ws) return [];
  // Giữ blankrows:true để index dòng khớp đúng với hàng thật trong sheet
  // (cần đọc màu nền ô theo đúng địa chỉ ô).
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true });
  if (!rows.length) return [];

  // Tìm dòng header: dòng chứa ô chuẩn hóa === 'ma can'
  let headerIdx = rows.findIndex(r => r.some(c => normHeader(c) === 'ma can'));
  if (headerIdx < 0) headerIdx = 0;
  const headers = rows[headerIdx].map(normHeader);
  const maCanCol = headers.findIndex(h => h === 'ma can');

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const rowObj = {};
    headers.forEach((h, idx) => { if (h) rowObj[h] = r[idx]; });
    const ma = (rowObj['ma can'] || '').toString().trim();
    if (!MA_CAN_RE.test(ma)) continue; // bỏ banner/thiếu mã
    // Đọc màu nền ô Mã Căn (nếu có) để suy ra trạng thái căn.
    let statusRgb;
    if (maCanCol >= 0) {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: maCanCol })];
      statusRgb = cell?.s?.fgColor?.rgb;
    }
    const payload = config.mapRow(rowObj, { statusRgb, sheetName });
    if (!payload || !(payload[config.keyField] || '').toString().trim()) continue;
    out.push(payload);
  }
  return out;
}

/**
 * Modal import bảng hàng công ty. File công ty là MỘT workbook nhiều tab, nên
 * chọn file 1 lần là ghi được cả 3 bảng chính (Thuê / Bán / Đập Thông).
 * Bảng con (*_Con) không bị đụng tới.
 *
 * Props:
 *  - open, onClose
 *  - userId, role     : để GET bản tươi của 3 sheet chính
 *  - onDone(results)  : gọi sau khi ghi xong; trang đang mở tự loadData()
 */
export default function ImportSheetModal({ open, onClose, userId, role, onDone }) {
  const [step, setStep] = useState('file'); // 'file' | 'preview'
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null); // { [key]: {added,updated,deleted} | {error} }
  const [overrides, setOverrides] = useState({}); // { [key]: tên sheet | '' (bỏ qua) }
  const [expanded, setExpanded] = useState(''); // key của bảng đang mở bảng xem trước
  const [existing, setExisting] = useState(null); // { [key]: items[] } — chỉ để đếm preview
  const fileInputRef = useRef();

  const { claims, unclaimed } = useMemo(
    () => (sheetNames.length ? claimSheets(sheetNames, overrides) : { claims: {}, unclaimed: [] }),
    [sheetNames, overrides]
  );

  // Parse từng bảng từ (các) tab đã giành được, khử trùng Mã Căn giữa các tab.
  const parsed = useMemo(() => {
    if (!workbook) return {};
    const out = {};
    for (const t of IMPORT_TARGETS) {
      const names = claims[t.key] || [];
      const seen = new Set();
      const payloads = [];
      for (const name of names) {
        for (const p of parseSheet(workbook.Sheets[name], t.config, name)) {
          const key = (p[t.config.keyField] || '').toString().trim().toUpperCase();
          if (seen.has(key)) continue; // trùng giữa các tab -> giữ bản đầu
          seen.add(key);
          payloads.push(p);
        }
      }
      out[t.key] = { sheets: names, payloads };
    }
    return out;
  }, [workbook, claims]);

  // Đếm thêm/cập nhật/xoá cho preview (số ước lượng; lúc ghi sẽ GET lại bản tươi).
  const stats = useMemo(() => {
    const out = {};
    for (const t of IMPORT_TARGETS) {
      const payloads = parsed[t.key]?.payloads || [];
      const items = existing?.[t.key];
      if (!items) { out[t.key] = null; continue; }
      const have = new Set(items.map(it => (it.Ma_Can || '').trim().toUpperCase()).filter(Boolean));
      const incoming = new Set(payloads.map(p => (p.Ma_Can || '').trim().toUpperCase()).filter(Boolean));
      let adds = 0, updates = 0;
      incoming.forEach(k => (have.has(k) ? updates++ : adds++));
      const deletes = [...have].filter(k => !incoming.has(k)).length;
      out[t.key] = { adds, updates, deletes, total: items.length };
    }
    return out;
  }, [parsed, existing]);

  // Nạp bản hiện có của 3 bảng để preview biết được sẽ thêm/xoá bao nhiêu.
  useEffect(() => {
    if (step !== 'preview' || existing) return;
    let alive = true;
    Promise.all(IMPORT_TARGETS.map(t => t.fetchFn(userId, role).catch(() => null)))
      .then(lists => {
        if (!alive) return;
        const map = {};
        IMPORT_TARGETS.forEach((t, i) => { map[t.key] = lists[i]; });
        setExisting(map);
      });
    return () => { alive = false; };
  }, [step, existing, userId, role]);

  const reset = useCallback(() => {
    setStep('file'); setWorkbook(null); setSheetNames([]); setFileName('');
    setError(''); setImporting(false); setProgress(''); setResults(null);
    setOverrides({}); setExpanded(''); setExisting(null);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  async function readFile(file) {
    setError(''); setResults(null); setExisting(null); setOverrides({});
    if (!file) return;
    // Bỏ .csv: csv chỉ có 1 sheet tên "Sheet1", không khớp bảng nào -> import rỗng.
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError('Chỉ hỗ trợ file .xlsx hoặc .xls'); return; }
    try {
      const buf = await file.arrayBuffer();
      // cellStyles:true để đọc màu nền ô (fill) — dùng suy ra trạng thái căn.
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
      const names = wb.SheetNames || [];
      if (!names.length) { setError('File không có sheet nào'); return; }
      setWorkbook(wb);
      setSheetNames(names);
      setFileName(file.name);
      setStep('preview');
    } catch (e) {
      setError('Không đọc được file: ' + e.message);
    }
  }

  // Bảng sẽ được ghi: có tab khớp VÀ parse ra ít nhất 1 dòng.
  // Parse ra 0 dòng (công ty đổi tên cột "Mã Căn") thì coi như không tìm thấy tab
  // — nếu ghi thì `deletes` sẽ là toàn bộ sheet.
  const runnable = IMPORT_TARGETS.filter(t => (parsed[t.key]?.payloads.length || 0) > 0);

  async function handleImport() {
    // Bấm "Thử lại" thì chỉ chạy lại bảng bị lỗi, không đụng bảng đã ghi xong.
    const todo = results ? runnable.filter(t => results[t.key]?.error) : runnable;
    if (!todo.length) return;
    setError(''); setImporting(true);
    try {
      // GET lại ngay trước khi ghi để _rowIndex không lệch (sheet chính dùng chung).
      setProgress('Đang đọc bảng hàng hiện tại…');
      const fresh = {};
      await Promise.all(todo.map(async t => { fresh[t.key] = await t.fetchFn(userId, role); }));

      const plans = [];
      const wipes = [];   // xoá SẠCH -> chặn cứng
      const risky = [];   // xoá > 30% -> hỏi lại
      for (const t of todo) {
        const list = fresh[t.key] || [];
        const diff = buildDiff(parsed[t.key].payloads, list, { withSTT: t.withSTT });
        if (list.length && diff.deletes.length === list.length) { wipes.push(t); continue; }
        if (list.length && diff.deletes.length > list.length * DELETE_WARN_RATIO) {
          risky.push(`• ${t.label}: xoá ${diff.deletes.length}/${list.length} căn`);
        }
        plans.push({ target: t, diff });
      }

      if (risky.length) {
        const ok = window.confirm(
          `Cảnh báo: file import sẽ XOÁ nhiều căn khỏi bảng hàng công ty:\n\n${risky.join('\n')}\n\n` +
          `Có thể bạn chọn nhầm file hoặc file thiếu dữ liệu. Vẫn tiếp tục?`
        );
        if (!ok) { setImporting(false); setProgress(''); return; }
      }

      const out = { ...results };
      wipes.forEach(t => {
        out[t.key] = { error: 'Không có căn nào khớp với bảng hiện tại — bỏ qua để không xoá sạch bảng.' };
      });

      // Ghi tuần tự, mỗi bảng try/catch riêng: 1 bảng lỗi không chặn 2 bảng còn lại.
      for (let i = 0; i < plans.length; i++) {
        const { target: t, diff } = plans[i];
        setProgress(`Đang ghi ${t.label}… (${i + 1}/${plans.length})`);
        try {
          const res = await t.postFn({ action: 'bulk', ...diff });
          out[t.key] = {
            added: res.added ?? diff.adds.length,
            updated: res.updated ?? diff.updates.length,
            deleted: res.deleted ?? diff.deletes.length,
          };
          writeImportLog(t.logKey, parsed[t.key].payloads.slice(0, 5).map(p => p.Ma_Can));
        } catch (e) {
          out[t.key] = { error: e.message || 'Ghi thất bại' };
        }
      }

      setResults(out);
      setExisting(null); // buộc preview đếm lại nếu user bấm Thử lại
      onDone?.(out);
    } catch (e) {
      setError(e.message || 'Import thất bại');
    } finally {
      setImporting(false);
      setProgress('');
    }
  }

  if (!open) return null;

  const hasError = results && Object.values(results).some(r => r.error);

  return (
    <div style={s.overlay} onClick={importing ? undefined : handleClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>⬇ Import bảng hàng công ty → Thuê / Bán / Đập Thông</span>
          <button style={s.close} onClick={handleClose}>×</button>
        </div>

        <div style={s.body}>
          {error && <div style={s.errorBox}>{error}</div>}

          {step === 'file' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
              style={{ ...s.dropZone, ...(dragOver ? s.dropZoneOver : {}) }}
            >
              <div style={{ fontSize: 40 }}>📄</div>
              <div style={{ fontWeight: 700, color: C.text, marginTop: 8 }}>Kéo thả file Excel vào đây</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                hoặc bấm để chọn — hỗ trợ .xlsx / .xls
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>
                Tải bảng hàng công ty: File → Download → Microsoft Excel (.xlsx)
                <br />Một file là nạp đủ cả 3 bảng.
              </div>
              <input
                ref={fileInputRef} type="file" accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => readFile(e.target.files?.[0])}
              />
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={s.fileRow}>
                <span style={{ fontSize: 13, color: C.textMuted }}>📄 {fileName}</span>
                {!importing && !results && (
                  <button style={s.linkBtn} onClick={reset}>Chọn file khác</button>
                )}
              </div>

              {IMPORT_TARGETS.map(t => {
                const p = parsed[t.key];
                const st = stats[t.key];
                const res = results?.[t.key];
                const n = p?.payloads.length || 0;
                const skipped = n === 0;
                return (
                  <div key={t.key} style={{ ...s.targetCard, ...(skipped ? s.targetCardSkip : {}) }}>
                    <div style={s.targetHead}>
                      <span style={{ fontWeight: 700, color: C.text }}>
                        {skipped ? '⚠️' : '✅'} {t.label}
                      </span>
                      {skipped ? (
                        <span style={{ fontSize: 12.5, color: '#B45309' }}>
                          không tìm thấy tab hợp lệ — <strong>sẽ bỏ qua</strong>, không xoá gì
                        </span>
                      ) : (
                        <>
                          <span style={{ fontSize: 12.5, color: C.textMuted }}>
                            ← <strong>{p.sheets.join(' + ')}</strong> · {n} căn
                          </span>
                          {st && (
                            <span style={{ fontSize: 12.5, color: C.textMuted }}>
                              ➕{st.adds} ♻{st.updates} 🗑{st.deletes}
                            </span>
                          )}
                          <button style={s.linkBtnInline} onClick={() => setExpanded(expanded === t.key ? '' : t.key)}>
                            {expanded === t.key ? 'Ẩn' : 'Xem'}
                          </button>
                        </>
                      )}
                      {!importing && !results && (
                        <label style={s.tabPick}>
                          Tab:
                          <select
                            value={overrides[t.key] ?? '__auto'}
                            onChange={e => {
                              const v = e.target.value;
                              setOverrides(prev => {
                                const next = { ...prev };
                                if (v === '__auto') delete next[t.key]; else next[t.key] = v;
                                return next;
                              });
                            }}
                            style={s.select}
                          >
                            <option value="__auto">(tự động)</option>
                            <option value="">(bỏ qua)</option>
                            {sheetNames.map(nm => <option key={nm} value={nm}>{nm}</option>)}
                          </select>
                        </label>
                      )}
                    </div>

                    {res && (
                      <div style={{ ...s.resLine, color: res.error ? C.error : C.primaryDark }}>
                        {res.error
                          ? `❌ ${res.error}`
                          : `✅ Thêm ${res.added}, cập nhật ${res.updated}, xoá ${res.deleted}`}
                      </div>
                    )}

                    {expanded === t.key && !skipped && (
                      <div style={s.tableWrap}>
                        <table style={s.table}>
                          <thead>
                            <tr>{t.config.previewCols.map(c => <th key={c.key} style={s.th}>{c.label}</th>)}</tr>
                          </thead>
                          <tbody>
                            {p.payloads.slice(0, 30).map((row, i) => (
                              <tr key={i}>
                                {t.config.previewCols.map(c => (
                                  <td key={c.key} style={s.td} title={row[c.key]}>{row[c.key]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {n > 30 && (
                          <div style={{ padding: '8px 12px', fontSize: 12, color: C.textDim, textAlign: 'center' }}>
                            … và {n - 30} dòng nữa
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {unclaimed.length > 0 && (
                <div style={s.unclaimed}>
                  Tab không dùng đến: <strong>{unclaimed.join(', ')}</strong>
                </div>
              )}

              {importing && (
                <div style={{ marginTop: 14, fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
                  ⏳ {progress}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={handleClose} disabled={importing}>
            {results && !hasError ? 'Đóng' : 'Huỷ'}
          </button>
          {step === 'preview' && (!results || hasError) && (
            <button
              style={{ ...s.importBtn, opacity: (importing || !runnable.length) ? 0.6 : 1 }}
              disabled={importing || !runnable.length}
              onClick={handleImport}
            >
              {importing ? 'Đang import…'
                : results ? 'Thử lại'
                : `Import ${runnable.length} bảng`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16, fontFamily:F },
  modal:     { background:'#fff', borderRadius:16, width:860, maxWidth:'100%', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:C.shadowLg, overflow:'hidden' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:`linear-gradient(135deg, ${C.primary}, #16A34A)` },
  title:     { fontSize:15, fontWeight:700, color:'#fff' },
  close:     { background:'none', border:'none', fontSize:24, color:'rgba(255,255,255,0.85)', cursor:'pointer', lineHeight:1 },
  body:      { padding:'20px', overflowY:'auto', flex:1 },
  footer:    { display:'flex', gap:10, justifyContent:'flex-end', padding:'12px 20px', borderTop:`1px solid ${C.border}` },
  errorBox:  { background:'#FEF2F2', color:C.error, padding:'10px 14px', borderRadius:10, fontSize:13, marginBottom:14 },
  dropZone:  { border:`2px dashed ${C.border}`, borderRadius:14, padding:'36px 20px', textAlign:'center', cursor:'pointer', background:C.bgInput, transition:'all 0.15s' },
  dropZoneOver: { borderColor:C.primary, background:C.primaryBg },
  fileRow:   { display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:12 },
  select:    { padding:'4px 8px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12.5, fontFamily:F, background:'#fff', color:C.text, maxWidth:170 },
  linkBtn:   { marginLeft:'auto', background:'none', border:'none', color:C.blue, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:F },
  linkBtnInline: { background:'none', border:'none', color:C.blue, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:F, padding:0 },
  targetCard: { border:`1.5px solid ${C.border}`, borderRadius:12, padding:'10px 14px', marginBottom:10, background:'#fff' },
  targetCardSkip: { background:'#FFFBEB', borderColor:'#FCD34D' },
  targetHead: { display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' },
  tabPick:   { marginLeft:'auto', display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:C.textMuted },
  resLine:   { marginTop:8, fontSize:13, fontWeight:600 },
  unclaimed: { marginTop:4, fontSize:12.5, color:C.textDim },
  tableWrap: { marginTop:10, border:`1px solid ${C.border}`, borderRadius:10, overflow:'auto', maxHeight:'34vh' },
  table:     { width:'100%', borderCollapse:'collapse', fontSize:12.5 },
  th:        { textAlign:'left', padding:'8px 10px', fontWeight:700, fontSize:11, textTransform:'uppercase', color:C.textMuted, borderBottom:`2px solid ${C.border}`, background:C.borderLight, whiteSpace:'nowrap', position:'sticky', top:0 },
  td:        { padding:'6px 10px', borderBottom:`1px solid ${C.borderLight}`, color:C.text, whiteSpace:'nowrap', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis' },
  cancelBtn: { background:'none', border:`1.5px solid ${C.border}`, borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:F, color:C.textMuted },
  importBtn: { background:C.gradient, color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:C.shadowGreen },
};
