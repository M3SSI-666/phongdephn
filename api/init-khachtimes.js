import crypto from 'crypto';

// One-time setup endpoint: creates the Khach_Times sheet with headers
// Call once via: GET /api/init-khachtimes
// After successful creation, this file can be deleted

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

    // Step 1: Check if Khach_Times sheet already exists
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const metaData = await metaRes.json();
    const exists = metaData.sheets?.some((s) => s.properties.title === 'Khach_Times');

    if (exists) {
      return res.status(200).json({ message: 'Khach_Times sheet already exists' });
    }

    // Step 2: Create the sheet
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
    const createRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Khach_Times',
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(500).json({ error: 'Failed to create sheet', detail: errText });
    }

    // Step 3: Add headers
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Khach_Times!A1:I1?valueInputOption=USER_ENTERED`;
    const headerRes = await fetch(headerUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['STT', 'Ten', 'Zalo', 'SDT', 'Ngay', 'Loai', 'Tai_Chinh', 'Can_Tu_Van', 'Ghi_Chu']],
      }),
    });

    if (!headerRes.ok) {
      const errText = await headerRes.text();
      return res.status(500).json({ error: 'Failed to write headers', detail: errText });
    }

    return res.status(200).json({ success: true, message: 'Khach_Times sheet created with headers' });
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
