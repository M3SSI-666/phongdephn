import { useState } from 'react';
import dataCan from '../data/dataCan.json';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Normalize input the same way as the build script:
// uppercase + strip everything that is not A-Z or 0-9
function normCode(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function DataCanContent() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // null = chưa tìm, [] = không thấy, [...] = kết quả
  const [searchedCode, setSearchedCode] = useState('');

  function handleSearch() {
    const code = normCode(input);
    setSearchedCode(code);
    if (!code) { setResult(null); return; }
    setResult(dataCan[code] || []);
  }

  function copyPhone(sdt) {
    if (!sdt) return;
    navigator.clipboard?.writeText(sdt);
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>Tra cứu thông tin chủ căn</div>
        <div style={s.sub}>Nhập mã căn để tìm tên chủ nhà và số điện thoại</div>

        <div style={s.searchRow}>
          <input
            style={s.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Ví dụ: T010301, P010201..."
            autoFocus
          />
          <button style={s.btn} onClick={handleSearch}>Tìm</button>
        </div>

        {/* Kết quả */}
        {result !== null && (
          <div style={{ marginTop: 18 }}>
            {result.length === 0 ? (
              <div style={s.notFound}>Không tìm thấy mã căn <strong>{searchedCode}</strong></div>
            ) : (
              <>
                <div style={s.resultHead}>
                  Mã căn <span style={s.code}>{searchedCode}</span>
                  {result.length > 1 && <span style={s.multi}>{result.length} chủ</span>}
                </div>
                <div style={s.list}>
                  {result.map((r, i) => (
                    <div key={i} style={s.item}>
                      <div style={s.itemRow}>
                        <span style={s.label}>Chủ nhà</span>
                        <span style={s.value}>{r.ten || '—'}</span>
                      </div>
                      <div style={s.itemRow}>
                        <span style={s.label}>SĐT</span>
                        <span style={s.phoneList}>
                          {(r.sdt && r.sdt.length > 0) ? r.sdt.map((p, j) => (
                            <span key={j} style={{ ...s.value, ...s.phone }} onClick={() => copyPhone(p)} title="Bấm để copy">
                              {p}
                            </span>
                          )) : <span style={s.value}>—</span>}
                        </span>
                      </div>
                      {r.ghiChu && (
                        <div style={s.itemRow}>
                          <span style={s.label}>Ghi chú</span>
                          <span style={s.value}>{r.ghiChu}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap:       { fontFamily: F, maxWidth: 560, margin: '0 auto' },
  card:       { background: '#13151e', border: '1px solid #2d3240', borderRadius: 16, padding: '24px 20px' },
  title:      { fontSize: 18, fontWeight: 800, color: '#22C55E' },
  sub:        { fontSize: 13, color: '#8a9bb8', marginTop: 4, marginBottom: 18 },
  searchRow:  { display: 'flex', gap: 10 },
  input:      { flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #3a3f52', background: '#0f1117', color: '#e2e8f0', fontSize: 15, fontFamily: F, outline: 'none', textTransform: 'uppercase' },
  btn:        { padding: '12px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: F },
  notFound:   { padding: '16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', color: '#fca5a5', fontSize: 14, textAlign: 'center' },
  resultHead: { fontSize: 14, color: '#8a9bb8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 },
  code:       { color: '#22C55E', fontWeight: 800, fontSize: 16 },
  multi:      { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(246,173,85,0.18)', color: '#F6AD55' },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },
  item:       { background: '#1a1d27', border: '1px solid #2d3240', borderRadius: 12, padding: '14px 16px' },
  itemRow:    { display: 'flex', alignItems: 'baseline', gap: 12, padding: '4px 0' },
  label:      { fontSize: 12, color: '#8a9bb8', width: 64, flexShrink: 0 },
  value:      { fontSize: 15, color: '#e2e8f0', fontWeight: 600 },
  phoneList:  { display: 'flex', flexDirection: 'column', gap: 4 },
  phone:      { color: '#4ADE80', cursor: 'pointer', letterSpacing: 0.5 },
};
