import { useState, useEffect, useRef } from 'react';
import { C } from '../utils/theme';

const F = "'Quicksand', 'Nunito', 'Segoe UI', sans-serif";

// Thông tin sales lặp lại ở mọi lần xuất, nhưng không thuộc về căn nào nên không có chỗ
// trong sheet. Để localStorage: gõ một lần, lần sau tự điền.
const KHOA_SALES = 'phongdephn.loTrinh.sales';

const docSales = () => {
  try { return JSON.parse(localStorage.getItem(KHOA_SALES)) || {}; } catch { return {}; }
};
const ghiSales = v => {
  try { localStorage.setItem(KHOA_SALES, JSON.stringify(v)); } catch { /* chế độ ẩn danh */ }
};

/**
 * Hộp tạo PDF "Lộ trình xem nhà".
 *
 * cans     — các căn ĐÃ CHỌN, theo đúng thứ tự tick (chính là lộ trình dẫn khách)
 * toUnit   — hàm của từng trang, đổi 1 căn PhongdepHN sang cấu trúc unit của module PDF
 * tenSales — tên lấy từ tài khoản đăng nhập, dùng làm giá trị gợi ý
 */
export default function LoTrinhModal({ cans, toUnit, giaCuaCan, donViGia, tenSales = '', onClose, showToast }) {
  const luu = docSales();
  const [name, setName]   = useState(luu.name || tenSales);
  const [phone, setPhone] = useState(luu.phone || '');
  const [title, setTitle] = useState(luu.title || 'Chuyên tư vấn mua bán & cho thuê căn hộ chung cư Times City');
  const [client, setClient] = useState('');
  const [xungHo, setXungHo] = useState(luu.xungHo || 'anh/chị');
  const [date, setDate]   = useState('');
  const [ghiChu, setGhiChu] = useState(() => Object.fromEntries(cans.map(c => [c.Ma_Can, ''])));
  // Để TRỐNG = dùng giá của bảng hàng (ưu tiên Giá Nét). Gõ vào mới đè lên.
  const [gia, setGia] = useState(() => Object.fromEntries(cans.map(c => [c.Ma_Can, ''])));
  // Để TRỐNG = dùng cột View của bảng hàng. Gõ vào mới đè lên, chỉ cho lần xuất này.
  // Để TRỐNG = lấy hướng ban công của bảng hàng. Gõ vào mới đè, chỉ cho lần xuất này.
  const [huong, setHuong] = useState(() => Object.fromEntries(cans.map(c => [c.Ma_Can, ''])));
  const [view, setView] = useState(() => Object.fromEntries(cans.map(c => [c.Ma_Can, ''])));
  // Căn đáng chú ý của buổi xem — tô nổi trong bảng lộ trình ở trang đầu file.
  const [noiBat, setNoiBat] = useState(() => new Set());

  const [dangChay, setDangChay] = useState(false);
  const [bước, setBuoc] = useState('');
  const huy = useRef(false);

  useEffect(() => () => { huy.current = true; }, []);

  async function xuat() {
    if (!name.trim())  return showToast('Điền tên của bạn đã', 'error');
    if (!phone.trim()) return showToast('Điền số điện thoại đã', 'error');
    setDangChay(true);
    try {
      ghiSales({ name: name.trim(), phone: phone.trim(), title: title.trim(), xungHo: xungHo.trim() });

      setBuoc('Đang tải thư viện tạo PDF…');
      const mod = await import('../utils/lichXemNhaPdf');

      // Nạp ảnh TRƯỚC khi dựng trang: bộ ngắt trang cần kích thước thật của từng ảnh,
      // nó không chờ ảnh tải xong. Đây cũng là bước lâu nhất nên phải báo tiến độ.
      const units = [];
      for (let i = 0; i < cans.length; i++) {
        if (huy.current) return;
        setBuoc(`Đang tải ảnh căn ${i + 1}/${cans.length} — ${cans[i].Ma_Can}`);
        units.push(await toUnit(cans[i], {
          ghiChu: ghiChu[cans[i].Ma_Can] || '',
          gia: gia[cans[i].Ma_Can] || '',
          noiBat: noiBat.has(cans[i].Ma_Can),
          view: view[cans[i].Ma_Can] || '',
          huong: huong[cans[i].Ma_Can] || '',
        }, mod.napAnh));
      }

      const state = {
        name: name.trim(), phone: phone.trim(), title: title.trim(),
        client: client.trim(), xungHo: xungHo.trim(), date: date || mod.todayISO(),
        thanks: mod.thanksMacDinh(xungHo), units,
      };

      const ten = await mod.xuatPdf(state, (i, n) => setBuoc(`Đang vẽ trang ${i}/${n}…`));
      if (huy.current) return;
      showToast(`Đã tạo ${ten}`);
      onClose();
    } catch (e) {
      console.error(e);
      showToast('Tạo PDF thất bại: ' + (e?.message || 'lỗi không rõ'), 'error');
    } finally {
      setDangChay(false);
      setBuoc('');
    }
  }

  const soAnh = cans.reduce((t, c) => t + (c.Hinh_Anh ? c.Hinh_Anh.split(',').filter(Boolean).length : 0), 0);
  const thieuLayout = cans.filter(c => !(c.Layout || '').trim()).length;

  return (
    <div style={s.overlay} onClick={dangChay ? undefined : onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>🗺 Lộ trình xem nhà — {cans.length} căn</span>
          <button onClick={onClose} style={s.x} disabled={dangChay}>✕</button>
        </div>

        <div style={s.grid2}>
          <div><label style={s.lb}>Tên bạn</label>
            <input value={name} onChange={e => setName(e.target.value)} style={s.inp} placeholder="VD: Tùng Mai" /></div>
          <div><label style={s.lb}>Số điện thoại</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} style={s.inp} placeholder="VD: 0988 888 888" /></div>
        </div>
        <label style={s.lb}>Chức danh</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={s.inp} />
        <div style={s.grid3}>
          <div><label style={s.lb}>Gửi cho khách</label>
            <input value={client} onChange={e => setClient(e.target.value)} style={s.inp} placeholder="VD: anh Minh (để trống được)" /></div>
          <div><label style={s.lb}>Xưng hô</label>
            <input value={xungHo} onChange={e => setXungHo(e.target.value)} style={s.inp} placeholder="anh/chị" title="Dùng trong lời cảm ơn cuối file" /></div>
          <div><label style={s.lb}>Ngày xem</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={s.inp} /></div>
        </div>

        <div style={s.lbSec}>Lộ trình ({cans.length} căn, theo thứ tự bạn đã tick)</div>
        {thieuLayout > 0 && (
          <div style={s.canh}>
            ⓘ {thieuLayout} căn chưa có Layout riêng — file sẽ dùng mặt bằng chung của tòa cho những căn đó.
          </div>
        )}
        <div style={s.ds}>
          {cans.map((c, i) => (
            <div key={c.Ma_Can} style={s.row}>
              <span style={s.stt}>{i + 1}</span>
              <button
                onClick={() => setNoiBat(p => {
                  const t = new Set(p);
                  if (t.has(c.Ma_Can)) t.delete(c.Ma_Can); else t.add(c.Ma_Can);
                  return t;
                })}
                style={noiBat.has(c.Ma_Can) ? s.saoOn : s.sao}
                title={noiBat.has(c.Ma_Can) ? 'Bỏ đánh dấu nổi bật' : 'Đánh dấu căn đáng chú ý'}>★</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.Ma_Can}</div>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <input
                    value={gia[c.Ma_Can] || ''}
                    onChange={e => setGia(p => ({ ...p, [c.Ma_Can]: e.target.value }))}
                    placeholder={giaCuaCan ? giaCuaCan(c) : ''}
                    title={`Giá báo khách. Gõ số không là thêm "${donViGia}". Để trống thì dùng giá của bảng hàng.`}
                    style={{ ...s.inpNho, marginTop:0, width:170, flexShrink:0 }} />
                  <input
                    value={huong[c.Ma_Can] || ''}
                    onChange={e => setHuong(p => ({ ...p, [c.Ma_Can]: e.target.value }))}
                    placeholder={(c.Huong_BC || '').trim() || 'Hướng BC'}
                    title="Hướng ban công. Để trống thì lấy theo bảng hàng."
                    style={{ ...s.inpNho, marginTop:0, width:110, flexShrink:0 }} />
                  <input
                    value={view[c.Ma_Can] || ''}
                    onChange={e => setView(p => ({ ...p, [c.Ma_Can]: e.target.value }))}
                    placeholder={(c.View || '').trim() || 'View'}
                    title="View hiện trong bảng lộ trình. Để trống thì lấy cột View của bảng hàng."
                    style={{ ...s.inpNho, marginTop:0, width:200, flexShrink:0 }} />
                  <input
                    value={ghiChu[c.Ma_Can] || ''}
                    onChange={e => setGhiChu(p => ({ ...p, [c.Ma_Can]: e.target.value }))}
                    placeholder="Ghi chú riêng cho căn này (hiện trong file)"
                    style={{ ...s.inpNho, marginTop:0 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.hint}>
          Bấm ★ để đánh dấu căn đáng chú ý — căn đó sẽ được tô nổi trong bảng lộ trình.
          Ô giá, hướng và View để trống thì lấy theo bảng hàng (mờ sẵn trong ô); gõ “6.5” là thành “6.5 {donViGia}”.
          Tổng {soAnh} ảnh. Ảnh phải tải về trước khi dựng trang nên bước này có thể mất
          một lúc — đừng đóng cửa sổ giữa chừng.
        </div>

        {dangChay && <div style={s.tienDo}>{bước}</div>}

        <div style={s.hang}>
          <button onClick={xuat} disabled={dangChay} style={{ ...s.btnChinh, ...(dangChay ? { opacity: .6, cursor: 'default' } : {}) }}>
            {dangChay ? 'Đang tạo…' : '📄 Tạo file PDF'}
          </button>
          <button onClick={onClose} disabled={dangChay} style={s.btnPhu}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16, fontFamily:F },
  box:       { background:'#1a1d2e', border:'1px solid #3a3f52', borderRadius:14, padding:18, width:960, maxWidth:'100%', maxHeight:'92vh', overflowY:'auto', color:'#e2e8f0' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  x:         { background:'none', border:'none', color:'#8a9bb8', fontSize:18, cursor:'pointer', fontFamily:F },
  grid3:     { display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:10 },
    grid2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  lb:        { display:'block', fontSize:11.5, color:'#8a9bb8', fontWeight:700, margin:'8px 0 4px' },
  lbSec:     { fontSize:12, color:'#8a9bb8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', margin:'16px 0 8px' },
  inp:       { width:'100%', boxSizing:'border-box', padding:'9px 12px', border:'1.5px solid #3a3f52', borderRadius:8, background:'#1e2130', color:'#e2e8f0', fontSize:13, fontFamily:F, outline:'none' },
  inpNho:    { width:'100%', boxSizing:'border-box', marginTop:4, padding:'6px 9px', border:'1px solid #2a2f45', borderRadius:6, background:'#1e2130', color:'#cbd5e1', fontSize:12, fontFamily:F, outline:'none' },
  canh:      { fontSize:12, color:'#8a9bb8', lineHeight:1.6, marginBottom:8 },
  ds:        { display:'flex', flexDirection:'column', gap:8, maxHeight:260, overflowY:'auto' },
  row:       { display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#141726', border:'1px solid #2a2f45', borderRadius:9 },
  stt:       { width:22, height:22, flexShrink:0, borderRadius:6, background:'#38b274', color:'#fff', fontSize:11.5, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' },
  sao:       { width:26, height:26, flexShrink:0, padding:0, borderRadius:6, border:'1.5px solid #3a3f52', background:'transparent', color:'#3a3f52', fontSize:14, cursor:'pointer', fontFamily:F },
  saoOn:     { width:26, height:26, flexShrink:0, padding:0, borderRadius:6, border:'1.5px solid #a3e635', background:'rgba(163,230,53,0.18)', color:'#a3e635', fontSize:14, cursor:'pointer', fontFamily:F },
    hint:      { fontSize:11, color:'#6b7a94', lineHeight:1.7, margin:'12px 0' },
  tienDo:    { fontSize:12.5, color:'#38bdf8', fontWeight:700, padding:'8px 10px', background:'rgba(56,189,248,0.1)', borderRadius:8, marginBottom:10 },
  hang:      { display:'flex', gap:8 },
  btnChinh:  { flex:1, padding:'10px 18px', borderRadius:9, border:'none', background:C.gradient, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:F },
  btnPhu:    { padding:'10px 18px', borderRadius:9, border:'1.5px solid #3a3f52', background:'none', color:'#8a9bb8', fontSize:13.5, cursor:'pointer', fontFamily:F },
};
