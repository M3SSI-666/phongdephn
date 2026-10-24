import { useRef, useEffect } from 'react';
import { C } from '../utils/theme';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

/**
 * Hiện danh sách căn đã chọn dưới dạng chữ, để copy đi dán chỗ khác.
 *
 * Hiện ra trong ô sửa được chứ không copy thẳng vào clipboard rồi đóng: người dùng cần
 * nhìn thấy mình sắp dán cái gì, và hay phải sửa vài chữ trước khi gửi đi.
 *
 * text  — chuỗi đã dựng sẵn ở trang gọi
 * soCan — số căn, để tiêu đề nói rõ đang xuất bao nhiêu
 */
export default function XuatCanModal({ text, soCan, onClose, showToast }) {
  const ref = useRef(null);

  // Bôi đen sẵn: mở ra là Ctrl+C được luôn, không phải kéo chuột chọn.
  useEffect(() => {
    const el = ref.current;
    if (el) { el.focus(); el.select(); }
  }, []);

  async function copy() {
    const noiDung = ref.current?.value ?? text;
    try {
      await navigator.clipboard.writeText(noiDung);
      showToast(`Đã copy ${soCan} căn`);
      onClose();
    } catch {
      // Clipboard API bị chặn (http, hoặc trình duyệt không cho). Bôi đen lại để
      // người dùng tự Ctrl+C, thay vì báo lỗi rồi bỏ mặc.
      ref.current?.select();
      showToast('Trình duyệt chặn copy tự động — nhấn Ctrl+C để copy', 'error');
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>📄 Xuất {soCan} căn</span>
          <button onClick={onClose} style={s.x}>✕</button>
        </div>

        <textarea ref={ref} defaultValue={text} spellCheck={false} style={s.ta} />

        <div style={s.hint}>Sửa được trước khi copy. Sửa ở đây không đụng gì tới bảng hàng.</div>

        <div style={s.row}>
          <button onClick={copy} style={s.copyBtn}>📋 Copy</button>
          <button onClick={onClose} style={s.dongBtn}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16, fontFamily:F },
  box:     { background:'#1a1d2e', border:'1px solid #3a3f52', borderRadius:14, padding:18, width:680, maxWidth:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column', color:'#e2e8f0' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  x:       { background:'none', border:'none', color:'#8a9bb8', fontSize:18, cursor:'pointer', fontFamily:F },
  ta:      { width:'100%', minHeight:300, maxHeight:'55vh', padding:12, boxSizing:'border-box', resize:'vertical', background:'#141726', border:'1px solid #2a2f45', borderRadius:10, color:'#cbd5e1', fontSize:12.5, lineHeight:1.7, fontFamily:F, outline:'none', whiteSpace:'pre' },
  hint:    { fontSize:11, color:'#6b7a94', margin:'8px 0 12px' },
  row:     { display:'flex', gap:8 },
  copyBtn: { flex:1, padding:'10px 18px', borderRadius:9, border:'none', background:C.gradient, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:F },
  dongBtn: { padding:'10px 18px', borderRadius:9, border:'1.5px solid #3a3f52', background:'none', color:'#8a9bb8', fontSize:13.5, cursor:'pointer', fontFamily:F },
};
