import { useState, useEffect, useCallback } from 'react';
import { C } from '../utils/theme';
import { maCanTelegram, tinMaCan, mediaTelegram } from '../utils/telegramCan';
import { fetchTelegramNhom, guiTelegram } from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Telegram chỉ nhận 10 món mỗi album; quá thì api/telegram.js tự chia thành nhiều album.
const MEDIA_MOI_ALBUM = 10;

/**
 * Hộp gửi một căn sang nhóm Telegram. CHỈ chọn nhóm, không sửa gì — thêm/xoá nhóm và
 * token bot nằm ở nút "Telegram" trên thanh công cụ. Tách vậy để lúc đang gửi hàng
 * không ai lỡ tay đụng vào cấu hình dùng chung của cả công ty.
 *
 * item    — căn đang gửi
 * message — tin gửi khách, dựng sẵn ở trang gọi (mỗi bảng một cách dựng khác nhau)
 */
export default function TelegramModal({ item, message, onClose, showToast }) {
  const [nhom, setNhom] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState('');

  const media = mediaTelegram(item?.Hinh_Anh);
  const maCan = maCanTelegram(item?.Ma_Can);   // mã trần, dùng cho chữ trong app
  const maCanGui = tinMaCan(item?.Ma_Can);     // có trái tim, đúng chuỗi gửi sang Telegram

  const taiNhom = useCallback(async () => {
    setDangTai(true);
    try {
      const data = await fetchTelegramNhom();
      setNhom(Array.isArray(data) ? data : []);
      setLoi('');
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangTai(false);
    }
  }, []);

  useEffect(() => { taiNhom(); }, [taiNhom]);

  async function gui(n) {
    if (dangGui) return;
    setDangGui(true);
    try {
      const kq = await guiTelegram({ chatId: n.Chat_Id, maCan: maCanGui, message, images: media });
      // Ảnh hỏng mà chữ đã gửi được thì KHÔNG báo "thành công" trơn: người gửi phải
      // biết để còn đăng bù ảnh, không thì nhóm nhận được tin cụt mà không ai hay.
      if (kq.anhLoi?.length) {
        showToast(`Đã gửi chữ vào ${n.Ten_Nhom}, nhưng ảnh lỗi: ${kq.anhLoi.join('; ')}`, 'error');
      } else {
        showToast(`Đã gửi ${maCan} vào nhóm ${n.Ten_Nhom}`);
        onClose();
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDangGui(false);
    }
  }

  return (
    <div style={s.overlay} onClick={dangGui ? undefined : onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>✈ Gửi {maCan} sang Telegram</span>
          <button onClick={onClose} style={s.x} disabled={dangGui}>✕</button>
        </div>

        {/* Xem trước đúng thứ tự sẽ gửi, để không phải sang Telegram mới biết sai. */}
        <div style={s.preview}>
          <div style={s.previewLabel}>
            {media.length
              ? `1. ${media.length} ảnh/video${media.length > MEDIA_MOI_ALBUM ? ` (chia ${Math.ceil(media.length / MEDIA_MOI_ALBUM)} album)` : ''}`
              : '1. Không có ảnh — chỉ gửi phần chữ'}
          </div>
          <div style={s.previewLabel}>2. {maCanGui}</div>
          <div style={s.previewLabel}>3. Thông tin gửi khách:</div>
          <pre style={s.msg}>{message}</pre>
        </div>

        <div style={s.nhomLabel}>Chọn nhóm để gửi vào:</div>

        {dangTai && <div style={s.info}>Đang tải danh sách nhóm...</div>}
        {loi && <div style={{ ...s.info, color: C.error }}>{loi}</div>}

        {!dangTai && !loi && nhom.length === 0 && (
          <div style={s.info}>
            Chưa khai báo nhóm nào. Thêm ở nút <b>✈ Telegram</b> trên thanh công cụ.
          </div>
        )}

        <div style={s.nhomList}>
          {nhom.map(n => (
            <button key={n.Ten_Nhom} onClick={() => gui(n)} disabled={dangGui} style={s.nhomBtn}>
              {dangGui ? 'Đang gửi...' : n.Ten_Nhom}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16, fontFamily:F },
  box:          { background:'#1a1d2e', border:'1px solid #3a3f52', borderRadius:14, padding:18, width:480, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', color:'#e2e8f0' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  x:            { background:'none', border:'none', color:'#8a9bb8', fontSize:18, cursor:'pointer', fontFamily:F },
  preview:      { background:'#141726', border:'1px solid #2a2f45', borderRadius:10, padding:12, marginBottom:14 },
  previewLabel: { fontSize:12, color:'#8a9bb8', fontWeight:700, marginBottom:4 },
  msg:          { margin:'6px 0 0', padding:10, background:'#1e2130', borderRadius:8, fontSize:12.5, lineHeight:1.6, color:'#cbd5e1', whiteSpace:'pre-wrap', fontFamily:F },
  nhomLabel:    { fontSize:12, color:'#8a9bb8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:8 },
  info:         { fontSize:12.5, color:'#8a9bb8', padding:'8px 0', lineHeight:1.6 },
  nhomList:     { display:'flex', flexDirection:'column', gap:6 },
  nhomBtn:      { padding:'10px 14px', borderRadius:10, border:'1.5px solid #3a3f52', background:'#22263a', color:'#e2e8f0', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:F, textAlign:'left' },
};
