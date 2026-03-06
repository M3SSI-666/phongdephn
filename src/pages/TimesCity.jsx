import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { KhachTimesContent } from './KhachTimes';
import { NguonHangContent } from './NguonHangTimes';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const TABS = [
  { key: 'khach', label: 'Khách hàng' },
  { key: 'nguon', label: 'Nguồn hàng' },
];

export default function TimesCity() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('khach');

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
            <button onClick={() => navigate('/')} style={s.backBtn} className="tc-main-tab">
              &larr;
            </button>
            <div>
              <div style={s.headerTitle}>Times City</div>
              <div style={s.headerSub}>Quản lý bất động sản Times City</div>
            </div>
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
              style={{
                ...s.mainTab,
                ...(activeTab === tab.key ? s.mainTabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {activeTab === 'khach' && <KhachTimesContent />}
        {activeTab === 'nguon' && <NguonHangContent />}
      </div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: F,
    background: C.bg,
    minHeight: '100vh',
    color: C.text,
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
  tabsContainer: {
    background: '#fff',
    borderBottom: `1px solid ${C.border}`,
    padding: '0 20px',
  },
  tabsRow: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    gap: 8,
    paddingTop: 8,
  },
  mainTab: {
    padding: '12px 28px',
    borderRadius: '10px 10px 0 0',
    fontSize: 15,
    fontWeight: 700,
    background: C.bg,
    color: C.textMuted,
    border: `1.5px solid ${C.border}`,
    borderBottom: 'none',
    position: 'relative',
    top: 1,
  },
  mainTabActive: {
    background: C.gradient,
    color: '#fff',
    border: '1.5px solid transparent',
    borderBottom: 'none',
    boxShadow: C.shadowGreen,
  },
  content: {
    maxWidth: 1500,
    margin: '0 auto',
    padding: '20px 16px',
  },
};
