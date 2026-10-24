import { useState, useEffect, useCallback } from 'react';
import { C } from '../utils/theme';
import { maCanTelegram, mediaTelegram } from '../utils/telegramCan';
import { fetchTelegramNhom, postTelegramNhom, guiTelegram } from '../utils/api';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Telegram chỉ nhận 10 món mỗi album; quá thì api/telegram.js tự chia thành nhiều album.
const MEDIA_MOI_ALBUM = 10;

/**
 * item    — căn đang gửi
 * bang    — 'ban' | 'thue', để mỗi bảng có danh sách nhóm riêng
 * message — tin gửi khách, dựng sẵn ở trang gọi (mỗi bảng một cách dựng khác nhau)
 * role    — chỉ admin được thêm/xoá nhóm; ai cũng gửi được
 */
export default function TelegramModal({ item, bang, message, role, onClose, showToast }) {
  const [nhom, setNhom] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState('');
  const [moThem, setMoThem] = useState(false);
  const [tenMoi, setTenMoi] = useState('');
  const [idMoi, setIdMoi] = useState('');

  const laAdmin = role === 'admin';
  const media = mediaTelegram(item?.Hinh_Anh);
  const maCan = maCanTelegram(item?.Ma_Can);

  const taiNhom = useCallback(async () => {
    setDangTai(true);
    try {
      const data = await fetchTelegramNhom();
      setNhom((Array.isArray(data) ? data : []).filter(n => n.Bang === bang));
      setLoi('');
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangTai(false);
    }
  }, [bang]);

  useEffect(() => { taiNhom(); }, [taiNhom]);

  async function gui(n) {
    if (dangGui) return;
    setDangGui(true);
    try {
      const kq = await guiTelegram({ chatId: n.Chat_Id, maCan, message, images: media });
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

  async function themNhom() {
    const ten = tenMoi.trim(), id = idMoi.trim();
    if (!ten || !id) return showToast('Điền cả tên nhóm và Chat ID', 'error');
    try {
      await postTelegramNhom({ action: 'add', Ten_Nhom: ten, Chat_Id: id, Bang: bang });
      setTenMoi(''); setIdMoi(''); setMoThem(false);
      await taiNhom();
      showToast(`Đã thêm nhóm ${ten}`);
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function xoaNhom(n) {
    if (!window.confirm(`Xoá nhóm "${n.Ten_Nhom}" khỏi danh sách?\n\nChỉ xoá ở đây, nhóm trên Telegram không bị gì.`)) return;
    try {
      await postTelegramNhom({ action: 'delete', Ten_Nhom: n.Ten_Nhom, Bang: bang });
      await taiNhom();
      showToast(`Đã xoá nhóm ${n.Ten_Nhom}`);
    } catch (e) { showToast(e.message, 'error'); }
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
          <div style={s.previewLabel}>2. {maCan}</div>
          <div style={s.previewLabel}>3. Thông tin gửi khách:</div>
          <pre style={s.msg}>{message}</pre>
        </div>

        <div style={s.nhomLabel}>Chọn nhóm để gửi vào:</div>

        {dangTai && <div style={s.info}>Đang tải danh sách nhóm...</div>}
        {loi && <div style={{ ...s.info, color: C.error }}>{loi}</div>}

        {!dangTai && !loi && nhom.length === 0 && (
          <div style={s.info}>
            Chưa có nhóm nào cho bảng này.{laAdmin ? ' Bấm "+ Thêm nhóm" bên dưới.' : ' Nhờ admin thêm giúp.'}
          </div>
        )}

        <div style={s.nhomList}>
          {nhom.map(n => (
            <div key={n.Ten_Nhom} style={s.nhomRow}>
              <button onClick={() => gui(n)} disabled={dangGui} style={s.nhomBtn}>
                {dangGui ? 'Đang gửi...' : n.Ten_Nhom}
              </button>
              {laAdmin && (
                <button onClick={() => xoaNhom(n)} disabled={dangGui} style={s.xoaBtn} title="Xoá nhóm khỏi danh sách">🗑</button>
              )}
            </div>
          ))}
        </div>

        {laAdmin && (moThem ? (
          <div style={s.themBox}>
            <input value={tenMoi} onChange={e => setTenMoi(e.target.value)}
              placeholder="Tên nhóm (VD: B - 1PN)" style={s.input} />
            <input value={idMoi} onChange={e => setIdMoi(e.target.value)}
              placeholder="Chat ID (VD: -1001234567890)" style={s.input} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={themNhom} style={s.luuBtn}>Lưu</button>
              <button onClick={() => setMoThem(false)} style={s.huyBtn}>Huỷ</button>
            </div>
            <div style={s.hint}>
              Chat ID lấy bằng cách thêm bot vào nhóm rồi mở
              <code style={s.code}>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>
              — nhóm có id âm, dạng -100...
            </div>
          </div>
        ) : (
          <button onClick={() => setMoThem(true)} style={s.themBtn}>+ Thêm nhóm</button>
        ))}
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
  info:         { fontSize:12.5, color:'#8a9bb8', padding:'8px 0' },
  nhomList:     { display:'flex', flexDirection:'column', gap:6, marginBottom:10 },
  nhomRow:      { display:'flex', gap:6, alignItems:'center' },
  nhomBtn:      { flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid #3a3f52', background:'#22263a', color:'#e2e8f0', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:F, textAlign:'left' },
  xoaBtn:       { padding:'8px 10px', borderRadius:8, border:'1.5px solid #3a3f52', background:'none', color:C.error, fontSize:13, cursor:'pointer', fontFamily:F },
  themBtn:      { padding:'8px 14px', borderRadius:10, border:'1.5px dashed #3a3f52', background:'none', color:'#38b274', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:F },
  themBox:      { display:'flex', flexDirection:'column', gap:8, padding:12, background:'#141726', border:'1px solid #2a2f45', borderRadius:10 },
  input:        { padding:'9px 12px', border:'1.5px solid #3a3f52', borderRadius:8, background:'#1e2130', color:'#e2e8f0', fontSize:13, fontFamily:F, outline:'none' },
  luuBtn:       { padding:'8px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#38b274,#2a8a5a)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:F },
  huyBtn:       { padding:'8px 18px', borderRadius:8, border:'1.5px solid #3a3f52', background:'none', color:'#8a9bb8', fontSize:13, cursor:'pointer', fontFamily:F },
  hint:         { fontSize:11, color:'#6b7a94', lineHeight:1.6 },
  code:         { background:'#1e2130', padding:'1px 5px', borderRadius:4, margin:'0 3px', fontSize:10.5, wordBreak:'break-all' },
};
