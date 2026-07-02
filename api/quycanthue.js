import crypto from 'crypto';

const SHEET_NAME = 'Quy_Can_Thue';
// 17 columns: STT, Ngay_Update, Ma_Can, Thiet_Ke, Dien_Tich, Slot_Xe, Huong_BC, Gia, Phi_MG, Noi_That, Thoi_Gian_Vao, Lien_He, Hinh_Anh, Nguon, Ghi_Chu, Mau_Ma_Can, Owner_Id
const COLUMNS = 'A:Q';

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

    if (req.method === 'GET') return handleGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    if (req.method === 'POST') return handlePost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[QuyCanThue] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(req, res, sheetId, email, key) {
  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    const errText = await response.text();
    if (errText.includes('Unable to parse range')) {
      await createSheetWithHeaders(sheetId, token);
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];
  const { userId, role, viewAs } = req.query;

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
    _rowIndex: i + 2,
  }));

  if (userId) {
    items = items.filter(it => it.Owner_Id === userId || (!viewAs && role === 'admin' && !it.Owner_Id));
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json(items);
}

async function handlePost(req, res, sheetId, email, key) {
  const payload = req.body;
  if (!payload?.action) return res.status(400).json({ error: 'Missing action' });

  const token = await getAccessToken(email, key, true);

  function buildRow(p, { keepDate = false } = {}) {
    const today = new Date().toLocaleDateString('vi-VN');
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
      p.Owner_Id      || '',
    ];
  }

  if (payload.action === 'add') {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [buildRow(payload)] }),
    });
    if (!response.ok) return res.status(500).json({ error: 'sheets_append', detail: await response.text() });
    return res.status(200).json({ success: true });
  }

  if (payload.action === 'update') {
    if (!payload._rowIndex) return res.status(400).json({ error: 'Missing _rowIndex' });
    const range = `${SHEET_NAME}!A${payload._rowIndex}:Q${payload._rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [buildRow(payload)] }),
    });
    if (!response.ok) return res.status(500).json({ error: 'sheets_update', detail: await response.text() });
    return res.status(200).json({ success: true });
  }

  if (payload.action === 'bulk') {
    const adds = Array.isArray(payload.adds) ? payload.adds : [];
    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    let added = 0, updated = 0;

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
          range: `${SHEET_NAME}!A${p._rowIndex}:Q${p._rowIndex}`,
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

    return res.status(200).json({ success: true, added, updated });
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

async function createSheetWithHeaders(sheetId, token) {
  const HEADERS = [
    'STT', 'Ngay_Update', 'Ma_Can', 'Thiet_Ke', 'Dien_Tich', 'Slot_Xe',
    'Huong_BC', 'Gia', 'Phi_MG', 'Noi_That', 'Thoi_Gian_Vao',
    'Lien_He', 'Hinh_Anh', 'Nguon', 'Ghi_Chu', 'Mau_Ma_Can', 'Owner_Id',
  ];
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:Q1?valueInputOption=USER_ENTERED`, {
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
