import crypto from 'crypto';

const SHEET_NAME = 'Khach_Times';
// 25 columns: STT, Ngay_PS, Ten_Zalo, SDT, Nhu_Cau, Phong_Ngu, Noi_That, Slot_Xe, Thoi_Han_Thue, Ngay_Vao, Dien_Tich, Tai_Chinh, Toa, Can_Tu_Van, Trang_Thai, Thu_Ve, Ghi_Chu, Coc, Chu_Can, Owner_Id, Thu_Tu, Check_Out, Tang, Ban_Cong, Cua
const COLUMNS = 'A:Y';

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

    if (req.method === 'GET') {
      return handleGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    }
    if (req.method === 'POST') {
      return handlePost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[KhachTimes] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ============ GET - Read all rows ============
async function handleGet(req, res, sheetId, email, key) {
  const token = await getAccessToken(email, key);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];

  // Skip header row (row 0), map to objects
  const items = rows.slice(1).map((row, i) => ({
    STT: row[0] || '',
    Ngay_PS: row[1] || '',
    Ten_Zalo: row[2] || '',
    SDT: row[3] || '',
    Nhu_Cau: row[4] || '',
    Phong_Ngu: row[5] || '',
    Noi_That: row[6] || '',
    Slot_Xe: row[7] || '',
    Thoi_Han_Thue: row[8] || '',
    Ngay_Vao: row[9] || '',
    Dien_Tich: row[10] || '',
    Tai_Chinh: row[11] || '',
    Toa: row[12] || '',
    Can_Tu_Van: row[13] || '',
    Trang_Thai: row[14] || '',
    Thu_Ve: row[15] || '',
    Ghi_Chu: row[16] || '',
    Coc: row[17] || '',
    Chu_Can: row[18] || '',
    Owner_Id: row[19] || '',
    Thu_Tu: row[20] || '',
    Check_Out: row[21] || '',
    Tang: row[22] || '',
    Ban_Cong: row[23] || '',
    Cua: row[24] || '',
    _rowIndex: i + 2,
  }));

  const userId  = req.query.userId  || '';
  const role    = req.query.role    || 'staff';
  const viewAs  = req.query.viewAs  === '1';

  const filtered = userId
    ? items.filter(it => it.Owner_Id === userId || (!viewAs && role === 'admin' && !it.Owner_Id))
    : items;

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.status(200).json(filtered);
}

// ============ POST - Add / Update / Delete ============
async function handlePost(req, res, sheetId, email, key) {
  const payload = req.body;
  if (!payload || !payload.action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  const token = await getAccessToken(email, key, true);

  function buildRow(p) {
    return [
      p.STT, p.Ngay_PS, p.Ten_Zalo, p.SDT,
      p.Nhu_Cau, p.Phong_Ngu, p.Noi_That, p.Slot_Xe,
      p.Thoi_Han_Thue, p.Ngay_Vao, p.Dien_Tich, p.Tai_Chinh,
      p.Toa, p.Can_Tu_Van, p.Trang_Thai, p.Thu_Ve || '', p.Ghi_Chu, p.Coc || '', p.Chu_Can || '', p.Owner_Id || '', p.Thu_Tu || '', p.Check_Out || '', p.Tang || '', p.Ban_Cong || '', p.Cua || '',
    ];
  }

  if (payload.action === 'add') {
    const row = buildRow(payload);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_append', detail: errText });
    }

    const appendData = await response.json();
    // Extract the actual row index from the updated range (e.g. "Khach_Times!A11:T11")
    const updatedRange = appendData.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/!A(\d+)/);
    const rowIndex = rowMatch ? parseInt(rowMatch[1]) : null;

    return res.status(200).json({ success: true, rowIndex });
  }

  if (payload.action === 'update') {
    if (!payload._rowIndex) {
      return res.status(400).json({ error: 'Missing _rowIndex' });
    }

    const row = buildRow(payload);
    const range = `${SHEET_NAME}!A${payload._rowIndex}:Y${payload._rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_update', detail: errText });
    }

    return res.status(200).json({ success: true });
  }

  if (payload.action === 'reorder') {
    // payload.orders: [{ _rowIndex: number, Thu_Tu: number|string }, ...]
    const orders = Array.isArray(payload.orders) ? payload.orders : [];
    if (orders.length === 0) {
      return res.status(400).json({ error: 'Missing orders' });
    }

    const valueRanges = orders.map((o) => ({
      range: `${SHEET_NAME}!U${o._rowIndex}:U${o._rowIndex}`,
      values: [[String(o.Thu_Tu)]],
    }));

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueRanges }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_reorder', detail: errText });
    }

    return res.status(200).json({ success: true });
  }

  if (payload.action === 'delete') {
    if (!payload._rowIndex) {
      return res.status(400).json({ error: 'Missing _rowIndex' });
    }

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaRes.ok) {
      return res.status(500).json({ error: 'sheets_meta_fail' });
    }

    const metaData = await metaRes.json();
    const targetSheet = metaData.sheets.find(
      (s) => s.properties.title === SHEET_NAME
    );

    if (!targetSheet) {
      return res.status(404).json({ error: 'Sheet Khach_Times not found' });
    }

    const gid = targetSheet.properties.sheetId;
    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: gid,
                dimension: 'ROWS',
                startIndex: payload._rowIndex - 1,
                endIndex: payload._rowIndex,
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_delete', detail: errText });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: `Unknown action: ${payload.action}` });
}

// ============ Auth ============
function getAccessToken(email, privateKey, writable = false) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const scope = writable
    ? 'https://www.googleapis.com/auth/spreadsheets'
    : 'https://www.googleapis.com/auth/spreadsheets.readonly';

  const claimSet = Buffer.from(
    JSON.stringify({
      iss: email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url');

  const signInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signature = signer.sign(privateKey, 'base64url');
  const jwt = `${signInput}.${signature}`;

  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.access_token) throw new Error('token_fail: ' + JSON.stringify(data));
      return data.access_token;
    });
}
