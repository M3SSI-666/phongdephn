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

    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:U`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!readRes.ok) {
      const errText = await readRes.text();
      return res.status(500).json({ error: 'sheets_read', detail: errText });
    }

    const sheetData = await readRes.json();
    const rows = sheetData.values || [];

    // Debug: return raw data if ?debug=1
    if (req.query.debug === '1') {
      return res.status(200).json({ totalRows: rows.length, firstRow: rows[0], dataRows: rows.slice(1) });
    }

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
    })).filter((r) => r.trang_thai === 'available');

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
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
