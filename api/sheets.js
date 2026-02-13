// Vercel Serverless Function: POST /api/sheets
// Push room data to Google Sheets

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
  const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!SHEET_ID || !SERVICE_EMAIL || !PRIVATE_KEY) {
    return res.status(500).json({ error: 'Google Sheets not configured' });
  }

  const data = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    // Get access token via service account JWT
    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);

    // Generate row ID
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // Build row values matching sheet columns
    const row = [
      id,                                    // A: ID
      data.ma_toa || '',                     // B: Mã toà
      data.dia_chi || '',                    // C: Địa chỉ
      data.quan || '',                       // D: Quận
      data.khu_vuc || '',                    // E: Khu vực
      data.gia || '',                        // F: Giá
      data.dien_tich || '',                  // G: Diện tích
      data.loai_phong || '',                 // H: Loại phòng
      data.khep_kin ? 'TRUE' : 'FALSE',     // I: Khép kín
      data.xe_dien ? 'TRUE' : 'FALSE',      // J: Xe điện
      data.pet ? 'TRUE' : 'FALSE',          // K: Pet
      data.dien || '',                       // L: Điện
      data.nuoc || '',                       // M: Nước
      data.internet || '',                   // N: Internet
      data.noi_that || '',                   // O: Nội thất
      data.mo_ta || '',                      // P: Mô tả
      data.hoa_hong || '',                   // Q: Hoa hồng
      (data.images || []).join(', '),        // R: Image URLs
      (data.videos || []).join(', '),        // S: Video URLs
      data.ngay_dang || new Date().toISOString(), // T: Ngày đăng
      'available',                           // U: Trạng thái
    ];

    // Append to sheet
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:U:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      return res.status(500).json({ error: `Sheets API error: ${errText}` });
    }

    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── JWT Auth for Google Service Account ────────────────────
async function getAccessToken(email, privateKey) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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
    throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
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
  const signature = signer.sign(privateKeyPem, 'base64url');
  return signature;
}
