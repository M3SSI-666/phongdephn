import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../utils/theme';
import { KhachTimesContent } from './KhachTimes';
import { QuyCanThueContent } from './QuyCanThue';
import { QuyCanBanContent } from './NguonHangTimes';
import { QuyShophouseContent } from './QuyShophouse';
import { QuyHomestayContent } from './QuyHomestay';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const TABS = [
  { key: 'khach',     label: 'Khách hàng' },
  { key: 'thue',      label: 'Quỹ Căn Thuê' },
  { key: 'ban',       label: 'Quỹ Căn Bán' },
  { key: 'shophouse', label: 'Quỹ Shophouse' },
  { key: 'homestay',  label: 'Quỹ Homestay' },
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
        {activeTab === 'khach'     && <KhachTimesContent />}
        {activeTab === 'thue'      && <QuyCanThueContent />}
        {activeTab === 'ban'       && <QuyCanBanContent />}
        {activeTab === 'shophouse' && <QuyShophouseContent />}
        {activeTab === 'homestay'  && <QuyHomestayContent />}
      </div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: F,
    background: '#0f1117',
    minHeight: '100vh',
    color: '#e2e8f0',
  },
  header: {
    background: '#13151e',
    borderBottom: '1px solid #2d3240',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  headerInner: {
    padding: '12px 16px',
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
    color: '#8a9bb8',
    marginTop: 1,
  },
  backBtn: {
    background: 'rgba(56,178,116,0.15)',
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
    background: '#13151e',
    borderBottom: '1px solid #2d3240',
    padding: '0 12px',
  },
  tabsRow: {
    display: 'flex',
    gap: 8,
    paddingTop: 8,
    overflowX: 'auto',
  },
  mainTab: {
    padding: '12px 28px',
    borderRadius: '10px 10px 0 0',
    fontSize: 15,
    fontWeight: 700,
    background: '#1a1d27',
    color: '#8a9bb8',
    border: '1.5px solid #2d3240',
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
    padding: '16px 12px',
  },
};
