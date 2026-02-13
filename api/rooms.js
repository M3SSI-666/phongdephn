// Vercel Serverless Function: GET /api/rooms
// Fetch rooms from Google Sheets for the public website

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const PRIVATE_KEY = rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    return res.status(500).json({ error: 'Google Sheets not configured' });
  }

  try {
    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);

    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:U`;
    const readRes = await fetch(readUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!readRes.ok) {
      const errText = await readRes.text();
      return res.status(500).json({ error: `Sheets read error: ${errText}` });
    }

    const sheetData = await readRes.json();
    const rows = sheetData.values || [];

    // Skip header row, map to objects
    const rooms = rows.slice(1).map((row) => ({
      id: row[0] || '',
      ma_toa: row[1] || '',
      dia_chi: row[2] || '',
      quan: row[3] || '',
      khu_vuc: row[4] || '',
      gia: Number(row[5]) || 0,
      dien_tich: Number(row[6]) || 0,
      loai_phong: row[7] || '',
      khep_kin: row[8] === 'TRUE',
      xe_dien: row[9] === 'TRUE',
      pet: row[10] === 'TRUE',
      dien: row[11] || '',
      nuoc: row[12] || '',
      internet: row[13] || '',
      noi_that: row[14] || '',
      mo_ta: row[15] || '',
      hoa_hong: row[16] || '',
      images: (row[17] || '').split(', ').filter(Boolean),
      videos: (row[18] || '').split(', ').filter(Boolean),
      ngay_dang: row[19] || '',
      trang_thai: row[20] || 'available',
    })).filter(r => r.trang_thai === 'available');

    // Set cache header (5 minutes)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(rooms);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── JWT Auth (same as sheets.js) ───────────────────────────
async function getAccessToken(email, privateKey) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const signInput = `${header}.${claimSet}`;
  const signature = await sign(signInput, privateKey);
  const jwt = `${signInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to get access token');
  }
  return tokenData.access_token;
}

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

async function sign(input, privateKeyPem) {
  const crypto = await import('crypto');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  return signer.sign(privateKeyPem, 'base64url');
}
