import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

    if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ error: 'Google Sheets not configured' });
    }

    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const row = [
      id,
      data.ma_toa || '',
      data.dia_chi || '',
      data.quan || '',
      data.khu_vuc || '',
      data.gia || '',
      data.dien_tich || '',
      data.loai_phong || '',
      data.khep_kin ? 'TRUE' : 'FALSE',
      data.xe_dien ? 'TRUE' : 'FALSE',
      data.pet ? 'TRUE' : 'FALSE',
      data.dien || '',
      data.nuoc || '',
      data.internet || '',
      data.noi_that || '',
      data.mo_ta || '',
      data.hoa_hong || '',
      (data.images || []).join(', '),
      (data.videos || []).join(', '),
      data.ngay_dang || new Date().toISOString(),
      'available',
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:U:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      return res.status(500).json({ error: 'sheets_write', detail: errText });
    }

    return res.status(200).json({ success: true, id });
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
