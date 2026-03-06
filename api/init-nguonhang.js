import crypto from 'crypto';

// One-time setup: creates Nguon_Hang_Custom tab in the same spreadsheet as Khach_Times
// Call once via: GET /api/init-nguonhang

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

    // Check if Nguon_Hang_Custom tab exists
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const metaData = await metaRes.json();
    const existing = metaData.sheets?.find((s) => s.properties.title === 'Nguon_Hang_Custom');

    // Delete if exists
    if (existing) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
      await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }],
        }),
      });
    }

    // Create new tab
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
    const createRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: 'Nguon_Hang_Custom' } } }],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(500).json({ error: 'Failed to create sheet', detail: errText });
    }

    // Add headers — 13 columns A:M
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Nguon_Hang_Custom!A1:M1?valueInputOption=USER_ENTERED`;
    const headerRes = await fetch(headerUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['STT', 'Loai', 'Phong_Ngu', 'Dien_Tich', 'Huong_BC', 'Slot_Xe', 'Do', 'Chu_Nha', 'SDT', 'Ghi_Chu', 'Gia', 'Hinh_Anh', 'Video']],
      }),
    });

    if (!headerRes.ok) {
      const errText = await headerRes.text();
      return res.status(500).json({ error: 'Failed to write headers', detail: errText });
    }

    return res.status(200).json({ success: true, message: 'Nguon_Hang_Custom tab created with 13-column headers (A:M)' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function getAccessToken(email, privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

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
