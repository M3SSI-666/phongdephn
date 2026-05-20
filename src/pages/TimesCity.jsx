import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { KhachTimesContent } from './KhachTimes';
import { QuyCanThueContent } from './QuyCanThue';
import { QuyCanBanContent } from './NguonHangTimes';
import { QuyShophouseContent } from './QuyShophouse';
import { QuyHomestayContent } from './QuyHomestay';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";
const DEFAULT_PASS = 'Anhtungdeptrai';
const STORAGE_KEY  = 'tc_auth';
const PASS_KEY     = 'tc_pass';

function getStoredPass() {
  return localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
}

const TABS = [
  { key: 'khach',     label: 'Khách hàng' },
  { key: 'thue',      label: 'Quỹ Căn Thuê' },
  { key: 'ban',       label: 'Quỹ Căn Bán' },
  { key: 'shophouse', label: 'Quỹ Shophouse' },
  { key: 'homestay',  label: 'Quỹ Homestay' },
];

export default function TimesCity() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  if (!authed) return <LoginGate onSuccess={() => setAuthed(true)} />;
  return <TimesCityApp onLogout={() => { localStorage.removeItem(STORAGE_KEY); setAuthed(false); }} />;
}

// ── Login Gate ──
function LoginGate({ onSuccess }) {
  const [pass, setPass]   = useState('');
  const [error, setError] = useState('');
  const [show, setShow]   = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (pass === getStoredPass()) {
      localStorage.setItem(STORAGE_KEY, '1');
      onSuccess();
    } else {
      setError('Mật khẩu không đúng');
      setPass('');
    }
  }

  return (
    <div style={g.root}>
      <div style={g.card}>
        <div style={g.logo}>🏙</div>
        <div style={g.title}>Times City</div>
        <div style={g.sub}>Nhập mật khẩu để truy cập</div>
        <form onSubmit={handleSubmit} style={{ width:'100%' }}>
          <div style={{ position:'relative', marginBottom:12 }}>
            <input
              autoFocus
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={e => { setPass(e.target.value); setError(''); }}
              placeholder="Mật khẩu..."
              style={g.input}
            />
            <button type="button" onClick={() => setShow(s => !s)} style={g.eyeBtn}>
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {error && <div style={g.error}>{error}</div>}
          <button type="submit" style={g.btn}>Đăng nhập</button>
        </form>
      </div>
    </div>
  );
}

// ── Change Password Modal ──
function ChangePassModal({ onClose }) {
  const [oldPass, setOldPass]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setError('');
    if (oldPass !== getStoredPass()) return setError('Mật khẩu cũ không đúng');
    if (newPass.length < 6)          return setError('Mật khẩu mới tối thiểu 6 ký tự');
    if (newPass !== confirm)          return setError('Mật khẩu mới không khớp');
    localStorage.setItem(PASS_KEY, newPass);
    setSuccess(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div style={g.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={g.changeCard}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:16, color:'#e2e8f0' }}>🔑 Đổi mật khẩu</div>
          <button onClick={onClose} style={g.closeBtn}>✕</button>
        </div>
        {success ? (
          <div style={{ textAlign:'center', color:'#38b274', fontWeight:700, fontSize:15, padding:'20px 0' }}>✅ Đổi mật khẩu thành công!</div>
        ) : (
          <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="Mật khẩu cũ" style={g.input} />
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mật khẩu mới" style={g.input} />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" style={g.input} />
            {error && <div style={g.error}>{error}</div>}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
              <button type="button" onClick={onClose} style={g.cancelBtn}>Huỷ</button>
              <button type="submit" style={g.btn}>Lưu</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main App ──
function TimesCityApp({ onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('khach');
  const [showChangePass, setShowChangePass] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .tc-main-tab { cursor: pointer; transition: all 0.2s; border: none; font-family: ${F}; }
      .tc-main-tab:hover { opacity: 0.85; }
      @media (max-width: 640px) {
        .tc-tabs-row { gap: 6px !important; }
        .tc-main-tab { padding: 10px 16px !important; font-size: 13px !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/')} style={s.backBtn} className="tc-main-tab">&larr;</button>
            <div>
              <div style={s.headerTitle}>Times City</div>
              <div style={s.headerSub}>Quản lý bất động sản Times City</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowChangePass(true)} style={s.iconBtn} title="Đổi mật khẩu">🔑</button>
            <button onClick={onLogout} style={s.iconBtn} title="Đăng xuất">🚪</button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={s.tabsContainer}>
        <div className="tc-tabs-row" style={s.tabsRow}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="tc-main-tab"
              style={{ ...s.mainTab, ...(activeTab === tab.key ? s.mainTabActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {activeTab === 'khach'     && <KhachTimesContent />}
        {activeTab === 'thue'      && <QuyCanThueContent />}
        {activeTab === 'ban'       && <QuyCanBanContent />}
        {activeTab === 'shophouse' && <QuyShophouseContent />}
        {activeTab === 'homestay'  && <QuyHomestayContent />}
      </div>

      {showChangePass && <ChangePassModal onClose={() => setShowChangePass(false)} />}
    </div>
  );
}

// ── Login / Change Pass Styles ──
const g = {
  root:       { minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F },
  card:       { background:'#1a1d27', borderRadius:20, padding:'40px 36px', width:340, maxWidth:'90vw', display:'flex', flexDirection:'column', alignItems:'center', gap:12, boxShadow:'0 8px 40px rgba(0,0,0,0.5)' },
  logo:       { fontSize:48, lineHeight:1 },
  title:      { fontSize:22, fontWeight:800, color:C.primary, letterSpacing:-0.5 },
  sub:        { fontSize:13, color:'#8a9bb8', marginBottom:8 },
  input:      { width:'100%', padding:'11px 44px 11px 14px', border:'1.5px solid #3a3f52', borderRadius:10, fontSize:14, fontFamily:F, outline:'none', background:'#22263a', color:'#e2e8f0', boxSizing:'border-box' },
  eyeBtn:     { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16 },
  error:      { color:'#fc8181', fontSize:13, marginBottom:4, textAlign:'center' },
  btn:        { width:'100%', padding:'11px', background:C.gradient, color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:F, boxShadow:'0 2px 12px rgba(56,178,116,0.35)' },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  changeCard: { background:'#1a1d27', borderRadius:16, padding:'24px', width:380, maxWidth:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' },
  closeBtn:   { background:'none', border:'none', color:'#8a9bb8', fontSize:20, cursor:'pointer' },
  cancelBtn:  { background:'none', border:'1.5px solid #3a3f52', borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:F, color:'#8a9bb8' },
};

// ── Main Page Styles ──
const s = {
  root:          { fontFamily:F, background:'#0f1117', minHeight:'100vh', color:'#e2e8f0' },
  header:        { background:'#13151e', borderBottom:'1px solid #2d3240', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.4)' },
  headerInner:   { padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  headerTitle:   { fontSize:18, fontWeight:800, color:C.primary, letterSpacing:-0.3 },
  headerSub:     { fontSize:11, color:'#8a9bb8', marginTop:1 },
  backBtn:       { background:'rgba(56,178,116,0.15)', borderRadius:8, width:36, height:36, fontSize:18, color:C.primary, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 },
  iconBtn:       { background:'rgba(255,255,255,0.07)', border:'1px solid #3a3f52', borderRadius:8, width:36, height:36, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  tabsContainer: { background:'#13151e', borderBottom:'1px solid #2d3240', padding:'0 12px' },
  tabsRow:       { display:'flex', gap:8, paddingTop:8, overflowX:'auto' },
  mainTab:       { padding:'12px 28px', borderRadius:'10px 10px 0 0', fontSize:15, fontWeight:700, background:'#1a1d27', color:'#8a9bb8', border:'1.5px solid #2d3240', borderBottom:'none', position:'relative', top:1 },
  mainTabActive: { background:C.gradient, color:'#fff', border:'1.5px solid transparent', borderBottom:'none', boxShadow:C.shadowGreen },
  content:       { padding:'16px 12px' },
};
