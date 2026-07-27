// Migration 1 lần: chuyển 3 bảng hàng (Thuê / Bán / Đập Thông) từ mô hình
// "mỗi user import 1 bản, lọc theo Owner_Id" sang "1 bản dùng chung + sheet con riêng".
//
//   node --env-file=.env scripts/migrate-bang-con.mjs copy  [--dry-run]
//   node --env-file=.env scripts/migrate-bang-con.mjs prune [--dry-run]
//
// copy  — an toàn (chỉ đọc + ghi thêm): backup 3 sheet, nới Quy_Dap_Thong đủ 19 cột,
//         tạo 3 sheet con, copy sang sheet con của đúng Owner_Id mọi dòng có dấu vết
//         cá nhân (Bang_Con / Gia_Net / màu user tự tô).
// prune — PHÁ HUỶ, chạy SAU khi deploy code mới: gộp trùng theo Ma_Can, xoá sạch
//         Owner_Id / Gia_Net / Bang_Con và màu user tự tô, đánh lại STT cho Thuê.
//
// Thứ tự bắt buộc: copy -> deploy -> prune.

import crypto from 'node:crypto';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const EMAIL    = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY      = (process.env.GOOGLE_PRIVATE_KEY || '')
  .replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '').trim();

const [phase, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry-run');

if (!SHEET_ID || !EMAIL || !KEY) {
  console.error('Thiếu GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY.');
  process.exit(1);
}
if (phase !== 'copy' && phase !== 'prune') {
  console.error('Dùng: node --env-file=.env scripts/migrate-bang-con.mjs <copy|prune> [--dry-run]');
  process.exit(1);
}

// Tag gán cho dòng cứu được mà chưa có tag nào — dòng con KHÔNG tag sẽ vô hình trên UI.
const FALLBACK_TAG = 'Lưu trữ';

// Màu KHÔNG phải user tự tô (trạng thái công ty + đánh dấu Hàng Đầu Tư + màu đỏ cũ đã bỏ).
const SYSTEM_COLORS = new Set(['#9CA3AF', '#FFF000', '#F9A8D4', '#FF3B30']);
const isUserColor = c => !!c && !SYSTEM_COLORS.has(c);

const HEADERS_THUE = [
  'STT', 'Ngay_Update', 'Ma_Can', 'Thiet_Ke', 'Dien_Tich', 'Slot_Xe',
  'Huong_BC', 'Gia', 'Phi_MG', 'Noi_That', 'Thoi_Gian_Vao',
  'Lien_He', 'Hinh_Anh', 'Nguon', 'Ghi_Chu', 'Mau_Ma_Can', 'Owner_Id', 'Ten_Chu', 'Gia_Net', 'Bang_Con',
];
const HEADERS_BAN = [
  'Ngay_Update', 'Ma_Can', 'Thiet_Ke', 'Dien_Tich', 'Slot_Xe',
  'Huong_BC', 'Huong_Cua', 'Gia', 'Phi', 'Noi_That',
  'SDT', 'Ten_Chu', 'Hinh_Anh', 'Nguon', 'Ghi_Chu', 'Mau_Ma_Can', 'Owner_Id', 'Gia_Net', 'Bang_Con',
];

// Index cột theo từng schema (Thuê có STT nên lệch 1 so với Bán/Đập Thông).
const SHEETS = [
  { main: 'Quy_Can_Thue',  con: 'Quy_Can_Thue_Con',  headers: HEADERS_THUE, lastCol: 'T',
    iMaCan: 2, iMau: 15, iOwner: 16, iGiaNet: 18, iBangCon: 19, iStt: 0 },
  { main: 'Quy_Can_Ban',   con: 'Quy_Can_Ban_Con',   headers: HEADERS_BAN,  lastCol: 'S',
    iMaCan: 1, iMau: 15, iOwner: 16, iGiaNet: 17, iBangCon: 18, iStt: -1 },
  { main: 'Quy_Dap_Thong', con: 'Quy_Dap_Thong_Con', headers: HEADERS_BAN,  lastCol: 'S',
    iMaCan: 1, iMau: 15, iOwner: 16, iGiaNet: 17, iBangCon: 18, iStt: -1 },
];

// ── Google API ──

async function getToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(JSON.stringify({
    iss: EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  })).toString('base64url');
  const signInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const jwt = `${signInput}.${signer.sign(KEY, 'base64url')}`;
  const d = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  }).then(r => r.json());
  if (!d.access_token) throw new Error('token_fail: ' + JSON.stringify(d));
  return d.access_token;
}

let TOKEN;
const auth = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' });
const API  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

async function call(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${url.slice(API.length)} — ${await r.text()}`);
  return r.json();
}

const batchUpdate = requests => call(`${API}:batchUpdate`, { method: 'POST', headers: auth(), body: JSON.stringify({ requests }) });

async function getMeta() {
  const d = await call(`${API}?fields=sheets.properties`, { headers: auth() });
  return new Map(d.sheets.map(s => [s.properties.title, s.properties]));
}

// Sheet chưa tồn tại (hay gặp ở --dry-run vì chưa tạo sheet con) -> coi như rỗng.
async function readRows(title, lastCol) {
  const r = await fetch(`${API}/values/${encodeURIComponent(title)}!A:${lastCol}`, { headers: auth() });
  if (!r.ok) {
    const text = await r.text();
    if (text.includes('Unable to parse range')) return [];
    throw new Error(`${r.status} ${title} — ${text}`);
  }
  return (await r.json()).values || [];
}

async function appendRows(title, lastCol, rows) {
  if (!rows.length) return;
  await call(
    `${API}/values/${encodeURIComponent(title)}!A:${lastCol}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: auth(), body: JSON.stringify({ values: rows }) },
  );
}

// ── Phase: copy ──

async function ensureConSheet(cfg, meta) {
  if (meta.has(cfg.con)) return;
  console.log(`  + tạo sheet ${cfg.con}`);
  if (DRY) return;
  await batchUpdate([{ addSheet: { properties: { title: cfg.con, gridProperties: { columnCount: cfg.headers.length } } } }]);
  await call(`${API}/values/${encodeURIComponent(cfg.con)}!A1:${cfg.lastCol}1?valueInputOption=USER_ENTERED`,
    { method: 'PUT', headers: auth(), body: JSON.stringify({ values: [cfg.headers] }) });
}

async function widenSheet(cfg, meta) {
  const props = meta.get(cfg.main);
  const have = props?.gridProperties?.columnCount ?? 0;
  const need = cfg.headers.length;
  if (have < need) {
    console.log(`  + nới ${cfg.main}: ${have} -> ${need} cột`);
    if (!DRY) await batchUpdate([{ appendDimension: { sheetId: props.sheetId, dimension: 'COLUMNS', length: need - have } }]);
  }
  // Quy_Dap_Thong vốn chỉ có 17 tên cột -> đồng bộ lại hàng header cho khớp contract mới.
  if (DRY) return;
  await call(`${API}/values/${encodeURIComponent(cfg.main)}!A1:${cfg.lastCol}1?valueInputOption=USER_ENTERED`,
    { method: 'PUT', headers: auth(), body: JSON.stringify({ values: [cfg.headers] }) });
}

async function backup(cfg, meta) {
  const props = meta.get(cfg.main);
  if (!props) return;
  const title = `${cfg.main}_bak_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  if (meta.has(title)) { console.log(`  · backup ${title} đã có, bỏ qua`); return; }
  console.log(`  + backup -> ${title}`);
  if (DRY) return;
  await batchUpdate([{ duplicateSheet: { sourceSheetId: props.sheetId, newSheetName: title } }]);
}

async function phaseCopy() {
  for (const cfg of SHEETS) {
    console.log(`\n[${cfg.main}]`);
    const meta = await getMeta();
    if (!meta.has(cfg.main)) { console.log('  ! không tồn tại, bỏ qua'); continue; }

    await backup(cfg, meta);
    await widenSheet(cfg, meta);
    await ensureConSheet(cfg, await getMeta());

    const rows = await readRows(cfg.main, cfg.lastCol);
    const body = rows.slice(1);
    const conRows = await readRows(cfg.con, cfg.lastCol);
    // (Owner_Id, Ma_Can) đã có bên sheet con -> không copy lại (script chạy lại được nhiều lần).
    const already = new Set(conRows.slice(1).map(r =>
      `${(r[cfg.iOwner] || '').trim()}|${(r[cfg.iMaCan] || '').trim().toUpperCase()}`));

    const out = [];
    for (const r of body) {
      const owner   = (r[cfg.iOwner]   || '').trim();
      const maCan   = (r[cfg.iMaCan]   || '').trim();
      const bangCon = (r[cfg.iBangCon] || '').trim();
      const giaNet  = (r[cfg.iGiaNet]  || '').trim();
      const mau     = (r[cfg.iMau]     || '').trim();
      if (!owner || !maCan) continue;                                 // không biết của ai -> bỏ
      if (!bangCon && !giaNet && !isUserColor(mau)) continue;         // không có dấu vết cá nhân
      if (already.has(`${owner}|${maCan.toUpperCase()}`)) continue;

      const row = [...r];
      while (row.length < cfg.headers.length) row.push('');
      row[cfg.iBangCon] = bangCon || FALLBACK_TAG;
      row[cfg.iMau] = isUserColor(mau) ? mau : '';                    // bỏ màu trạng thái công ty
      if (cfg.iStt >= 0) row[cfg.iStt] = String(out.length + conRows.length);
      out.push(row);
      already.add(`${owner}|${maCan.toUpperCase()}`);
    }

    console.log(`  ${body.length} dòng -> cứu ${out.length} dòng sang ${cfg.con}`);
    for (const r of out.slice(0, 10)) console.log(`    · ${r[cfg.iMaCan]}  tag="${r[cfg.iBangCon]}"  giaNet="${r[cfg.iGiaNet] || ''}"  mau="${r[cfg.iMau] || ''}"`);
    if (out.length > 10) console.log(`    · ... và ${out.length - 10} dòng nữa`);
    if (!DRY) await appendRows(cfg.con, cfg.lastCol, out);
  }
}

// ── Phase: prune ──

async function phasePrune() {
  for (const cfg of SHEETS) {
    console.log(`\n[${cfg.main}]`);
    const meta = await getMeta();
    if (!meta.has(cfg.main)) { console.log('  ! không tồn tại, bỏ qua'); continue; }

    const rows = await readRows(cfg.main, cfg.lastCol);
    if (!rows.length) { console.log('  ! rỗng, bỏ qua'); continue; }
    const body = rows.slice(1);

    const seen = new Set();
    const out = [];
    for (const r of body) {
      const maCan = (r[cfg.iMaCan] || '').trim().toUpperCase();
      if (!maCan || seen.has(maCan)) continue;   // gộp trùng: giữ bản đầu tiên
      seen.add(maCan);
      const row = [...r];
      while (row.length < cfg.headers.length) row.push('');
      const mau = (row[cfg.iMau] || '').trim();
      row[cfg.iMau]     = isUserColor(mau) ? '' : mau;  // giữ màu trạng thái + Hàng Đầu Tư
      row[cfg.iOwner]   = '';
      row[cfg.iGiaNet]  = '';
      row[cfg.iBangCon] = '';
      if (cfg.iStt >= 0) row[cfg.iStt] = String(out.length + 1);
      out.push(row);
    }

    console.log(`  ${body.length} dòng -> ${out.length} dòng (bỏ ${body.length - out.length} bản trùng)`);
    if (DRY) continue;

    // Ghi bằng clear + update tại A2 (không deleteDimension để tránh lệch index).
    await call(`${API}/values/${encodeURIComponent(`${cfg.main}!A2:${cfg.lastCol}`)}:clear`,
      { method: 'POST', headers: auth(), body: '{}' });
    await call(`${API}/values/${encodeURIComponent(cfg.main)}!A1:${cfg.lastCol}1?valueInputOption=USER_ENTERED`,
      { method: 'PUT', headers: auth(), body: JSON.stringify({ values: [cfg.headers] }) });
    if (out.length) {
      await call(`${API}/values/${encodeURIComponent(cfg.main)}!A2?valueInputOption=USER_ENTERED`,
        { method: 'PUT', headers: auth(), body: JSON.stringify({ values: out }) });
    }
    console.log('  ✓ đã ghi');
  }
}

TOKEN = await getToken();
console.log(`Phase: ${phase}${DRY ? ' (DRY RUN — không ghi gì)' : ''}`);
if (phase === 'copy') await phaseCopy(); else await phasePrune();
console.log('\nXong.');
