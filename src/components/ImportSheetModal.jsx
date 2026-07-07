import { useState, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { C } from '../utils/theme';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Chuẩn hóa tên header: bỏ dấu, gộp khoảng trắng/xuống dòng, viết thường.
export function normHeader(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Mã căn hợp lệ: 1-3 chữ cái + >=3 chữ số (T010604, P0112A11...). Loại banner (T01, Park Hill...).
const MA_CAN_RE = /^[A-Za-z]{1,3}\d{3,}/;

/**
 * Modal import file xlsx/csv của bảng hàng công ty vào bảng hàng cá nhân.
 * Props:
 *  - open, onClose
 *  - config: {
 *      title, tabMatch (RegExp), keyField ('Ma_Can'),
 *      previewCols: [{ key, label }],
 *      mapRow(rowObj) => payload   // rowObj: { [normHeader]: value }
 *    }
 *  - existingItems: mảng item hiện có (dò trùng theo keyField)
 *  - onImport(payloads) => Promise<{added, updated}>
 */
export default function ImportSheetModal({ open, onClose, config, existingItems = [], onImport }) {
  const [step, setStep] = useState('file'); // 'file' | 'preview'
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [workbook, setWorkbook] = useState(null);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  // Ghi đè cột Ghi Chú từ bảng công ty lên bảng cá nhân? Mặc định KHÔNG (giữ ghi chú cá nhân).
  const [importGhiChu, setImportGhiChu] = useState(false);
  const fileInputRef = useRef();

  const keyField = config.keyField || 'Ma_Can';

  const existingKeys = useMemo(() => {
    const set = new Set();
    existingItems.forEach(it => {
      const v = (it[keyField] || '').toString().trim().toUpperCase();
      if (v) set.add(v);
    });
    return set;
  }, [existingItems, keyField]);

  // Parse 1 sheet -> danh sách payload thô (chưa phân loại thêm/cập nhật).
  const parseSheet = useCallback((ws) => {
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
      const payload = config.mapRow(rowObj, { statusRgb });
      if (!payload || !(payload[keyField] || '').toString().trim()) continue;
      out.push(payload);
    }
    return out;
  }, [config, keyField]);

  // Danh sách sheet sẽ gộp: multiSheet -> mọi sheet khớp tabMatch; ngược lại -> sheet đang chọn.
  const mergeSheetNames = useMemo(() => {
    if (!workbook) return [];
    if (config.multiSheet && config.tabMatch) {
      return (workbook.SheetNames || []).filter(n => config.tabMatch.test(n));
    }
    return activeSheet ? [activeSheet] : [];
  }, [workbook, activeSheet, config.multiSheet, config.tabMatch]);

  // Gộp payload từ (các) sheet -> phân loại thêm/cập nhật, khử trùng Mã Căn giữa các sheet.
  const parsed = useMemo(() => {
    if (!workbook || !mergeSheetNames.length) return null;
    const seen = new Set();
    const payloads = [];
    let adds = 0, updates = 0;
    for (const name of mergeSheetNames) {
      for (const payload of parseSheet(workbook.Sheets[name])) {
        const key = (payload[keyField] || '').toString().trim().toUpperCase();
        if (seen.has(key)) continue; // trùng giữa các sheet -> giữ bản đầu
        seen.add(key);
        const isDup = existingKeys.has(key);
        payload.__dup = isDup;
        if (isDup) updates++; else adds++;
        payloads.push(payload);
      }
    }
    return { payloads, adds, updates };
  }, [workbook, mergeSheetNames, parseSheet, existingKeys, keyField]);

  const reset = useCallback(() => {
    setStep('file'); setSheetNames([]); setActiveSheet(''); setWorkbook(null);
    setFileName(''); setError(''); setImporting(false); setProgress(0); setResult(null);
    setImportGhiChu(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  async function readFile(file) {
    setError(''); setResult(null);
    if (!file) return;
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!okExt) { setError('Chỉ hỗ trợ file .xlsx, .xls hoặc .csv'); return; }
    try {
      const buf = await file.arrayBuffer();
      // cellStyles:true để đọc màu nền ô (fill) — dùng suy ra trạng thái căn.
      const wb = XLSX.read(buf, { type: 'array', cellStyles: true });
      const names = wb.SheetNames || [];
      if (!names.length) { setError('File không có sheet nào'); return; }
      const match = config.tabMatch ? names.find(n => config.tabMatch.test(n)) : null;
      setWorkbook(wb);
      setSheetNames(names);
      setActiveSheet(match || names[0]);
      setFileName(file.name);
      setStep('preview');
    } catch (e) {
      setError('Không đọc được file: ' + e.message);
    }
  }

  async function handleImport() {
    if (!parsed || !parsed.payloads.length) return;
    try {
      setImporting(true); setProgress(10);
      const clean = parsed.payloads.map(({ __dup, ...rest }) => rest);
      setProgress(40);
      const res = await onImport(clean, { importGhiChu });
      setProgress(100);
      setResult(res || { added: parsed.adds, updated: parsed.updates });
    } catch (e) {
      setError(e.message || 'Import thất bại');
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const previewCols = config.previewCols || [];

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>⬇ {config.title || 'Import bảng hàng'}</span>
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
                hoặc bấm để chọn — hỗ trợ .xlsx / .xls / .csv
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>
                Tải bảng hàng công ty: File → Download → Microsoft Excel (.xlsx)
              </div>
              <input
                ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => readFile(e.target.files?.[0])}
              />
            </div>
          )}

          {step === 'preview' && parsed && (
            <div>
              <div style={s.fileRow}>
                <span style={{ fontSize: 13, color: C.textMuted }}>📄 {fileName}</span>
                {config.multiSheet ? (
                  <span style={{ fontSize: 13, color: C.textMuted }}>
                    Gộp {mergeSheetNames.length} sheet: <strong>{mergeSheetNames.join(', ')}</strong>
                  </span>
                ) : sheetNames.length > 1 && (
                  <label style={{ fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Tab:
                    <select
                      value={activeSheet}
                      onChange={e => setActiveSheet(e.target.value)}
                      style={s.select}
                    >
                      {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                )}
                <button style={s.linkBtn} onClick={() => { setStep('file'); setWorkbook(null); }}>Chọn file khác</button>
              </div>

              <div style={s.statRow}>
                <span style={{ ...s.chip, background: C.primaryBg, color: C.primaryDark }}>➕ Thêm mới: {parsed.adds}</span>
                <span style={{ ...s.chip, background: '#FEF3C7', color: '#92400E' }}>♻ Cập nhật đè: {parsed.updates}</span>
              </div>

              <label style={s.ghiChuToggle}>
                <input
                  type="checkbox"
                  checked={importGhiChu}
                  onChange={e => setImportGhiChu(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: C.primary, cursor: 'pointer' }}
                />
                <span>
                  Import cả cột <strong>Ghi Chú</strong> (ghi đè lên ghi chú cá nhân).{' '}
                  <span style={{ color: C.textDim }}>Bỏ tick = giữ nguyên ghi chú của bạn.</span>
                </span>
              </label>

              {parsed.payloads.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>
                  Không có dòng hợp lệ để import trong tab này.
                </div>
              ) : (
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        {previewCols.map(c => <th key={c.key} style={s.th}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.payloads.slice(0, 30).map((p, i) => (
                        <tr key={i} style={{ background: p.__dup ? '#FFFBEB' : '#fff' }}>
                          <td style={s.tdIdx}>
                            {p.__dup ? <span title="Cập nhật đè" style={{ color: '#B45309' }}>♻</span>
                                     : <span title="Thêm mới" style={{ color: C.primaryDark }}>➕</span>}
                          </td>
                          {previewCols.map(c => (
                            <td key={c.key} style={s.td} title={p[c.key]}>{p[c.key]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.payloads.length > 30 && (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: C.textDim, textAlign: 'center' }}>
                      … và {parsed.payloads.length - 30} dòng nữa
                    </div>
                  )}
                </div>
              )}

              {importing && (
                <div style={{ marginTop: 14 }}>
                  <div style={s.progressTrack}><div style={{ ...s.progressBar, width: `${progress}%` }} /></div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6, textAlign: 'center' }}>Đang ghi dữ liệu…</div>
                </div>
              )}

              {result && (
                <div style={s.resultBox}>
                  ✅ Xong! Đã thêm <strong>{result.added}</strong>, cập nhật <strong>{result.updated}</strong> căn.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={handleClose}>{result ? 'Đóng' : 'Huỷ'}</button>
          {step === 'preview' && !result && (
            <button
              style={{ ...s.importBtn, opacity: (importing || !parsed?.payloads.length) ? 0.6 : 1 }}
              disabled={importing || !parsed?.payloads.length}
              onClick={handleImport}
            >
              {importing ? 'Đang import…' : `Import ${parsed?.payloads.length || 0} căn`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16, fontFamily:F },
  modal:     { background:'#fff', borderRadius:16, width:820, maxWidth:'100%', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:C.shadowLg, overflow:'hidden' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:`linear-gradient(135deg, ${C.primary}, #16A34A)` },
  title:     { fontSize:16, fontWeight:700, color:'#fff' },
  close:     { background:'none', border:'none', fontSize:24, color:'rgba(255,255,255,0.85)', cursor:'pointer', lineHeight:1 },
  body:      { padding:'20px', overflowY:'auto', flex:1 },
  footer:    { display:'flex', gap:10, justifyContent:'flex-end', padding:'12px 20px', borderTop:`1px solid ${C.border}` },
  errorBox:  { background:'#FEF2F2', color:C.error, padding:'10px 14px', borderRadius:10, fontSize:13, marginBottom:14 },
  dropZone:  { border:`2px dashed ${C.border}`, borderRadius:14, padding:'36px 20px', textAlign:'center', cursor:'pointer', background:C.bgInput, transition:'all 0.15s' },
  dropZoneOver: { borderColor:C.primary, background:C.primaryBg },
  fileRow:   { display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:12 },
  select:    { padding:'6px 10px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:F, background:'#fff', color:C.text },
  linkBtn:   { marginLeft:'auto', background:'none', border:'none', color:C.blue, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:F },
  statRow:   { display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 },
  ghiChuToggle: { display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'9px 12px', background:C.bgInput, border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:13, color:C.text, cursor:'pointer', lineHeight:1.4 },
  chip:      { padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:700 },
  tableWrap: { border:`1px solid ${C.border}`, borderRadius:10, overflow:'auto', maxHeight:'44vh' },
  table:     { width:'100%', borderCollapse:'collapse', fontSize:12.5 },
  th:        { textAlign:'left', padding:'8px 10px', fontWeight:700, fontSize:11, textTransform:'uppercase', color:C.textMuted, borderBottom:`2px solid ${C.border}`, background:C.borderLight, whiteSpace:'nowrap', position:'sticky', top:0 },
  td:        { padding:'6px 10px', borderBottom:`1px solid ${C.borderLight}`, color:C.text, whiteSpace:'nowrap', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis' },
  tdIdx:     { padding:'6px 10px', borderBottom:`1px solid ${C.borderLight}`, textAlign:'center' },
  progressTrack: { height:8, background:C.borderLight, borderRadius:6, overflow:'hidden' },
  progressBar:   { height:'100%', background:C.gradient, transition:'width 0.3s ease' },
  resultBox: { marginTop:14, background:C.primaryBg, color:C.primaryDark, padding:'12px 16px', borderRadius:10, fontSize:14, fontWeight:600 },
  cancelBtn: { background:'none', border:`1.5px solid ${C.border}`, borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:F, color:C.textMuted },
  importBtn: { background:C.gradient, color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:C.shadowGreen },
};
