import { SignIn, SignUp, useUser, useClerk } from '@clerk/clerk-react';
import { useState } from 'react';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

export function AuthGate({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <LoginPage />;

  // Kiểm tra waitlist / chờ duyệt
  const status = user.publicMetadata?.status;
  if (status === 'pending' || (!status && !user.publicMetadata?.approved)) {
    return <PendingScreen user={user} />;
  }

  return children;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117', fontFamily:F }}>
      <div style={{ color:'#8a9bb8', fontSize:16 }}>Đang tải...</div>
    </div>
  );
}

function LoginPage() {
  const [mode, setMode] = useState('sign-in'); // 'sign-in' | 'sign-up'

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg, #0f1117 0%, #1a1d27 100%)',
      fontFamily:F, padding:20,
    }}>
      {/* Logo */}
      <div style={{ marginBottom:32, textAlign:'center' }}>
        <div style={{ fontSize:28, fontWeight:800, color:'#38b274', letterSpacing:1 }}>
          Times City
        </div>
        <div style={{ fontSize:13, color:'#8a9bb8', marginTop:4 }}>
          Quản lý bất động sản
        </div>
      </div>

      {/* Tab switch */}
      <div style={{ display:'flex', gap:0, marginBottom:24, background:'#1e2130', borderRadius:10, padding:4, border:'1px solid #2d3240' }}>
        {[['sign-in','Đăng nhập'],['sign-up','Đăng ký']].map(([v, label]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            padding:'8px 28px', borderRadius:8, border:'none', cursor:'pointer',
            fontFamily:F, fontWeight:700, fontSize:14, transition:'all 0.15s',
            background: mode===v ? '#38b274' : 'transparent',
            color: mode===v ? '#fff' : '#8a9bb8',
          }}>{label}</button>
        ))}
      </div>

      {/* Clerk form */}
      <div style={{ width:'100%', maxWidth:440 }}>
        {mode === 'sign-in' ? (
          <SignIn
            appearance={{ variables: { colorPrimary:'#38b274', fontFamily:F } }}
            routing="hash"
            signUpUrl="#"
            afterSignInUrl="/timescity"
          />
        ) : (
          <SignUp
            appearance={{ variables: { colorPrimary:'#38b274', fontFamily:F } }}
            routing="hash"
            signInUrl="#"
            afterSignUpUrl="/pending"
          />
        )}
      </div>

      {mode === 'sign-up' && (
        <div style={{ marginTop:16, fontSize:12, color:'#8a9bb8', textAlign:'center', maxWidth:360 }}>
          Sau khi đăng ký, tài khoản của bạn sẽ chờ admin phê duyệt trước khi sử dụng được.
        </div>
      )}
    </div>
  );
}

function PendingScreen({ user }) {
  const { signOut } = useClerk();

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg, #0f1117 0%, #1a1d27 100%)',
      fontFamily:F, padding:20,
    }}>
      <div style={{
        background:'#1a1d27', border:'1px solid #2d3240', borderRadius:20,
        padding:'40px 48px', maxWidth:440, width:'100%', textAlign:'center',
        boxShadow:'0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
        <div style={{ fontSize:20, fontWeight:800, color:'#e2e8f0', marginBottom:8 }}>
          Đang chờ phê duyệt
        </div>
        <div style={{ fontSize:14, color:'#8a9bb8', lineHeight:1.7, marginBottom:24 }}>
          Tài khoản <strong style={{ color:'#e2e8f0' }}>{user.primaryEmailAddress?.emailAddress}</strong> đã đăng ký thành công.<br/>
          Admin sẽ phê duyệt trong thời gian sớm nhất.<br/>
          Bạn sẽ nhận được email khi được duyệt.
        </div>
        <button
          onClick={() => signOut()}
          style={{
            background:'none', border:'1px solid #3a3f52', borderRadius:10,
            padding:'10px 24px', color:'#8a9bb8', cursor:'pointer',
            fontFamily:F, fontSize:14, fontWeight:600,
          }}
        >Đăng xuất</button>
      </div>
    </div>
  );
}
