// Dựng và xuất PDF "Lộ trình xem nhà".
//
// Phần lõi bê từ module lich-xem-nha (buildPages + các khối nội dung + exportPDF), bỏ
// form nhập tay / lưu nháp / xem trước — dữ liệu căn giờ lấy thẳng từ bảng hàng.
//
// File này nặng (kéo theo html2canvas + jspdf ~700KB) nên CHỈ được import động, lúc
// người dùng thật sự bấm nút. Bundle chính đã 2.9MB, không gánh thêm cho mọi người vào
// xem bảng hàng.

import './../styles/lichXemNha.css';

const PW = 794, PH = 1123, CW = PW - 104, HERO_H = 300, GAP = 18;

// Mặt bằng tổng khu, file tĩnh trong public/ nên cùng domain — không vướng CORS.
const SITE_PLAN = '/mat-bang/times-city.jpg';

const pad2 = n => String(n).padStart(2, '0');
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Lời cảm ơn dựng theo xưng hô người dùng chọn ("anh", "chị", "cô chú"...). Trước đây
// cứng "anh/chị" — đúng về nghĩa nhưng đọc như thư mẫu, mà đây là tin gửi riêng một khách.
export const XUNG_HO_MAC_DINH = 'anh/chị';

export function thanksMacDinh(xungHo) {
  const x = (xungHo || '').trim() || XUNG_HO_MAC_DINH;
  return `Cảm ơn ${x} đã dành thời gian đi xem nhà cùng em hôm nay. Em gửi lại lịch trình và ` +
    `thông tin các căn để ${x} tiện xem lại và bàn thêm cùng gia đình.\n\n` +
    `Còn vấn đề gì cần giải đáp, ${x} cứ nhắn Zalo hoặc gọi trực tiếp cho em nhé.`;
}

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  // flat(Infinity), KHÔNG phải flat(): danh sách mã căn ở introBlock lồng hai tầng
  // (mảng các cặp [dấu phẩy, <span>]). Duỗi một tầng thì mảng con lọt xuống nhánh
  // String(k) và in ra "[object HTMLSpanElement]" ngay giữa câu mở đầu.
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${WEEKDAYS[d.getDay()]}, ${m[3]}/${m[2]}/${m[1]}`;
}

export function slug(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Đo chiều cao khối ──
// Khối phải được gắn vào DOM thật mới đo được chiều cao. Dùng một trang ẩn đặt ngoài
// màn hình, tự tạo khi cần và tự dọn sau khi xuất xong — không bắt React render sẵn
// mấy cái div rỗng chỉ để module này mượn.
let hostDo = null, noiDungDo = null;
function moHost() {
  if (hostDo) return;
  hostDo = el('div', { class: 'lxn-host', style: 'position:fixed;left:-10000px;top:0;width:794px;' });
  const p = el('div', { class: 'page' });
  noiDungDo = el('div', { class: 'page-content', style: 'top:48px' });
  p.append(noiDungDo);
  hostDo.append(p);
  document.body.append(hostDo);
}
function dongHost() {
  hostDo?.remove();
  hostDo = null; noiDungDo = null;
}
function doCao(block) {
  noiDungDo.append(block);
  const h = block.getBoundingClientRect().height;
  block.remove();
  return h;
}

// ── Các khối nội dung ──

const heroBlock = s => el('div', { class: 'hero' },
  el('div', { class: 'hero-l' },
    el('div', { class: 'hero-eyebrow', text: 'Times City · 458 Minh Khai · Hà Nội' }),
    el('div', { class: 'hero-name', text: s.name || 'Tên của bạn' }),
    s.title ? el('div', { class: 'hero-title', text: s.title }) : null,
    el('div', { class: 'hero-phone' },
      el('small', { text: 'Hotline · Zalo' }),
      el('strong', { text: s.phone || '—' }))));

function makePage(s, cover) {
  const page = el('div', { class: 'page' });
  const top = cover ? HERO_H + 38 : 48;
  if (cover) page.append(heroBlock(s));
  const content = el('div', { class: 'page-content', style: `top:${top}px` });
  const foot = el('div', { class: 'page-foot' });
  page.append(content, foot);
  return { page, content, foot, contentH: PH - 86 - top };
}

function introBlock(s) {
  const n = s.units.length;
  const codes = s.units.map((u, i) => u.ma || `Căn ${i + 1}`);
  const lead = n
    ? [`${s.client ? `Kính gửi ${s.client}, hôm` : 'Hôm'} nay mình đã cùng xem ${n} căn hộ tại Times City, lần lượt là `,
       codes.map((c, i) => [i ? ', ' : '', el('span', { class: 'nw', text: c })]), '.']
    : [`${s.client ? `Kính gửi ${s.client}. ` : ''}Chưa có căn nào trong lịch trình.`];
  const route = n ? el('div', { class: 'route' }, s.units.map((u, i) =>
    el('div', { class: 'route-row' },
      el('span', { class: 'n', text: pad2(i + 1) }),
      el('span', { class: 'm', text: codes[i] }),
      el('span', { class: 'p', 'data-ref': String(i) })))) : null;
  return el('div', { class: 'intro' },
    el('div', { class: 'eyebrow', text: 'Lịch trình xem nhà' }),
    el('h3', { text: fmtDate(s.date) || 'Chưa chọn ngày' }),
    el('p', {}, lead),
    route);
}

const unitHead = (u, i, n) => el('div', { class: 'u-head' },
  el('div', { style: 'min-width:0' },
    el('div', { class: 'eyebrow', text: `Căn số ${pad2(i + 1)} / ${pad2(n)}` }),
    el('h3', { text: u.ma || `Căn ${i + 1}` })),
  u.gia ? el('div', { class: 'u-price' }, el('small', { text: 'Giá' }), el('strong', { text: u.gia })) : null);

// Chỉ còn hai trường bảng hàng thực sự có. Bỏ "DT thông thủy" và "Hướng cửa": dữ liệu
// không có nên chúng luôn in ra "—", chiếm nửa hàng để nói rằng mình không biết gì.
function specsBlock(u) {
  const v = (x, unit) => x
    ? el('strong', { text: unit ? `${x} ${unit}` : x })
    : el('strong', { class: 'na', text: '—' });
  return el('div', { class: 'specs' },
    el('div', { class: 'spec' }, el('small', { text: 'Diện tích' }), v(u.dtTim, 'm²')),
    el('div', { class: 'spec' }, el('small', { text: 'Hướng ban công' }), v(u.huongBC)));
}

const noteBlock = (label, text, plain) =>
  el('div', { class: 'note' + (plain ? ' plain' : '') }, el('small', { text: label }), el('p', { text }));

// Mặt bằng tổng khu. Co theo chiều NGANG trước rồi mới kẹp theo chiều cao còn lại —
// ảnh này rất rộng, ép theo chiều cao sẽ thừa hai bên và nhìn lạc lõng giữa trang.
function sitePlanFig(img, maxH) {
  const inner = CW - 22;
  const sc = Math.min(inner / img.w, maxH / img.h);
  return el('div', {},
    el('span', { class: 'fig-label', text: 'Mặt bằng tổng thể Times City' }),
    el('div', { class: 'fig' },
      el('img', {
        src: img.src, crossorigin: 'anonymous', alt: '',
        style: `width:${Math.round(img.w * sc)}px;height:${Math.round(img.h * sc)}px`,
      })));
}

function layoutFig(img, maxH, nhan) {
  const inner = CW - 22, sc = Math.min(inner / img.w, maxH / img.h, 1.6);
  const w = Math.round(img.w * sc), h = Math.round(img.h * sc);
  return el('div', {},
    el('span', { class: 'fig-label', text: nhan || 'Mặt bằng' }),
    el('div', { class: 'fig' }, el('img', { src: img.src, crossorigin: 'anonymous', alt: '', style: `width:${w}px;height:${h}px` })));
}

function coverImg(p, cw, ch) {
  const sc = Math.max(cw / p.w, ch / p.h), w = p.w * sc, h = p.h * sc;
  return el('div', { class: 'pcell', style: `width:${cw}px;height:${ch}px` },
    el('img', { src: p.src, crossorigin: 'anonymous', alt: '', style: `width:${w}px;height:${h}px;left:${(cw - w) / 2}px;top:${(ch - h) / 2}px` }));
}

function photoRows(u) {
  const rows = [], cw = (CW - 12) / 2, ch = Math.round(cw * 0.72);
  for (let j = 0; j < u.photos.length; j += 2) {
    const pair = u.photos.slice(j, j + 2);
    const row = el('div', { class: 'prow' }, pair.length === 2
      ? pair.map(p => coverImg(p, cw, ch))
      : [coverImg(pair[0], CW, Math.round(CW * 0.56))]);
    rows.push(j === 0
      ? el('div', {}, el('span', { class: 'fig-label', text: `Ảnh căn hộ · ${u.photos.length} ảnh` }), row)
      : row);
  }
  return rows;
}

// Không còn dòng tiêu đề "Cảm ơn ... đã dành thời gian xem nhà": nó lặp đúng ý của câu
// ngay bên dưới, mà lại in cỡ 28px nên đọc như hai lần cảm ơn liền nhau.
const closingBlock = s => el('div', { class: 'closing' },
  el('div', { class: 'rule' }),
  s.thanks ? el('p', { text: s.thanks }) : null,
  el('div', { class: 'contact' },
    el('div', { class: 'who' }, el('small', { text: 'Times City' }), el('strong', { text: s.name || '' })),
    el('div', { class: 'ph-big', text: s.phone || '' })));

// ── Dựng trang, tự ngắt trang ──
function buildPages(s) {
  moHost();
  const pages = [];
  let cur = null, used = 0;
  const refs = {};
  const newPage = cover => { cur = makePage(s, cover); pages.push(cur); used = 0; };
  const place = (block, breakBefore) => {
    if (!cur || (breakBefore && used > 0)) newPage(false);
    const h = doCao(block);
    if (used > 0 && used + GAP + h > cur.contentH) newPage(false);
    cur.content.append(block);
    used += (used > 0 ? GAP : 0) + h;
  };

  newPage(true);
  place(introBlock(s));

  // Mặt bằng tổng Times City lấp chỗ trống còn lại của trang bìa. Đặt sau phần danh
  // sách căn chứ không nhét vào trong introBlock: nó là ảnh trang trí, không được phép
  // đẩy nội dung sang trang mới. Thiếu chỗ thì BỎ HẲN, thà trang bìa trống một khoảng
  // còn hơn đẻ thêm một trang chỉ để chứa cái bản đồ.
  if (s.sitePlan) {
    const con = cur.contentH - used - GAP - 30;
    if (con >= 200) place(sitePlanFig(s.sitePlan, con));
  }

  const n = s.units.length;
  s.units.forEach((u, i) => {
    place(unitHead(u, i, n), true);
    refs[i] = pages.length;
    place(specsBlock(u));
    if (u.hienTrang?.trim()) place(noteBlock('Hiện trạng', u.hienTrang.trim()));
    if (u.ghiChu?.trim()) place(noteBlock('Ghi chú', u.ghiChu.trim(), true));
    if (u.layout) {
      const left = cur.contentH - used - GAP - 34;
      place(layoutFig(u.layout, left >= 360 ? Math.min(left, 640) : 640, u.layoutNhan));
    }
    photoRows(u).forEach(r => place(r));
  });
  place(closingBlock(s));

  const total = pages.length;
  pages.forEach((p, i) => {
    p.foot.replaceChildren(
      el('span', {}, el('b', { text: s.name || '' }), s.phone ? ` · ${s.phone}` : ''),
      el('span', {}, el('span', { class: 'tc', text: 'Times City' }), `  ·  Trang ${i + 1}/${total}`));
  });
  pages[0].page.querySelectorAll('[data-ref]').forEach(sp => {
    sp.textContent = `Trang ${refs[sp.dataset.ref]}`;
  });
  return pages.map(p => p.page);
}

// ── Nạp ảnh ──
// buildPages tính chiều cao để ngắt trang mà KHÔNG chờ ảnh tải, nên phải biết kích thước
// thật trước. URL Cloudinary không mang kích thước -> nạp từng ảnh đọc naturalWidth/Height.
// crossOrigin='anonymous' là bắt buộc: thiếu nó thì canvas bị "nhiễm" và html2canvas ném
// lỗi bảo mật. Cloudinary có trả Access-Control-Allow-Origin: * nên xin được.
// Ảnh hỏng trả null và bị loại — thiếu một ảnh còn hơn hỏng cả file PDF.
export function napAnh(url) {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res({ src: url, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => res(null);
    img.src = url;
  });
}

// ── Xuất PDF ──
export async function xuatPdf(state, onTienDo) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // Chụp trước khi font tải xong thì chữ ra font dự phòng, lệch hẳn bố cục đã đo.
  if (document.fonts?.ready) await document.fonts.ready;

  // Mặt bằng tổng là file tĩnh cùng domain nên nạp ở đây, không bắt chỗ gọi lo.
  // Nạp hỏng (ai đó xoá file) thì trang bìa chỉ thiếu ảnh, không làm hỏng cả PDF.
  if (state.sitePlan === undefined) {
    state = { ...state, sitePlan: await napAnh(SITE_PLAN) };
  }

  const host = el('div', { style: 'position:fixed;left:-10000px;top:0;' });
  document.body.append(host);
  try {
    const pages = buildPages(state);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    for (let i = 0; i < pages.length; i++) {
      onTienDo?.(i + 1, pages.length);
      host.replaceChildren(pages[i]);
      const canvas = await html2canvas(pages[i], {
        scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true,
        width: PW, height: PH, windowWidth: Math.max(PW, window.innerWidth),
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    const ten = `Lo-trinh-xem-nha${state.client ? '-' + slug(state.client) : ''}-${state.date || todayISO()}.pdf`;
    pdf.save(ten);
    return ten;
  } finally {
    host.remove();
    dongHost();
  }
}
