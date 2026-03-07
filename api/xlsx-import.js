import crypto from 'crypto';

/**
 * API để lưu/đọc data import từ file XLSX
 * Data được parse ở frontend, gửi lên dưới dạng JSON, lưu vào Google Sheet tab _XLSX_Import
 * Mỗi sheet trong file XLSX = 1 row trong tab _XLSX_Import (col A = sheetName, col B = JSON data)
 *
 * GET: đọc tất cả data đã import
 * POST: lưu data mới (ghi đè toàn bộ)
 */

const TAB_NAME = '_XLSX_Import';

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

    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);

    if (req.method === 'GET') {
      return handleGet(req, res, SHEET_ID, token);
    }
    if (req.method === 'POST') {
      return handlePost(req, res, SHEET_ID, token);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[xlsx-import] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

async function ensureTab(sheetId, token) {
  // Check if tab exists
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
  const metaData = await metaRes.json();
  const tabs = metaData.sheets?.map(s => s.properties.title) || [];

  if (!tabs.includes(TAB_NAME)) {
    // Create the tab
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          addSheet: { properties: { title: TAB_NAME } }
        }]
      }),
    });
  }
}

async function handleGet(req, res, sheetId, token) {
  await ensureTab(sheetId, token);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A:B?majorDimension=ROWS`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    const errText = await response.text();
    return res.status(500).json({ error: 'read_fail', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];

  // Row 0 = header (sheetName, jsonData, importDate)
  // Row 1+ = actual data
  if (rows.length <= 1) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ sheets: [], importDate: null });
  }

  const importDate = rows[0]?.[2] || null; // col C of header row stores import date

  const sheets = [];
  for (let i = 1; i < rows.length; i++) {
    const [sheetName, jsonStr] = rows[i];
    if (!sheetName || !jsonStr) continue;
    try {
      const parsed = JSON.parse(jsonStr);
      sheets.push({ name: sheetName, ...parsed });
    } catch (e) {
      // skip corrupt rows
    }
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({ sheets, importDate });
}

async function handlePost(req, res, sheetId, token) {
  const { sheets } = req.body;
  if (!sheets || !Array.isArray(sheets)) {
    return res.status(400).json({ error: 'Missing sheets array' });
  }

  await ensureTab(sheetId, token);

  // Clear existing data
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A:C:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  // Write new data
  const importDate = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const values = [
    ['sheetName', 'jsonData', importDate], // header row with import date in col C
  ];

  for (const sheet of sheets) {
    const { name, ...rest } = sheet;
    values.push([name, JSON.stringify(rest)]);
  }

  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A1?valueInputOption=RAW`;
  const writeRes = await fetch(writeUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: `${TAB_NAME}!A1`, majorDimension: 'ROWS', values }),
  });

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    return res.status(500).json({ error: 'write_fail', detail: errText });
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({ ok: true, importDate, sheetCount: sheets.length });
}

// ============ Auth ============
function getAccessToken(email, privateKey) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);

  const claimSet = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
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
