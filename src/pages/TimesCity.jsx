import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import { C } from '../utils/theme';
import { KhachTimesContent } from './KhachTimes';
import { QuyCanThueContent } from './QuyCanThue';
import { QuyCanBanContent, QuyDapThongContent } from './QuyCanBan';
import { QuyShophouseContent } from './QuyShophouse';
import { QuyHomestayContent } from './QuyHomestay';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const TABS = [
  { key: 'khach',     label: 'Khách hàng' },
  { key: 'thue',      label: 'Quỹ Căn Thuê' },
  { key: 'ban',       label: 'Quỹ Căn Bán' },
  { key: 'dapthong',  label: 'Quỹ Đập Thông' },
  { key: 'shophouse', label: 'Quỹ Shophouse' },
  { key: 'homestay',  label: 'Quỹ Homestay' },
];

const ROLE_LABEL = { admin:'Admin', staff:'User', viewer:'Chỉ xem', pending:'Chờ duyệt' };
const ROLE_COLOR = { admin:'#9F7AEA', staff:'#38b274', viewer:'#63b3ed', pending:'#F6AD55' };

export default function TimesCity() {
  return <TimesCityApp />;
}

// ── Main App ──
function TimesCityApp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState('thue');

  const role = user?.publicMetadata?.role || 'staff';
  const isAdmin = role === 'admin';

  // Admin xem bảng hàng của nhân viên
  const viewAsId   = isAdmin ? searchParams.get('viewAs')   : null;
  const viewAsName = isAdmin ? searchParams.get('viewName') : null;

  // userId thực sự dùng để fetch: nếu admin đang viewAs thì dùng id nhân viên, không thì dùng id của mình
  const effectiveUserId = viewAsId || user?.id;

  const visibleTabs = TABS;

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
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {/* Role badge */}
            {user && (
              <span style={{
                fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:8,
                color: ROLE_COLOR[role], border:`1px solid ${ROLE_COLOR[role]}`,
                background:`${ROLE_COLOR[role]}22`,
              }}>{ROLE_LABEL[role]}</span>
            )}
            {/* Tên user */}
            {user && <span style={{ fontSize:12, color:'#8a9bb8' }}>{user.firstName || user.primaryEmailAddress?.emailAddress}</span>}
            {/* Admin Dashboard */}
            {isAdmin && (
              <button onClick={() => navigate('/admin-dashboard')} style={{ ...s.iconBtn, fontSize:16 }} title="Quản lý users">⚙️</button>
            )}
            <button onClick={() => signOut()} style={s.iconBtn} title="Đăng xuất">🚪</button>
          </div>
        </div>
      </div>

      {/* Banner xem bảng hàng nhân viên */}
      {viewAsId && (
        <div style={{ background:'rgba(99,179,237,0.12)', borderBottom:'1px solid #63b3ed', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, color:'#63b3ed', fontWeight:600 }}>
            👁 Đang xem bảng hàng của <strong>{decodeURIComponent(viewAsName || '')}</strong>
          </span>
          <button onClick={() => navigate('/timescity')} style={{ background:'none', border:'1px solid #63b3ed', borderRadius:8, padding:'4px 14px', color:'#63b3ed', cursor:'pointer', fontSize:12, fontFamily:F, fontWeight:700 }}>
            ← Về bảng của tôi
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div style={s.tabsContainer}>
        <div className="tc-tabs-row" style={s.tabsRow}>
          {visibleTabs.map((tab) => (
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
        {activeTab === 'khach'     && <KhachTimesContent overrideUserId={effectiveUserId} overrideRole={role} isViewAs={!!viewAsId} />}
        {activeTab === 'thue'      && <QuyCanThueContent   overrideUserId={effectiveUserId} overrideRole={role} isViewAs={!!viewAsId} />}
        {activeTab === 'ban'       && <QuyCanBanContent    overrideUserId={effectiveUserId} overrideRole={role} isViewAs={!!viewAsId} />}
        {activeTab === 'dapthong'  && <QuyDapThongContent  overrideUserId={effectiveUserId} overrideRole={role} isViewAs={!!viewAsId} />}
        {activeTab === 'shophouse' && <QuyShophouseContent overrideUserId={effectiveUserId} overrideRole={role} isViewAs={!!viewAsId} />}
        {activeTab === 'homestay'  && <QuyHomestayContent  overrideUserId={effectiveUserId} overrideRole={role} isViewAs={!!viewAsId} />}
      </div>
    </div>
  );
}

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
