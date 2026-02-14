import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .trim();

    if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({
        error: 'env_missing',
        hasSheetId: !!SHEET_ID,
        hasEmail: !!SERVICE_EMAIL,
        keyLen: rawKey.length,
      });
    }

    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);

    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:S`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!readRes.ok) {
      const errText = await readRes.text();
      return res.status(500).json({ error: 'sheets_read', detail: errText });
    }

    const sheetData = await readRes.json();
    const rows = sheetData.values || [];

    // 19 columns A-S
    const rooms = rows.slice(1).map((row) => ({
      id: row[0] || '',
      quan_huyen: row[1] || '',
      khu_vuc: row[2] || '',
      dia_chi: row[3] || '',
      gia: Number(row[4]) || 0,
      loai_phong: row[5] || '',
      so_phong: row[6] || '',
      trang_thai: row[7] || 'Còn',
      nguon_phong: row[8] || '',
      images: (row[9] || '').split(', ').filter(Boolean),
      videos: (row[10] || '').split(', ').filter(Boolean),
      gia_dien: row[11] || '',
      gia_nuoc: row[12] || '',
      gia_internet: row[13] || '',
      dich_vu_chung: row[14] || '',
      noi_that: row[15] || '',
      ghi_chu: row[16] || '',
      ngay_input: row[17] || '',
      thong_tin_raw: row[18] || '',
    })).filter((r) => r.trang_thai === 'Còn');

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(rooms);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function getAccessToken(email, privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
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
