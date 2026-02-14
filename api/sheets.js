import crypto from 'crypto';

const QUAN_VIETTAT = {
  'Ba Đình': 'BD', 'Bắc Từ Liêm': 'BTL', 'Cầu Giấy': 'CG', 'Đống Đa': 'DD',
  'Hà Đông': 'HD', 'Hai Bà Trưng': 'HBT', 'Hoàn Kiếm': 'HK', 'Hoàng Mai': 'HM',
  'Long Biên': 'LB', 'Nam Từ Liêm': 'NTL', 'Tây Hồ': 'TH', 'Thanh Xuân': 'TX',
  'Ba Vì': 'BV', 'Chương Mỹ': 'CM', 'Đan Phượng': 'DP', 'Đông Anh': 'DA',
  'Gia Lâm': 'GL', 'Hoài Đức': 'HoD', 'Mê Linh': 'ML', 'Mỹ Đức': 'MD',
  'Phú Xuyên': 'PX', 'Phúc Thọ': 'PT', 'Quốc Oai': 'QO', 'Sóc Sơn': 'SS',
  'Sơn Tây': 'ST', 'Thạch Thất': 'TT', 'Thanh Oai': 'TO', 'Thanh Trì': 'TTr',
  'Thường Tín': 'TTi', 'Ứng Hòa': 'UH',
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
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
      return res.status(500).json({ error: 'Google Sheets not configured' });
    }

    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);

    // Read existing rows to count STT per district
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:B`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let stt = 1;
    if (readRes.ok) {
      const readData = await readRes.json();
      const rows = readData.values || [];
      // Count rows with matching district (column B = quan_huyen)
      const quanVT = QUAN_VIETTAT[data.quan_huyen] || 'XX';
      stt = rows.filter((r) => r[1] === data.quan_huyen).length + 1;
    }

    // Generate ID: [Nguồn]-[Quận viết tắt]-[STT]
    const nguon = data.nguon_phong || 'X';
    const quanCode = QUAN_VIETTAT[data.quan_huyen] || 'XX';
    const id = `${nguon}-${quanCode}-${stt}`;

    // 19 columns A-S
    const row = [
      id,                                           // A - ID
      data.quan_huyen || '',                         // B - Quận/Huyện
      data.khu_vuc || '',                            // C - Khu vực
      data.dia_chi || '',                            // D - Địa chỉ
      data.gia || '',                                // E - Giá
      data.loai_phong || '',                         // F - Loại phòng
      data.so_phong || '',                           // G - Số phòng
      data.trang_thai || 'Còn',                      // H - Trạng thái
      data.nguon_phong || '',                        // I - Nguồn phòng
      (data.images || []).join(', '),                // J - Link ảnh
      (data.videos || []).join(', '),                // K - Link video
      data.gia_dien || '',                           // L - Giá điện
      data.gia_nuoc || '',                           // M - Giá nước
      data.gia_internet || '',                       // N - Giá internet
      data.dich_vu_chung || '',                      // O - Dịch vụ chung
      data.noi_that || '',                           // P - Nội thất
      data.ghi_chu || '',                            // Q - Ghi chú
      data.ngay_input || new Date().toISOString(),   // R - Ngày nhập
      data.thong_tin_raw || '',                      // S - Thông tin gốc
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:S:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

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
