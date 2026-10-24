import crypto from 'crypto';

// Đẩy một căn sang nhóm Telegram, và quản lý danh sách nhóm.
//
// Gộp hai việc vào MỘT function qua ?sheet=nhom, cùng lý do với api/khachtimes.js:
// Vercel Hobby chỉ cho 12 Serverless Function, tách ra là tiêu một suất cho việc đọc
// ghi mấy dòng cấu hình.
//
// TELEGRAM_BOT_TOKEN chỉ nằm ở đây, KHÔNG bao giờ gửi xuống client: ai cầm token là
// nhắn được vào mọi nhóm bot đang ở trong. Chat ID thì không phải bí mật — không có
// token thì biết chat ID cũng không làm được gì.

const NHOM_SHEET   = 'Telegram_Nhom';
const NHOM_COLUMNS = 'A:C';
const NHOM_HEADERS = ['Ten_Nhom', 'Chat_Id', 'Bang'];

// RAW chứ không USER_ENTERED: chat ID nhóm là số âm rất dài (-1001234567890), để
// Sheets tự đoán kiểu là nó biến thành số rồi làm tròn mất mấy chữ số cuối.
const WRITE_MODE = 'RAW';

// Telegram chỉ nhận tối đa 10 món trong một album.
const MEDIA_MOI_ALBUM = 10;

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

    const laNhom = (req.query?.sheet || req.body?.sheet) === 'nhom';

    if (req.method === 'GET') {
      if (laNhom) return nhomGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      return res.status(400).json({ error: 'GET chỉ dùng cho ?sheet=nhom' });
    }
    if (req.method === 'POST') {
      if (laNhom) return nhomPost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      return guiCan(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[telegram] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ============ Gửi một căn sang nhóm ============

async function guiCan(req, res) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({
      error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN trên Vercel — xem README phần Telegram.',
    });
  }

  const { chatId, maCan, message, images } = req.body || {};
  if (!chatId)  return res.status(400).json({ error: 'Thiếu chatId' });
  if (!message) return res.status(400).json({ error: 'Thiếu nội dung tin' });

  const media = Array.isArray(images) ? images.filter(u => typeof u === 'string' && u) : [];
  const api = (method, body) => goiTelegram(TOKEN, method, body);

  // Thứ tự đúng như lúc gửi tay: ảnh trước, rồi mã căn, rồi thông tin.
  // Ảnh đi trước để khi cuộn lại trong nhóm, nhìn ảnh là nhận ra căn ngay.
  const loi = [];
  for (let i = 0; i < media.length; i += MEDIA_MOI_ALBUM) {
    const lo = media.slice(i, i + MEDIA_MOI_ALBUM).map(url => ({
      type: laVideo(url) ? 'video' : 'photo',
      media: url,
    }));
    const r = await api('sendMediaGroup', { chat_id: chatId, media: lo });
    // Ảnh hỏng thì VẪN gửi tiếp phần chữ: thiếu ảnh còn đỡ hơn là nhóm không nhận
    // được thông tin căn nào cả. Nhưng phải báo lại để người gửi biết mà đăng bù.
    if (!r.ok) loi.push(`ảnh ${Math.floor(i / MEDIA_MOI_ALBUM) + 1}: ${r.detail}`);
  }

  if (maCan) {
    const r = await api('sendMessage', { chat_id: chatId, text: maCan });
    if (!r.ok) return res.status(502).json({ error: `Gửi mã căn thất bại: ${r.detail}` });
  }

  const r = await api('sendMessage', { chat_id: chatId, text: message });
  if (!r.ok) return res.status(502).json({ error: `Gửi thông tin thất bại: ${r.detail}` });

  return res.status(200).json({ ok: true, anhLoi: loi });
}

function laVideo(url) {
  return /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url) || /\/video\/upload\//.test(url);
}

async function goiTelegram(token, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok === false) {
      // description là câu Telegram giải thích vì sao từ chối ("chat not found",
      // "wrong file identifier"...). Giữ nguyên câu đó, đoán lại bằng lời mình chỉ
      // làm người đọc log mất manh mối.
      const detail = data.description || `HTTP ${r.status}`;
      console.error(`[telegram] ${method} lỗi: ${detail}`);
      return { ok: false, detail };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(`[telegram] ${method} không gọi được: ${e.message}`);
    return { ok: false, detail: e.message };
  }
}

// ============ Danh sách nhóm (?sheet=nhom) ============

async function nhomGet(req, res, sheetId, email, key) {
  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!${NHOM_COLUMNS}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!r.ok) {
    const errText = await r.text();
    // Lần chạy đầu chưa có sheet. Tự tạo rồi trả rỗng, để không ai phải vào Google
    // Sheet gõ tay tiêu đề cột trước khi dùng được tính năng.
    if (errText.includes('Unable to parse range')) {
      await taoNhomSheet(sheetId, token);
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const rows = (await r.json()).values || [];
  const items = rows.slice(1)
    .filter(row => (row[0] || '').trim())
    .map(row => ({
      Ten_Nhom: (row[0] || '').trim(),
      Chat_Id:  (row[1] || '').trim(),
      Bang:     (row[2] || '').trim(),
    }));
  return res.status(200).json(items);
}

async function nhomPost(req, res, sheetId, email, key) {
  const { action, Ten_Nhom, Chat_Id, Bang } = req.body || {};
  const ten = (Ten_Nhom || '').trim();
  const bang = (Bang || '').trim();
  if (!ten || !bang) return res.status(400).json({ error: 'Thiếu Ten_Nhom/Bang' });

  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!${NHOM_COLUMNS}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const errText = await r.text();
    if (errText.includes('Unable to parse range')) await taoNhomSheet(sheetId, token);
    else return res.status(500).json({ error: 'sheets_read', detail: errText });
  }
  const rows = r.ok ? ((await r.json()).values || []) : [];

  // Tìm theo CẶP tên + bảng, không theo số dòng client gửi lên: hai người cùng sửa thì
  // số dòng đã lệch, ghi theo số dòng là đè nhầm nhóm khác.
  const idx = rows.findIndex((row, i) =>
    i > 0 && (row[0] || '').trim() === ten && (row[2] || '').trim() === bang);

  if (action === 'delete') {
    if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy nhóm' });
    await ghiDong(sheetId, token, idx + 1, ['', '', '']);
    return res.status(200).json({ ok: true });
  }

  const chatId = (Chat_Id || '').trim();
  if (!chatId) return res.status(400).json({ error: 'Thiếu Chat_Id' });

  if (idx !== -1) {
    await ghiDong(sheetId, token, idx + 1, [ten, chatId, bang]);
    return res.status(200).json({ ok: true, updated: true });
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!${NHOM_COLUMNS}:append?valueInputOption=${WRITE_MODE}&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[ten, chatId, bang]] }),
  });
  return res.status(200).json({ ok: true, added: true });
}

async function ghiDong(sheetId, token, rowNumber, values) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!A${rowNumber}:C${rowNumber}?valueInputOption=${WRITE_MODE}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
}

async function taoNhomSheet(sheetId, token) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: NHOM_SHEET } } }] }),
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!A1:C1?valueInputOption=${WRITE_MODE}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [NHOM_HEADERS] }),
  });
}

// ============ Google auth ============

function getAccessToken(email, privateKey, writable = false) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const scope = writable
    ? 'https://www.googleapis.com/auth/spreadsheets'
    : 'https://www.googleapis.com/auth/spreadsheets.readonly';

  const claimSet = Buffer.from(
    JSON.stringify({
      iss: email,
      scope,
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
    .then((d) => d.access_token);
}
