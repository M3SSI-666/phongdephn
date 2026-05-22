import { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

const ROLE_CONFIG = {
  admin:   { label: 'Admin',   bg: 'rgba(159,122,234,0.2)', color: '#9F7AEA', border: '#9F7AEA' },
  staff:   { label: 'Nhân viên', bg: 'rgba(56,178,116,0.15)', color: '#38b274', border: '#38b274' },
  viewer:  { label: 'Xem',    bg: 'rgba(99,179,237,0.15)', color: '#63b3ed', border: '#63b3ed' },
  pending: { label: 'Chờ duyệt', bg: 'rgba(246,173,85,0.15)', color: '#F6AD55', border: '#F6AD55' },
};

export default function AdminDashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(null);
  const [toast, setToast]     = useState(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  function adminFetch(body) {
    return fetch('/api/parse-tc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'admin', callerId: user.id, ...body }),
    });
  }

  const loadUsers = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await fetch('/api/parse-tc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'admin', action: 'list', callerId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không tải được danh sách');
      setUsers(data);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin, loadUsers]);

  async function approveWaitlist(entryId, email) {
    setSaving(entryId);
    try {
      const res = await adminFetch({ action: 'approve_waitlist', email });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi duyệt');
      showToast(`Đã gửi lời mời tới ${email}!`);
      await loadUsers();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(null); }
  }

  async function updateUser(userId, role, approved) {
    setSaving(userId);
    try {
      const res = await adminFetch({ action: 'update', userId, role, approved });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại');
      showToast('Đã cập nhật!');
      await loadUsers();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(null); }
  }

  async function banUser(userId, name) {
    if (!confirm(`Khoá tài khoản của ${name}?`)) return;
    setSaving(userId);
    try {
      await adminFetch({ action: 'ban', userId });
      showToast('Đã khoá tài khoản!');
      await loadUsers();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(null); }
  }

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) return showToast('Email không hợp lệ', 'error');
    setInviting(true);
    try {
      const res = await adminFetch({ action: 'approve_waitlist', email });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gửi lời mời thất bại');
      showToast(`✉️ Đã gửi lời mời tới ${email}!`);
      setInviteEmail('');
      await loadUsers();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setInviting(false); }
  }

  const pending = users.filter(u => !u.approved || u.role === 'pending');
  const active  = users.filter(u => u.approved && u.role !== 'pending');

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', fontFamily:F, color:'#e2e8f0' }}>
      {/* Header */}
      <div style={{ background:'#1a1d27', borderBottom:'1px solid #2d3240', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20, fontWeight:800, color:'#38b274' }}>Times City</span>
          <span style={{ fontSize:13, color:'#8a9bb8' }}>/ Admin Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <RoleBadge role={user?.publicMetadata?.role || 'pending'} />
          <span style={{ fontSize:13, color:'#8a9bb8' }}>{user?.primaryEmailAddress?.emailAddress}</span>
          <button onClick={() => signOut()} style={{ background:'none', border:'1px solid #3a3f52', borderRadius:8, padding:'6px 14px', color:'#8a9bb8', cursor:'pointer', fontFamily:F, fontSize:13 }}>Đăng xuất</button>
        </div>
      </div>

      <div style={{ padding:'28px', maxWidth:900, margin:'0 auto' }}>
        {!isAdmin ? (
          <div style={{ textAlign:'center', padding:60, color:'#8a9bb8' }}>
            Bạn không có quyền truy cập trang này.
          </div>
        ) : (
          <>
            {/* Invite box */}
            <div style={{ background:'#1a1d27', border:'1px solid #2d3240', borderRadius:14, padding:'20px 24px', marginBottom:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#e2e8f0', marginBottom:12 }}>➕ Mời nhân viên mới</div>
              <div style={{ display:'flex', gap:10 }}>
                <input
                  type="email"
                  placeholder="Nhập email Gmail của nhân viên..."
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendInvite()}
                  style={{ flex:1, background:'#13151e', border:'1px solid #3a3f52', borderRadius:8, padding:'10px 14px', color:'#e2e8f0', fontSize:13, fontFamily:F, outline:'none' }}
                />
                <button
                  onClick={sendInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  style={{ background: inviting ? '#2d3240' : 'linear-gradient(135deg,#38b274,#2a8a5a)', border:'none', borderRadius:8, padding:'10px 24px', color:'#fff', fontFamily:F, fontSize:13, fontWeight:700, cursor: inviting ? 'default':'pointer', whiteSpace:'nowrap' }}
                >{inviting ? '⏳ Đang gửi...' : '✉️ Gửi lời mời'}</button>
              </div>
              <div style={{ fontSize:11, color:'#8a9bb8', marginTop:8 }}>Clerk sẽ gửi email mời → nhân viên click link → vào app ngay với quyền Nhân viên</div>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
              {[
                { label:'Tổng user', value: users.length, color:'#63b3ed' },
                { label:'Chờ duyệt', value: pending.length, color:'#F6AD55' },
                { label:'Đang hoạt động', value: active.length, color:'#38b274' },
              ].map(s => (
                <div key={s.label} style={{ background:'#1a1d27', border:'1px solid #2d3240', borderRadius:14, padding:'20px 24px' }}>
                  <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:13, color:'#8a9bb8', marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pending users */}
            {pending.length > 0 && (
              <Section title={`⏳ Chờ duyệt (${pending.length})`} accent="#F6AD55">
                {pending.map(u => (
                  <UserRow key={u.id} u={u} saving={saving}
                    onApprove={u.source === 'waitlist'
                      ? () => approveWaitlist(u.id, u.email)
                      : () => updateUser(u.id, 'staff', true)
                    }
                    onBan={u.source === 'waitlist' ? null : () => banUser(u.id, u.name)}
                    onRoleChange={u.source === 'waitlist' ? null : role => updateUser(u.id, role, true)}
                  />
                ))}
              </Section>
            )}

            {/* Active users */}
            <Section title={`✅ Đang hoạt động (${active.length})`} accent="#38b274">
              {loading ? (
                <div style={{ padding:20, color:'#8a9bb8', textAlign:'center' }}>Đang tải...</div>
              ) : active.length === 0 ? (
                <div style={{ padding:20, color:'#8a9bb8', textAlign:'center' }}>Chưa có user nào</div>
              ) : active.map(u => (
                <UserRow key={u.id} u={u} saving={saving}
                  onApprove={null}
                  onBan={() => banUser(u.id, u.name)}
                  onRoleChange={role => updateUser(u.id, role, true)}
                />
              ))}
            </Section>
          </>
        )}
      </div>

      {toast && (
        <div style={{
          position:'fixed', bottom:24, right:24, padding:'12px 20px',
          borderRadius:10, color:'#fff', fontSize:14, fontWeight:600,
          fontFamily:F, zIndex:2000,
          background: toast.type === 'error' ? '#E53E3E' : '#38b274',
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function Section({ title, accent, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:14, fontWeight:700, color:accent, marginBottom:12, letterSpacing:'0.3px' }}>{title}</div>
      <div style={{ background:'#1a1d27', border:'1px solid #2d3240', borderRadius:14, overflow:'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function UserRow({ u, saving, onApprove, onBan, onRoleChange }) {
  const isSaving = saving === u.id;
  const fmt = ts => ts ? new Date(ts).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const isWaitlist = u.source === 'waitlist';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:'1px solid #2d3240' }}>
      {/* Avatar */}
      {u.avatar
        ? <img src={u.avatar} alt="" style={{ width:38, height:38, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} onError={e => { e.target.style.display='none'; }} />
        : <div style={{ width:38, height:38, borderRadius:'50%', background:'#2d3240', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>👤</div>
      }

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontWeight:700, fontSize:14, color:'#e2e8f0' }}>{u.name}</span>
          {isWaitlist && <span style={{ fontSize:10, background:'rgba(246,173,85,0.2)', border:'1px solid #F6AD55', color:'#F6AD55', borderRadius:6, padding:'2px 7px', fontWeight:700 }}>WAITLIST</span>}
        </div>
        <div style={{ fontSize:12, color:'#8a9bb8' }}>{u.email}</div>
      </div>

      {/* Time */}
      <div style={{ fontSize:11, color:'#8a9bb8', whiteSpace:'nowrap', textAlign:'right', minWidth:120 }}>
        <div>Đăng ký: {fmt(u.created_at)}</div>
        {!isWaitlist && <div>Login: {fmt(u.last_sign_in_at)}</div>}
      </div>

      {/* Role selector — chỉ cho user thường */}
      {!isWaitlist && onRoleChange && (
        <select value={u.role} disabled={isSaving} onChange={e => onRoleChange(e.target.value)}
          style={{ background:'#13151e', border:'1px solid #3a3f52', borderRadius:8, color:'#e2e8f0', padding:'6px 10px', fontSize:12, fontFamily:F, cursor:'pointer' }}
        >
          <option value="admin">Admin</option>
          <option value="staff">Nhân viên</option>
          <option value="viewer">Chỉ xem</option>
          <option value="pending">Chờ duyệt</option>
        </select>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        {onApprove && (
          <button onClick={onApprove} disabled={isSaving}
            style={{ background:'rgba(56,178,116,0.15)', border:'1px solid #38b274', borderRadius:8, padding:'6px 14px', color:'#38b274', cursor:'pointer', fontFamily:F, fontSize:12, fontWeight:700 }}>
            {isSaving ? '...' : isWaitlist ? '✉️ Mời vào' : '✅ Duyệt'}
          </button>
        )}
        {onBan && (
          <button onClick={onBan} disabled={isSaving}
            style={{ background:'rgba(229,62,62,0.1)', border:'1px solid #E53E3E', borderRadius:8, padding:'6px 12px', color:'#E53E3E', cursor:'pointer', fontFamily:F, fontSize:12, fontWeight:700 }}>
            🔒 Khoá
          </button>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.pending;
  return (
    <span style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:8, padding:'4px 12px', fontSize:12, fontWeight:700, color:cfg.color }}>
      {cfg.label}
    </span>
  );
}
