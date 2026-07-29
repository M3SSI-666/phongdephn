import crypto from 'crypto';

// 2 sheet cùng cấu trúc, chọn qua tham số `sheet`:
//   (mặc định) 'Quy_Can_Ban'      — bảng chính, bảng hàng công ty DÙNG CHUNG
//   sheet=con  'Quy_Can_Ban_Con'  — bảng con, kho lưu trữ riêng của từng user
// Gộp chung 1 serverless function để không vượt giới hạn function của Vercel.
const MAIN_SHEET = 'Quy_Can_Ban';
const CON_SHEET  = 'Quy_Can_Ban_Con';
// 19 columns: Ngay_Update, Ma_Can, Thiet_Ke, Dien_Tich, Slot_Xe, Huong_BC, Huong_Cua, Gia, Phi, Noi_That, SDT, Ten_Chu, Hinh_Anh, Nguon, Ghi_Chu, Mau_Ma_Can, Owner_Id, Gia_Net, Bang_Con
const COLUMNS = 'A:S';
// Cột dùng để tìm dòng bảng con mà không cần _rowIndex của client.
const COL_MA_CAN = 'B', COL_OWNER = 'Q', COL_TAG = 'S';

// PHẢI khớp conKey() trong src/utils/quyCanShared.js. Lệch 1 khoảng trắng là client
// tưởng "đã có dòng" còn server tưởng "chưa có" -> lại đẻ ra dòng trùng.
const conKey = s => (s || '').trim().toUpperCase().replace(/\s+/g, '');

export default async function handler(req, res) {
  try {
    const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .trim();

    if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ error: 'Google Sheets not configured' });
    }

    const isCon = req.query?.sheet === 'con' || req.body?.sheet === 'con';
    const SHEET_NAME = isCon ? CON_SHEET : MAIN_SHEET;

    if (req.method === 'GET') return handleGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY, SHEET_NAME, isCon);
    if (req.method === 'POST') {
      // Bảng chính = bảng hàng công ty dùng chung, chỉ admin được ghi.
      // TODO: nên verify Clerk session token thay vì tin role client gửi lên.
      const role = req.body?.role || req.query?.role || '';
      if (!isCon && role !== 'admin') {
        return res.status(403).json({ error: 'Chỉ admin được sửa bảng hàng công ty' });
      }
      return handlePost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY, SHEET_NAME, isCon);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[QuyCanBan] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(req, res, sheetId, email, key, SHEET_NAME, isCon) {
  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    const errText = await response.text();
    if (errText.includes('Unable to parse range')) {
      await createSheetWithHeaders(sheetId, token, SHEET_NAME);
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];
  const { userId } = req.query;

  let items = rows.slice(1).map((row, i) => ({
    Ngay_Update: row[0]  || '',
    Ma_Can:      row[1]  || '',
    Thiet_Ke:    row[2]  || '',
    Dien_Tich:   row[3]  || '',
    Slot_Xe:     row[4]  || '',
    Huong_BC:    row[5]  || '',
    Huong_Cua:   row[6]  || '',
    Gia:         row[7]  || '',
    Phi:         row[8]  || '',
    Noi_That:    row[9]  || '',
    SDT:         row[10] || '',
    Ten_Chu:     row[11] || '',
    Hinh_Anh:    row[12] || '',
    Nguon:       row[13] || '',
    Ghi_Chu:     row[14] || '',
    Mau_Ma_Can:  row[15] || '',
    Owner_Id:    row[16] || '',
    Gia_Net:     row[17] || '',
    Bang_Con:    row[18] || '',
    _rowIndex: i + 2,
  }));

  // Bảng chính = bảng hàng công ty DÙNG CHUNG cho mọi user -> không lọc.
  // Bảng con = kho riêng của từng user -> chỉ trả dòng của chính user đó.
  if (isCon) {
    items = userId ? items.filter(it => it.Owner_Id === userId) : [];
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json(items);
}

async function handlePost(req, res, sheetId, email, key, SHEET_NAME, isCon) {
  const payload = req.body;
  if (!payload?.action) return res.status(400).json({ error: 'Missing action' });

  const token = await getAccessToken(email, key, true);

  function buildRow(p, { keepDate = false } = {}) {
    const today = new Date().toLocaleDateString('vi-VN');
    // Bảng chính là dữ liệu công ty thuần: không mang Owner_Id / Giá Nét / tag bảng con.
    const ownerId = isCon ? (p.Owner_Id || '') : '';
    const giaNet  = isCon ? (p.Gia_Net  || '') : '';
    const bangCon = isCon ? (p.Bang_Con || '') : '';
    return [
      keepDate ? (p.Ngay_Update || '') : today,
      p.Ma_Can     || '',
      p.Thiet_Ke   || '',
      p.Dien_Tich  || '',
      p.Slot_Xe    || 'Không',
      p.Huong_BC   || '',
      p.Huong_Cua  || '',
      p.Gia        || '',
      p.Phi        || 'Thu về',
      p.Noi_That   || '',
      p.SDT        || '',
      p.Ten_Chu    || '',
      p.Hinh_Anh   || '',
      p.Nguon      || '',
      p.Ghi_Chu    || '',
      p.Mau_Ma_Can || '',
      ownerId,
      giaNet,
      bangCon,
    ];
  }

  if (payload.action === 'add') {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // Bảng chính = dữ liệu công ty: Ngày Update do client quyết (giữ nguyên khi sửa).
      // Bảng con = kho riêng: mọi thay đổi đều đóng dấu ngày hôm nay.
      body: JSON.stringify({ values: [buildRow(payload, { keepDate: !isCon })] }),
    });
    if (!response.ok) return res.status(500).json({ error: 'sheets_append', detail: await response.text() });
    return res.status(200).json({ success: true });
  }

  if (payload.action === 'update') {
    if (!payload._rowIndex) return res.status(400).json({ error: 'Missing _rowIndex' });
    const stale = await assertRow(sheetId, token, SHEET_NAME, payload);
    if (stale) return res.status(409).json(stale);
    const range = `${SHEET_NAME}!A${payload._rowIndex}:S${payload._rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [buildRow(payload, { keepDate: !isCon })] }),
    });
    if (!response.ok) return res.status(500).json({ error: 'sheets_update', detail: await response.text() });
    return res.status(200).json({ success: true });
  }

  if (payload.action === 'bulk') {
    const adds = Array.isArray(payload.adds) ? payload.adds : [];
    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    const deletes = Array.isArray(payload.deletes) ? payload.deletes : [];
    let added = 0, updated = 0, deleted = 0;

    if (adds.length) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: adds.map(p => buildRow(p, { keepDate: true })) }),
      });
      if (!response.ok) return res.status(500).json({ error: 'sheets_bulk_append', detail: await response.text() });
      added = adds.length;
    }

    if (updates.length) {
      const data = updates
        .filter(p => p._rowIndex)
        .map(p => ({
          range: `${SHEET_NAME}!A${p._rowIndex}:S${p._rowIndex}`,
          values: [buildRow(p, { keepDate: true })],
        }));
      if (data.length) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
        });
        if (!response.ok) return res.status(500).json({ error: 'sheets_bulk_update', detail: await response.text() });
        updated = data.length;
      }
    }

    // Xoá các dòng theo _rowIndex. Xoá TỪ DƯỚI LÊN (giảm dần) để index không bị dịch giữa chừng.
    if (deletes.length) {
      const rowIdx = [...new Set(deletes.map(d => (typeof d === 'number' ? d : d._rowIndex)))]
        .filter(n => Number.isInteger(n) && n >= 2)
        .sort((a, b) => b - a); // giảm dần
      if (rowIdx.length) {
        const gid = await getSheetGid(sheetId, token, SHEET_NAME);
        if (gid !== null) {
          // Gộp các dòng liền nhau thành 1 khoảng để không bắn hàng trăm request
          // (600 dòng lẻ = 600 request -> vượt 10s của Vercel, xoá dở dang).
          // rowIdx giảm dần: [10,9,8,5,4,1] -> [7,10) [3,5) [0,1)
          const ranges = [];
          for (const i of rowIdx) {
            const last = ranges[ranges.length - 1];
            if (last && i === last.startIndex) last.startIndex = i - 1;
            else ranges.push({ startIndex: i - 1, endIndex: i });
          }
          const requests = ranges.map(r => ({
            deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', ...r } },
          }));
          const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
          });
          if (!response.ok) return res.status(500).json({ error: 'sheets_bulk_delete', detail: await response.text() });
          deleted = rowIdx.length;
        }
      }
    }

    return res.status(200).json({ success: true, added, updated, deleted });
  }

  // Gắn/gỡ tag bảng con. KHÔNG nhận _rowIndex của client: số dòng được dò lại ngay
  // trước khi ghi, trong cùng request này. _rowIndex ở client trượt liên tục vì sheet con
  // dùng chung cho mọi user — ai xoá 1 dòng là mọi dòng dưới tụt 1.
  if (payload.action === 'settag') {
    if (!isCon) return res.status(400).json({ error: 'settag chỉ dùng cho bảng con' });
    const ownerId = payload.Owner_Id || '';
    const maCan   = conKey(payload.Ma_Can);
    if (!ownerId || !maCan) return res.status(400).json({ error: 'Missing Owner_Id/Ma_Can' });
    const tagStr = (Array.isArray(payload.tags) ? payload.tags : []).filter(Boolean).join(', ');

    const hits = await findConRows(sheetId, token, SHEET_NAME, ownerId, maCan);
    if (hits.error) return res.status(500).json(hits.error);
    const dup = Math.max(0, hits.rows.length - 1);

    if (!hits.rows.length) {
      if (!tagStr) return res.status(200).json({ success: true, mode: 'noop', duplicates: 0 });
      const row = { ...(payload.row || {}), Owner_Id: ownerId, Bang_Con: tagStr };
      // todayVN() nằm ở client vì Vercel chạy giờ UTC; đây chỉ là lưới an toàn.
      if (!row.Ngay_Update) row.Ngay_Update = payload.today || '';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [buildRow(row, { keepDate: true })] }),
      });
      if (!r.ok) return res.status(500).json({ error: 'sheets_append', detail: await r.text() });
      // "Quy_Can_Ban_Con!A123:S123" -> 123
      const m = ((await r.json()).updates?.updatedRange || '').match(/![A-Z]+(\d+)/);
      return res.status(200).json({ success: true, mode: 'add', _rowIndex: m ? Number(m[1]) : null, duplicates: 0 });
    }

    const rowNum = hits.rows[0];
    if (!tagStr) {
      const r = await deleteRow(sheetId, token, SHEET_NAME, rowNum);
      if (r !== true) return res.status(500).json(r);
      return res.status(200).json({ success: true, mode: 'delete', _rowIndex: rowNum, duplicates: dup });
    }
    // Ghi ĐÚNG 1 ô: 18 cột kia giữ nguyên, không nuốt mất sửa đổi từ tab/máy khác.
    // RAW vì tên thẻ do user tự gõ — USER_ENTERED sẽ biến "=..." thành công thức.
    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COL_TAG}${rowNum}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[tagStr]] }),
      }
    );
    if (!r.ok) return res.status(500).json({ error: 'sheets_settag', detail: await r.text() });
    return res.status(200).json({ success: true, mode: 'update', _rowIndex: rowNum, duplicates: dup });
  }

  if (payload.action === 'delete') {
    if (!payload._rowIndex) return res.status(400).json({ error: 'Missing _rowIndex' });
    const stale = await assertRow(sheetId, token, SHEET_NAME, payload);
    if (stale) return res.status(409).json(stale);
    const r = await deleteRow(sheetId, token, SHEET_NAME, payload._rowIndex);
    if (r !== true) return res.status(r.error === 'Sheet not found' ? 404 : 500).json(r);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: `Unknown action: ${payload.action}` });
}

// Tìm MỌI dòng bảng con của user có Mã Căn khớp. Trả số dòng thật trong sheet (1-based).
async function findConRows(sheetId, token, SHEET_NAME, ownerId, maCan) {
  const ranges = [COL_MA_CAN, COL_OWNER].map(c => `ranges=${SHEET_NAME}!${c}:${c}`).join('&');
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}&majorDimension=COLUMNS`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return { error: { error: 'sheets_read', detail: await r.text() } };
  const vr = (await r.json()).valueRanges || [];
  // Mỗi cột bị cắt đuôi ĐỘC LẬP (cột rỗng hẳn thì không có key `values`), nên duyệt
  // theo cột Mã Căn và đọc cột kia bằng (arr[i] || '') — không zip, không Math.min.
  const maCol  = vr[0]?.values?.[0] || [];
  const ownCol = vr[1]?.values?.[0] || [];
  const rows = [];
  // i = 0 là dòng tiêu đề -> dòng sheet = i + 1.
  for (let i = 1; i < maCol.length; i++) {
    if ((ownCol[i] || '') === ownerId && conKey(maCol[i]) === maCan) rows.push(i + 1);
  }
  return { rows };
}

// _rowIndex là VỊ TRÍ nên có thể đã trượt. Nếu client gửi kèm `expect` thì soi lại
// 2 ô ở dòng đó trước khi ghi/xoá; lệch -> 409 để client tải lại thay vì phá dòng người khác.
async function assertRow(sheetId, token, SHEET_NAME, payload) {
  const e = payload.expect;
  if (!e) return null;
  const n = payload._rowIndex;
  const ranges = [`${SHEET_NAME}!${COL_MA_CAN}${n}`, `${SHEET_NAME}!${COL_OWNER}${n}`]
    .map(x => `ranges=${x}`).join('&');
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  // Đọc lỗi -> coi như đã trượt. Thà bắt tải lại còn hơn ghi mù lên dòng người khác.
  if (!r.ok) return { error: 'Dòng đã đổi vị trí, vui lòng tải lại', stale: true };
  const vr = (await r.json()).valueRanges || [];
  const ma  = vr[0]?.values?.[0]?.[0] || '';
  const own = vr[1]?.values?.[0]?.[0] || '';
  if (conKey(ma) !== conKey(e.Ma_Can) || own !== (e.Owner_Id || '')) {
    return { error: 'Dòng đã đổi vị trí, vui lòng tải lại', stale: true };
  }
  return null;
}

async function deleteRow(sheetId, token, SHEET_NAME, rowNum) {
  const gid = await getSheetGid(sheetId, token, SHEET_NAME);
  if (gid === null) return { error: 'Sheet not found' };
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
        },
      }],
    }),
  });
  if (!r.ok) return { error: 'sheets_delete', detail: await r.text() };
  return true;
}

async function createSheetWithHeaders(sheetId, token, SHEET_NAME) {
  const HEADERS = [
    'Ngay_Update', 'Ma_Can', 'Thiet_Ke', 'Dien_Tich', 'Slot_Xe',
    'Huong_BC', 'Huong_Cua', 'Gia', 'Phi', 'Noi_That',
    'SDT', 'Ten_Chu', 'Hinh_Anh', 'Nguon', 'Ghi_Chu', 'Mau_Ma_Can', 'Owner_Id', 'Gia_Net', 'Bang_Con',
  ];
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:S1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [HEADERS] }),
  });
}

// gid của sheet không bao giờ đổi -> nhớ lại để đường xoá bớt 1 lượt gọi metadata.
const _gidCache = {};
async function getSheetGid(sheetId, token, SHEET_NAME) {
  const k = `${sheetId}|${SHEET_NAME}`;
  if (_gidCache[k] !== undefined) return _gidCache[k];
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  const t = (d.sheets || []).find(s => s.properties.title === SHEET_NAME);
  if (!t) return null;
  _gidCache[k] = t.properties.sheetId;
  return _gidCache[k];
}

// Instance Vercel còn ấm thì dùng lại access token -> đỡ 1 vòng OAuth (~250ms) mỗi request.
const _tokenCache = { key: '', token: '', exp: 0 };

function getAccessToken(email, privateKey, writable = false) {
  const cacheKey = `${email}|${writable}`;
  const nowSec = Math.floor(Date.now() / 1000);
  if (_tokenCache.key === cacheKey && _tokenCache.exp > nowSec + 60) {
    return Promise.resolve(_tokenCache.token);
  }
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = nowSec;
  const scope = writable
    ? 'https://www.googleapis.com/auth/spreadsheets'
    : 'https://www.googleapis.com/auth/spreadsheets.readonly';
  const claimSet = Buffer.from(JSON.stringify({
    iss: email, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  })).toString('base64url');
  const signInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const jwt = `${signInput}.${signer.sign(privateKey, 'base64url')}`;
  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  }).then(r => r.json()).then(d => {
    if (!d.access_token) throw new Error('token_fail: ' + JSON.stringify(d));
    _tokenCache.key = cacheKey;
    _tokenCache.token = d.access_token;
    _tokenCache.exp = nowSec + (Number(d.expires_in) || 3600);
    return d.access_token;
  });
}
