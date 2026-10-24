import { useState, useEffect, useCallback } from 'react';
import { C } from '../utils/theme';
import {
  fetchTelegramNhom, postTelegramNhom,
  fetchTelegramCauHinh, postTelegramCauHinh,
} from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

/**
 * Cấu hình Telegram: token bot + danh sách nhóm của từng bảng.
 * Tách hẳn khỏi hộp gửi hàng, vì đây là cấu hình dùng chung cho cả công ty — sửa nhầm
 * lúc đang gửi hàng thì cả nhóm gửi sai chỗ.
 *
 * Chỉ admin mở được (nút gọi đã chặn sẵn), nhưng vẫn không hiện token đầy đủ: server
 * chỉ trả về "đã có hay chưa" và 4 ký tự cuối.
 */
export default function TelegramSettingsModal({ onClose, showToast }) {
  const [cauHinh, setCauHinh] = useState(null);
  const [nhom, setNhom] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState('');

  const [tokenMoi, setTokenMoi] = useState('');
  const [luuToken, setLuuToken] = useState(false);

  const [tenMoi, setTenMoi] = useState('');
  const [idMoi, setIdMoi] = useState('');
  const [luuNhom, setLuuNhom] = useState(false);

  const tai = useCallback(async () => {
    setDangTai(true);
    try {
      const [ch, ds] = await Promise.all([fetchTelegramCauHinh(), fetchTelegramNhom()]);
      setCauHinh(ch);
      setNhom(Array.isArray(ds) ? ds : []);
      setLoi('');
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangTai(false);
    }
  }, []);

  useEffect(() => { tai(); }, [tai]);

  async function guiToken() {
    const t = tokenMoi.trim();
    if (!t) return showToast('Dán token bot vào đã', 'error');
    setLuuToken(true);
    try {
      const kq = await postTelegramCauHinh({ action: 'save-token', token: t });
      setTokenMoi('');
      await tai();
      showToast(kq.botName ? `Đã lưu token — bot @${kq.botName}` : 'Đã lưu token bot');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLuuToken(false); }
  }

  async function xoaToken() {
    if (!window.confirm('Xoá token bot?\n\nSau khi xoá, nút ✈ ở các bảng sẽ không gửi được nữa.')) return;
    try {
      await postTelegramCauHinh({ action: 'delete-token' });
      await tai();
      showToast('Đã xoá token bot');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function themNhom() {
    const ten = tenMoi.trim(), id = idMoi.trim();
    if (!ten || !id) return showToast('Điền cả tên nhóm và Chat ID', 'error');
    setLuuNhom(true);
    try {
      await postTelegramNhom({ action: 'add', Ten_Nhom: ten, Chat_Id: id });
      setTenMoi(''); setIdMoi('');
      await tai();
      showToast(`Đã thêm nhóm ${ten}`);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLuuNhom(false); }
  }

  async function xoaNhom(n) {
    if (!window.confirm(`Xoá nhóm "${n.Ten_Nhom}" khỏi danh sách?\n\nChỉ xoá ở đây, nhóm trên Telegram không bị gì.`)) return;
    try {
      await postTelegramNhom({ action: 'delete', Ten_Nhom: n.Ten_Nhom });
      await tai();
      showToast(`Đã xoá nhóm ${n.Ten_Nhom}`);
    } catch (e) { showToast(e.message, 'error'); }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>✈ Cấu hình Telegram</span>
          <button onClick={onClose} style={s.x}>✕</button>
        </div>

        {dangTai && <div style={s.info}>Đang tải...</div>}
        {loi && <div style={{ ...s.info, color: C.error }}>{loi}</div>}

        {!dangTai && (
          <>
            {/* ── Token bot ── */}
            <div style={s.sectionLabel}>Token bot</div>
            <div style={s.card}>
              {cauHinh?.coToken ? (
                <div style={s.tokenRow}>
                  <span style={{ fontSize: 13 }}>
                    <span style={{ color: '#38b274', fontWeight: 700 }}>● Đã có token</span>
                    <span style={{ color: '#6b7a94' }}> (…{cauHinh.duoi})</span>
                    <span style={{ color: '#6b7a94' }}>
                      {cauHinh.nguon === 'vercel' ? ' — đang lấy từ biến môi trường Vercel' : ' — lưu trong app'}
                    </span>
                  </span>
                  {cauHinh.nguon === 'app' && (
                    <button onClick={xoaToken} style={s.xoaBtn} title="Xoá token">🗑</button>
                  )}
                </div>
              ) : (
                <div style={{ ...s.info, padding: 0, color: '#F6AD55' }}>
                  ● Chưa có token — nút ✈ ở các bảng sẽ báo lỗi khi gửi.
                </div>
              )}

              <input value={tokenMoi} onChange={e => setTokenMoi(e.target.value)}
                placeholder={cauHinh?.coToken ? 'Dán token mới để thay' : 'Dán token từ @BotFather'}
                type="password" autoComplete="off" style={{ ...s.input, marginTop: 10 }} />
              <button onClick={guiToken} disabled={luuToken} style={s.luuBtn}>
                {luuToken ? 'Đang kiểm tra...' : 'Lưu token'}
              </button>
              <div style={s.hint}>
                Token được hỏi Telegram xem có thật không trước khi lưu. Lưu xong thì
                không hiện lại được nữa — chỉ thấy 4 ký tự cuối.
              </div>
            </div>

            {/* ── Nhóm ── */}
            <div style={s.sectionLabel}>Nhóm nhận tin ({nhom.length})</div>
            <div style={s.card}>
              {nhom.length === 0 && (
                <div style={{ ...s.info, padding: '0 0 10px' }}>Chưa khai báo nhóm nào.</div>
              )}
              {nhom.map(n => (
                <div key={n.Ten_Nhom} style={s.nhomRow}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{n.Ten_Nhom}</span>
                  <span style={{ fontSize: 11, color: '#6b7a94' }}>{n.Chat_Id}</span>
                  <button onClick={() => xoaNhom(n)} style={s.xoaBtn} title="Xoá nhóm">🗑</button>
                </div>
              ))}

              <div style={s.themBox}>
                <input value={tenMoi} onChange={e => setTenMoi(e.target.value)}
                  placeholder="Tên nhóm (VD: B - 1PN)" style={s.input} />
                <input value={idMoi} onChange={e => setIdMoi(e.target.value)}
                  placeholder="Chat ID (VD: -1001234567890)" style={s.input} />
                <button onClick={themNhom} disabled={luuNhom} style={s.luuBtn}>
                  {luuNhom ? 'Đang lưu...' : '+ Thêm nhóm'}
                </button>
              </div>

              <div style={s.hint}>
                Lấy Chat ID: thêm bot vào nhóm, nhắn một tin bất kỳ, rồi mở
                <code style={s.code}>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>
                — nhóm có id âm, dạng -100…
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16, fontFamily:F },
  box:          { background:'#1a1d2e', border:'1px solid #3a3f52', borderRadius:14, padding:18, width:520, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', color:'#e2e8f0' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  x:            { background:'none', border:'none', color:'#8a9bb8', fontSize:18, cursor:'pointer', fontFamily:F },
  sectionLabel: { fontSize:12, color:'#8a9bb8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', margin:'14px 0 8px' },
  card:         { background:'#141726', border:'1px solid #2a2f45', borderRadius:10, padding:12 },
  info:         { fontSize:12.5, color:'#8a9bb8', padding:'8px 0', lineHeight:1.6 },
  tokenRow:     { display:'flex', alignItems:'center', gap:8, lineHeight:1.6 },
  nhomRow:      { display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid #2a2f45' },
  themBox:      { display:'flex', flexDirection:'column', gap:8, marginTop:12 },
  input:        { padding:'9px 12px', border:'1.5px solid #3a3f52', borderRadius:8, background:'#1e2130', color:'#e2e8f0', fontSize:13, fontFamily:F, outline:'none' },
  luuBtn:       { marginTop:8, padding:'9px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#38b274,#2a8a5a)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:F },
  xoaBtn:       { padding:'5px 9px', borderRadius:7, border:'1.5px solid #3a3f52', background:'none', color:C.error, fontSize:12, cursor:'pointer', fontFamily:F },
  hint:         { fontSize:11, color:'#6b7a94', lineHeight:1.7, marginTop:10 },
  code:         { background:'#1e2130', padding:'1px 5px', borderRadius:4, margin:'0 3px', fontSize:10.5, wordBreak:'break-all' },
};
