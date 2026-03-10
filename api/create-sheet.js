import crypto from 'crypto';

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

    // 1. Tạo tab mới "Quy_Can_Thue"
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
    const addSheetRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: 'Quy_Can_Thue',
            },
          },
        }],
      }),
    });

    if (!addSheetRes.ok) {
      const errText = await addSheetRes.text();
      // Nếu sheet đã tồn tại, bỏ qua lỗi và chỉ thêm header
      if (!errText.includes('already exists')) {
        return res.status(500).json({ error: 'create_sheet_fail', detail: errText });
      }
    }

    // 2. Thêm header row
    const headers = [
      'STT', 'Ngay_PS', 'Ngay_Cap_Nhat', 'Nguon', 'Ma_Can', 'PN',
      'Dien_Tich', 'BC', 'Gia', 'Phi_MG', 'TT', 'Slot_Xe',
      'Thang', 'Nam', 'Ten_Chu', 'SDT_Chu', 'Pass', 'Ghi_Chu',
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Quy_Can_Thue!A1:R1?valueInputOption=USER_ENTERED`;
    const appendRes = await fetch(appendUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [headers] }),
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      return res.status(500).json({ error: 'write_header_fail', detail: errText });
    }

    return res.status(200).json({
      success: true,
      message: 'Tab Quy_Can_Thue đã được tạo với header row!',
      headers,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

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
