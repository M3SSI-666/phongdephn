import crypto from 'crypto';

// 2 sheet cùng cấu trúc, chọn qua tham số `sheet`:
//   (mặc định) 'Quy_Can_Thue'      — bảng chính, phản chiếu bảng hàng công ty
//   sheet=con  'Quy_Can_Thue_Con'  — bảng con, bản lưu trữ độc lập của user
// Gộp chung 1 serverless function để không vượt giới hạn function của Vercel.
const MAIN_SHEET = 'Quy_Can_Thue';
const CON_SHEET  = 'Quy_Can_Thue_Con';
// 20 columns: STT, Ngay_Update, Ma_Can, Thiet_Ke, Dien_Tich, Slot_Xe, Huong_BC, Gia, Phi_MG, Noi_That, Thoi_Gian_Vao, Lien_He, Hinh_Anh, Nguon, Ghi_Chu, Mau_Ma_Can, Owner_Id, Ten_Chu, Gia_Net, Bang_Con
const COLUMNS = 'A:T';

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
    console.error(`[QuyCanThue] ${err.message}`);
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
    STT:           row[0]  || '',
    Ngay_Update:   row[1]  || '',
    Ma_Can:        row[2]  || '',
    Thiet_Ke:      row[3]  || '',
    Dien_Tich:     row[4]  || '',
    Slot_Xe:       row[5]  || '',
    Huong_BC:      row[6]  || '',
    Gia:           row[7]  || '',
    Phi_MG:        row[8]  || '',
    Noi_That:      row[9]  || '',
    Thoi_Gian_Vao: row[10] || '',
    Lien_He:       row[11] || '',
    Hinh_Anh:      row[12] || '',
    Nguon:         row[13] || '',
    Ghi_Chu:       row[14] || '',
    Mau_Ma_Can:    row[15] || '',
    Owner_Id:      row[16] || '',
    Ten_Chu:       row[17] || '',
    Gia_Net:       row[18] || '',
    Bang_Con:      row[19] || '',
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
      p.STT          || '',
      keepDate ? (p.Ngay_Update || '') : today,
      p.Ma_Can        || '',
      p.Thiet_Ke      || '',
      p.Dien_Tich     || '',
      p.Slot_Xe       || 'Không',
      p.Huong_BC      || '',
      p.Gia           || '',
      p.Phi_MG        || '',
      p.Noi_That      || '',
      p.Thoi_Gian_Vao || '',
      p.Lien_He       || '',
      p.Hinh_Anh      || '',
      p.Nguon         || '',
      p.Ghi_Chu       || '',
      p.Mau_Ma_Can    || '',
      ownerId,
      p.Ten_Chu       || '',
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
    const range = `${SHEET_NAME}!A${payload._rowIndex}:T${payload._rowIndex}`;
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
          range: `${SHEET_NAME}!A${p._rowIndex}:T${p._rowIndex}`,
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
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const metaData = await metaRes.json();
        const targetSheet = metaData.sheets.find(s => s.properties.title === SHEET_NAME);
        if (targetSheet) {
          // Gộp các dòng liền nhau thành 1 khoảng để không bắn hàng trăm request
          // (600 dòng lẻ = 600 request -> vượt 10s của Vercel, xoá dở dang).
          // rowIdx giảm dần: [10,9,8,5,4,1] -> [7,10) [3,5) [0,1)
          const gid = targetSheet.properties.sheetId;
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

  if (payload.action === 'delete') {
    if (!payload._rowIndex) return res.status(400).json({ error: 'Missing _rowIndex' });
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const metaData = await metaRes.json();
    const targetSheet = metaData.sheets.find(s => s.properties.title === SHEET_NAME);
    if (!targetSheet) return res.status(404).json({ error: 'Sheet not found' });

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId: targetSheet.properties.sheetId, dimension: 'ROWS', startIndex: payload._rowIndex - 1, endIndex: payload._rowIndex },
          },
        }],
      }),
    });
    if (!response.ok) return res.status(500).json({ error: 'sheets_delete', detail: await response.text() });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: `Unknown action: ${payload.action}` });
}

async function createSheetWithHeaders(sheetId, token, SHEET_NAME) {
  const HEADERS = [
    'STT', 'Ngay_Update', 'Ma_Can', 'Thiet_Ke', 'Dien_Tich', 'Slot_Xe',
    'Huong_BC', 'Gia', 'Phi_MG', 'Noi_That', 'Thoi_Gian_Vao',
    'Lien_He', 'Hinh_Anh', 'Nguon', 'Ghi_Chu', 'Mau_Ma_Can', 'Owner_Id', 'Ten_Chu', 'Gia_Net', 'Bang_Con',
  ];
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:T1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [HEADERS] }),
  });
}

function getAccessToken(email, privateKey, writable = false) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
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
    return d.access_token;
  });
}
