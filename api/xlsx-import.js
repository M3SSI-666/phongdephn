import crypto from 'crypto';

/**
 * API để lưu/đọc data import từ file XLSX
 * Data được parse ở frontend, gửi lên dưới dạng JSON
 * Lưu vào Google Sheet tab _XLSX_Import
 * JSON lớn được chia thành chunks ≤ 40KB mỗi cell
 *
 * Format:
 * Row 1: header row ['_meta', importDate, sheetCount]
 * Row 2+: [sheetName, chunkIndex, jsonChunk]
 *
 * GET: đọc tất cả data đã import
 * POST: lưu data mới (ghi đè toàn bộ)
 */

const TAB_NAME = '_XLSX_Import';
const CHUNK_SIZE = 40000; // 40KB per cell (GSheet limit 50KB)

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
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
  const metaData = await metaRes.json();
  const tabs = metaData.sheets?.map(s => s.properties.title) || [];

  if (!tabs.includes(TAB_NAME)) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: TAB_NAME } } }]
      }),
    });
  }
}

async function handleGet(req, res, sheetId, token) {
  await ensureTab(sheetId, token);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A:C?majorDimension=ROWS`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    const errText = await response.text();
    return res.status(500).json({ error: 'read_fail', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];

  if (rows.length <= 1) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).json({ sheets: [], importDate: null });
  }

  // Row 0 = meta: ['_meta', importDate, sheetCount]
  const importDate = rows[0]?.[1] || null;

  // Collect chunks by sheet name
  const chunkMap = {}; // sheetName -> {chunks: {idx: str}}
  for (let i = 1; i < rows.length; i++) {
    const [sheetName, chunkIdx, jsonChunk] = rows[i];
    if (!sheetName || jsonChunk === undefined) continue;
    if (!chunkMap[sheetName]) chunkMap[sheetName] = {};
    chunkMap[sheetName][Number(chunkIdx) || 0] = jsonChunk || '';
  }

  // Reassemble JSON from chunks
  const sheets = [];
  for (const [sheetName, chunks] of Object.entries(chunkMap)) {
    const maxIdx = Math.max(...Object.keys(chunks).map(Number));
    let fullJson = '';
    for (let i = 0; i <= maxIdx; i++) {
      fullJson += chunks[i] || '';
    }
    try {
      const parsed = JSON.parse(fullJson);
      sheets.push({ name: sheetName, ...parsed });
    } catch (e) {
      console.error(`[xlsx-import] Parse error for sheet "${sheetName}": ${e.message}`);
    }
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({ sheets, importDate });
}

async function handlePost(req, res, sheetId, token) {
  const { sheets, mode = 'init' } = req.body;
  if (!sheets || !Array.isArray(sheets)) {
    return res.status(400).json({ error: 'Missing sheets array' });
  }

  await ensureTab(sheetId, token);

  const importDate = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  if (mode === 'init') {
    // Clear existing data
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A:C:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    // Write header row
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A1?valueInputOption=RAW`;
    await fetch(headerUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        range: `${TAB_NAME}!A1`,
        majorDimension: 'ROWS',
        values: [['_meta', importDate, '0']],
      }),
    });
  }

  // Find next available row by reading existing data
  const countUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(TAB_NAME)}!A:A?majorDimension=COLUMNS`;
  const countRes = await fetch(countUrl, { headers: { Authorization: `Bearer ${token}` } });
  const countData = await countRes.json();
  let nextRow = (countData.values?.[0]?.length || 0) + 1;

  // Build rows with chunked JSON for this batch of sheets
  const values = [];

  for (const sheet of sheets) {
    const { name, ...rest } = sheet;
    const jsonStr = JSON.stringify(rest);

    const numChunks = Math.ceil(jsonStr.length / CHUNK_SIZE);
    for (let i = 0; i < numChunks; i++) {
      const chunk = jsonStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      values.push([name, String(i), chunk]);
    }
  }

  // Write in batches
  const BATCH_SIZE = 100;
  for (let batchStart = 0; batchStart < values.length; batchStart += BATCH_SIZE) {
    const batch = values.slice(batchStart, batchStart + BATCH_SIZE);
    const startRow = nextRow + batchStart;
    const rangeStr = `${TAB_NAME}!A${startRow}`;

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeStr)}?valueInputOption=RAW`;
    const writeRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: rangeStr, majorDimension: 'ROWS', values: batch }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      return res.status(500).json({ error: 'write_fail', detail: errText, batch: batchStart });
    }
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({ ok: true, importDate, sheetCount: sheets.length, rowsWritten: values.length });
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
