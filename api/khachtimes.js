import crypto from 'crypto';

const SHEET_NAME = 'Khach_Times';
const COLUMNS = 'A:I'; // 9 columns: STT, Ten, Zalo, SDT, Ngay, Loai, Tai_Chinh, Can_Tu_Van, Ghi_Chu

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
    Ten: row[1] || '',
    Zalo: row[2] || '',
    SDT: row[3] || '',
    Ngay: row[4] || '',
    Loai: row[5] || '',
    Tai_Chinh: row[6] || '',
    Can_Tu_Van: row[7] || '',
    Ghi_Chu: row[8] || '',
    _rowIndex: i + 2, // actual row in sheet (1-indexed, skip header)
  }));

  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).json(items);
}

// ============ POST - Add / Update / Delete ============
async function handlePost(req, res, sheetId, email, key) {
  const payload = req.body;
  if (!payload || !payload.action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  const token = await getAccessToken(email, key, true);

  if (payload.action === 'add') {
    const row = [
      payload.STT, payload.Ten, payload.Zalo, payload.SDT,
      payload.Ngay, payload.Loai, payload.Tai_Chinh,
      payload.Can_Tu_Van, payload.Ghi_Chu,
    ];

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

    const row = [
      payload.STT, payload.Ten, payload.Zalo, payload.SDT,
      payload.Ngay, payload.Loai, payload.Tai_Chinh,
      payload.Can_Tu_Van, payload.Ghi_Chu,
    ];

    const range = `${SHEET_NAME}!A${payload._rowIndex}:I${payload._rowIndex}`;
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

    // Use batchUpdate to delete the row
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;

    // First, get the sheetId (gid) for the Khach_Times sheet
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

    const response = await fetch(url, {
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
                startIndex: payload._rowIndex - 1, // 0-indexed
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
