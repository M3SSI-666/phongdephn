import crypto from 'crypto';

// Sheet ID riêng cho Nguồn Hàng (bản copy của bạn)
const NGUON_HANG_SHEET_ID = '18FlknXv4JzRt3taP6Hs56HOwACFxBCkgQPHdsVVCjPE';

export default async function handler(req, res) {
  try {
    const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const PRIVATE_KEY = rawKey
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .trim();

    if (!SERVICE_EMAIL || !PRIVATE_KEY) {
      return res.status(500).json({ error: 'Google Sheets not configured' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = await getAccessToken(SERVICE_EMAIL, PRIVATE_KEY);

    // Lấy danh sách tất cả tab trong sheet
    const sheetTab = req.query.tab;

    if (!sheetTab) {
      // Trả về danh sách tên các tab
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${NGUON_HANG_SHEET_ID}?fields=sheets.properties.title`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        return res.status(500).json({ error: 'sheets_meta', detail: errText });
      }

      const metaData = await metaRes.json();
      const tabs = metaData.sheets.map((s) => s.properties.title);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ tabs });
    }

    // Đọc dữ liệu + màu nền từ tab cụ thể
    // Dùng spreadsheets.get để lấy cả format (backgroundColor)
    const encodedTab = encodeURIComponent(sheetTab);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${NGUON_HANG_SHEET_ID}?ranges=${encodedTab}&fields=sheets.data.rowData.values(formattedValue,effectiveFormat.backgroundColor)`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_read', detail: errText });
    }

    const data = await response.json();
    const sheetData = data.sheets?.[0]?.data?.[0];
    const rowData = sheetData?.rowData || [];

    if (rowData.length === 0) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ headers: [], items: [] });
    }

    // Dòng đầu tiên là header
    const headerRow = rowData[0]?.values || [];
    const headers = headerRow.map((cell) => cell.formattedValue || '');

    // Các dòng dữ liệu
    const items = [];
    for (let i = 1; i < rowData.length; i++) {
      const cells = rowData[i]?.values || [];
      // Bỏ qua dòng trống hoàn toàn
      const hasData = cells.some((c) => c.formattedValue);
      if (!hasData) continue;

      const obj = { _rowIndex: i + 1 };
      const colors = {};

      headers.forEach((h, idx) => {
        const cell = cells[idx];
        obj[h] = cell?.formattedValue || '';

        // Lấy màu nền
        const bg = cell?.effectiveFormat?.backgroundColor;
        if (bg && !(bg.red === 1 && bg.green === 1 && bg.blue === 1) && !(bg.red === undefined && bg.green === undefined && bg.blue === undefined)) {
          const r = Math.round((bg.red || 0) * 255);
          const g = Math.round((bg.green || 0) * 255);
          const b = Math.round((bg.blue || 0) * 255);
          colors[h] = `rgb(${r},${g},${b})`;
        }
      });

      // Cũng lấy màu nền của cả dòng (lấy từ ô đầu tiên có màu, hoặc ô nhiều nhất)
      // Kiểm tra nếu toàn bộ dòng cùng 1 màu
      const colorValues = Object.values(colors);
      if (colorValues.length > 0) {
        obj._colors = colors;
        // Nếu tất cả ô cùng màu → đánh dấu _rowColor
        const allSame = colorValues.every((c) => c === colorValues[0]);
        if (allSame && colorValues.length >= headers.length / 2) {
          obj._rowColor = colorValues[0];
        }
      }

      items.push(obj);
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json({ headers, items });
  } catch (err) {
    console.error(`[NguonHangTimes] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
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
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
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
