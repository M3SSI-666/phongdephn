import crypto from 'crypto';

const SHEET_NAME = 'Quy_Can_Thue';
// 19 columns: STT, Ngay_PS, Ngay_Cap_Nhat, Nguon, Ma_Can, PN, Dien_Tich, BC, Gia, Phi_MG, TT, Slot_Xe, Thang, Nam, Ten_Chu, SDT_Chu, Pass, Ghi_Chu, Mau_Ma_Can
const COLUMNS = 'A:S';

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
    console.error(`[QuyCan Thue] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(req, res, sheetId, email, key) {
  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    // Nếu tab chưa tồn tại → tự tạo tab + header
    if (errText.includes('Unable to parse range')) {
      await createSheetWithHeaders(sheetId, token);
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];

  const items = rows.slice(1).map((row, i) => ({
    STT: row[0] || '',
    Ngay_PS: row[1] || '',
    Ngay_Cap_Nhat: row[2] || '',
    Nguon: row[3] || '',
    Ma_Can: row[4] || '',
    PN: row[5] || '',
    Dien_Tich: row[6] || '',
    BC: row[7] || '',
    Gia: row[8] || '',
    Phi_MG: row[9] || '',
    TT: row[10] || '',
    Slot_Xe: row[11] || '',
    Thang: row[12] || '',
    Nam: row[13] || '',
    Ten_Chu: row[14] || '',
    SDT_Chu: row[15] || '',
    Pass: row[16] || '',
    Ghi_Chu: row[17] || '',
    Mau_Ma_Can: row[18] || '',
    _rowIndex: i + 2,
  }));

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.status(200).json(items);
}

async function handlePost(req, res, sheetId, email, key) {
  const payload = req.body;
  if (!payload || !payload.action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  const token = await getAccessToken(email, key, true);

  function buildRow(p) {
    return [
      p.STT, p.Ngay_PS, p.Ngay_Cap_Nhat, p.Nguon,
      p.Ma_Can, p.PN, p.Dien_Tich, p.BC,
      p.Gia, p.Phi_MG, p.TT, p.Slot_Xe,
      p.Thang, p.Nam, p.Ten_Chu, p.SDT_Chu,
      p.Pass, p.Ghi_Chu, p.Mau_Ma_Can || '',
    ];
  }

  if (payload.action === 'add') {
    const row = buildRow(payload);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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

    return res.status(200).json({ success: true });
  }

  if (payload.action === 'update') {
    if (!payload._rowIndex) {
      return res.status(400).json({ error: 'Missing _rowIndex' });
    }

    const row = buildRow(payload);
    const range = `${SHEET_NAME}!A${payload._rowIndex}:S${payload._rowIndex}`;
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

  if (payload.action === 'delete') {
    if (!payload._rowIndex) {
      return res.status(400).json({ error: 'Missing _rowIndex' });
    }

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
      return res.status(404).json({ error: 'Sheet Quy_Can_Thue not found' });
    }

    const gid = targetSheet.properties.sheetId;
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: 'ROWS',
              startIndex: payload._rowIndex - 1,
              endIndex: payload._rowIndex,
            },
          },
        }],
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

async function createSheetWithHeaders(sheetId, token) {
  const HEADERS = [
    'STT', 'Ngay_PS', 'Ngay_Cap_Nhat', 'Nguon', 'Ma_Can', 'PN',
    'Dien_Tich', 'BC', 'Gia', 'Phi_MG', 'TT', 'Slot_Xe',
    'Thang', 'Nam', 'Ten_Chu', 'SDT_Chu', 'Pass', 'Ghi_Chu', 'Mau_Ma_Can',
  ];

  // 1. Tạo tab mới
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
  await fetch(batchUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
  });

  // 2. Thêm header row
  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:S1?valueInputOption=USER_ENTERED`;
  await fetch(putUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [HEADERS] }),
  });
}

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
