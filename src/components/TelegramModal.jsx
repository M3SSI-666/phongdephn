import { useState, useEffect, useCallback } from 'react';
import { C } from '../utils/theme';
import { maCanTelegram, tinMaCan, mediaTelegram, doiViTriNhom } from '../utils/telegramCan';
import { fetchTelegramNhom, guiTelegram, fetchTelegramLog, suaTelegram, sapXepTelegramNhom } from '../utils/api';

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
  const [daDang, setDaDang] = useState([]);   // các nhóm căn này đã được đăng
  const [dangSua, setDangSua] = useState('');  // Chat_Id đang cập nhật
  // Kéo thả đổi thứ tự nhóm — lưu vào sheet, dùng chung cả công ty.
  const [keo, setKeo] = useState(null);        // chỉ số nhóm đang cầm
  const [tha, setTha] = useState(null);        // { i, duoi } — chỗ sẽ thả (trên / dưới nhóm i)
  const [dangXep, setDangXep] = useState(false);

  const media = mediaTelegram(item?.Hinh_Anh);
  const maCan = maCanTelegram(item?.Ma_Can);   // mã trần, dùng cho chữ trong app
  const maCanGui = tinMaCan(item?.Ma_Can);     // có trái tim, đúng chuỗi gửi sang Telegram

  const taiNhom = useCallback(async () => {
    setDangTai(true);
    try {
      const [data, log] = await Promise.all([
        fetchTelegramNhom(),
        // Nhật ký hỏng thì vẫn phải gửi được: mất phần "cập nhật" còn hơn không đẩy được căn nào.
        fetchTelegramLog(maCan).catch(() => []),
      ]);
      setNhom(Array.isArray(data) ? data : []);
      setDaDang(Array.isArray(log) ? log : []);
      setLoi('');
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangTai(false);
    }
  }, [maCan]);

  useEffect(() => { taiNhom(); }, [taiNhom]);

  async function gui(n) {
    if (dangGui) return;
    setDangGui(true);
    try {
      const kq = await guiTelegram({ chatId: n.Chat_Id, maCan: maCanGui, maCanLog: maCan, message, images: media });
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

  // Thả nhóm đang cầm vào trên/dưới nhóm `tha.i`: đổi ngay trên màn hình rồi lưu.
  // Lưu hỏng thì tải lại danh sách từ sheet — không để màn hình nói một đằng, sheet
  // một nẻo.
  async function thaNhom() {
    const tu = keo, d = tha;
    setKeo(null); setTha(null);
    if (tu === null || !d) return;
    const moi = doiViTriNhom(nhom, tu, d.i, d.duoi);
    if (!moi) return;                          // thả về đúng chỗ cũ
    setNhom(moi);
    setDangXep(true);
    try {
      await sapXepTelegramNhom(moi.map(x => x.Ten_Nhom));
    } catch (e) {
      showToast(`Không lưu được thứ tự nhóm: ${e.message}`, 'error');
      taiNhom();
    } finally {
      setDangXep(false);
    }
  }

  async function capNhat(d) {
    if (dangSua) return;
    setDangSua(d.Chat_Id);
    try {
      const kq = await suaTelegram({ chatId: d.Chat_Id, messageId: d.Message_Id, message });
      if (kq.khongDoi) showToast(`Tin ở ${d.Ten_Nhom} vốn đã đúng, không có gì để sửa`);
      else showToast(`Đã cập nhật tin ở ${d.Ten_Nhom}`);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDangSua('');
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

        {/* Đã đăng ở đâu — sửa đè được tin cũ khi giá đổi. Chỉ bot sửa được tin của chính
            nó, nên đây là đường duy nhất để chữa tin đã lên nhóm. */}
        {daDang.length > 0 && (
          <>
            <div style={s.nhomLabel}>Đã đăng ở ({daDang.length}):</div>
            <div style={s.daDangList}>
              {daDang.map(d => (
                <div key={d.Chat_Id} style={s.daDangRow}>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{d.Ten_Nhom}</span>
                  {d.Ngay && <span style={{ fontSize: 11, color: '#6b7a94' }}>{d.Ngay}</span>}
                  <button onClick={() => capNhat(d)} disabled={!!dangSua} style={s.capNhatBtn}
                    title="Sửa đè tin cũ bằng thông tin mới nhất">
                    {dangSua === d.Chat_Id ? 'Đang sửa...' : '↻ Cập nhật'}
                  </button>
                </div>
              ))}
            </div>
            <div style={s.ghiChu}>
              Cập nhật chỉ sửa được PHẦN CHỮ. Ảnh đã gửi theo album thì Telegram không cho đổi —
              muốn thay ảnh thì xoá tay trên nhóm rồi đẩy lại.
            </div>
          </>
        )}

        <div style={s.nhomLabel}>
          Chọn nhóm để gửi vào:
          {nhom.length > 1 && (
            <span style={s.goiYKeo}>
              {dangXep ? 'Đang lưu thứ tự...' : '⠿ rê để đổi thứ tự (dùng chung cả công ty)'}
            </span>
          )}
        </div>

        {dangTai && <div style={s.info}>Đang tải danh sách nhóm...</div>}
        {loi && <div style={{ ...s.info, color: C.error }}>{loi}</div>}

        {!dangTai && !loi && nhom.length === 0 && (
          <div style={s.info}>
            Chưa khai báo nhóm nào. Thêm ở nút <b>✈ Telegram</b> trên thanh công cụ.
          </div>
        )}

        <div style={s.nhomList}>
          {nhom.map((n, i) => {
            const vachTren = tha && keo !== null && tha.i === i && !tha.duoi;
            const vachDuoi = tha && keo !== null && tha.i === i && tha.duoi;
            return (
              <button
                key={n.Ten_Nhom}
                onClick={() => gui(n)}
                disabled={dangGui}
                draggable={!dangGui && !dangXep && nhom.length > 1}
                onDragStart={e => { setKeo(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => {
                  if (keo === null) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const duoi = e.clientY > r.top + r.height / 2;
                  if (!tha || tha.i !== i || tha.duoi !== duoi) setTha({ i, duoi });
                }}
                onDrop={e => { e.preventDefault(); thaNhom(); }}
                onDragEnd={() => { setKeo(null); setTha(null); }}
                style={{
                  ...s.nhomBtn,
                  opacity: keo === i ? 0.4 : 1,
                  boxShadow: vachTren ? 'inset 0 3px 0 #38bdf8' : vachDuoi ? 'inset 0 -3px 0 #38bdf8' : 'none',
                }}
              >
                {nhom.length > 1 && <span style={s.tayNam} aria-hidden="true">⠿</span>}
                {dangGui ? 'Đang gửi...' : n.Ten_Nhom}
              </button>
            );
          })}
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
  daDangList:   { display:'flex', flexDirection:'column', gap:6, marginBottom:8 },
  daDangRow:    { display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#141726', border:'1px solid #2a2f45', borderRadius:9 },
  capNhatBtn:   { padding:'5px 11px', borderRadius:7, border:'1.5px solid #38bdf8', background:'transparent', color:'#38bdf8', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' },
  ghiChu:       { fontSize:11, color:'#6b7a94', lineHeight:1.7, marginBottom:14 },
  nhomList:     { display:'flex', flexDirection:'column', gap:6 },
  nhomBtn:      { padding:'10px 14px', borderRadius:10, border:'1.5px solid #3a3f52', background:'#22263a', color:'#e2e8f0', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:F, textAlign:'left', display:'flex', alignItems:'center', gap:10 },
  tayNam:       { color:'#6b7a94', fontSize:14, cursor:'grab', userSelect:'none', lineHeight:1 },
  goiYKeo:      { marginLeft:8, fontSize:10.5, fontWeight:600, color:'#6b7a94', textTransform:'none', letterSpacing:0 },
};
