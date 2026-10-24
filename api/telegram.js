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

// MỘT danh sách nhóm dùng chung cho mọi bảng quỹ căn, không chia theo bảng.
// Bản đầu có cột Bang để mỗi bảng một danh sách riêng, nhưng mô hình đó vỡ ngay:
// Quỹ Đập Thông vẽ bằng chính file QuyCanBan.jsx nên thừa hưởng luôn danh sách của
// Bán — 3 bảng mà chỉ có 2 danh sách. Mà tên nhóm ("B - 1PN") đã tự nói nó thuộc dòng
// nào rồi, nên bắt khai thêm "nhóm này của bảng nào" chỉ là một câu hỏi thừa.
// Sheet cũ có cột C thì cứ để đó, không ai đọc tới nữa.
const NHOM_SHEET   = 'Telegram_Nhom';
const NHOM_COLUMNS = 'A:B';
const NHOM_HEADERS = ['Ten_Nhom', 'Chat_Id'];

// Token bot để SHEET RIÊNG, không nhét chung một dòng vào Telegram_Nhom: GET danh sách
// nhóm trả cả sheet đó về cho trình duyệt, token nằm lẫn trong đó là lộ ngay.
const CH_SHEET   = 'Telegram_Cau_Hinh';
const CH_COLUMNS = 'A:B';
const CH_HEADERS = ['Khoa', 'Gia_Tri'];
const CH_TOKEN   = 'BOT_TOKEN';

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

    const sheet = req.query?.sheet || req.body?.sheet;
    const laNhom = sheet === 'nhom';
    const laCauHinh = sheet === 'cauhinh';
    const laQuet = sheet === 'quet';

    if (req.method === 'GET') {
      if (laNhom)    return nhomGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      if (laCauHinh) return cauHinhGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      if (laQuet)    return quetNhom(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      return res.status(400).json({ error: 'GET chỉ dùng cho ?sheet=nhom, cauhinh hoặc quet' });
    }
    if (req.method === 'POST') {
      if (laNhom)    return nhomPost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      if (laCauHinh) return cauHinhPost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
      return guiCan(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[telegram] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ============ Gửi một căn sang nhóm ============

async function guiCan(req, res, sheetId, email, key) {
  // Token lưu trong app được ưu tiên, biến môi trường Vercel là phương án dự phòng.
  // Thứ tự này để sửa token không phải deploy lại; ai đã đặt sẵn biến trên Vercel thì
  // vẫn chạy nguyên như cũ, không cần làm gì thêm.
  const TOKEN = (await docToken(sheetId, email, key)) || process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({
      error: 'Chưa có token bot. Vào nút "Telegram" trên thanh công cụ để điền.',
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
    }));
  return res.status(200).json(items);
}

async function nhomPost(req, res, sheetId, email, key) {
  const { action, Ten_Nhom, Chat_Id } = req.body || {};
  const ten = (Ten_Nhom || '').trim();
  if (!ten) return res.status(400).json({ error: 'Thiếu Ten_Nhom' });

  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!${NHOM_COLUMNS}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const errText = await r.text();
    if (errText.includes('Unable to parse range')) await taoNhomSheet(sheetId, token);
    else return res.status(500).json({ error: 'sheets_read', detail: errText });
  }
  const rows = r.ok ? ((await r.json()).values || []) : [];

  // Tìm theo TÊN nhóm, không theo số dòng client gửi lên: hai người cùng sửa thì số
  // dòng đã lệch, ghi theo số dòng là đè nhầm nhóm khác.
  const idx = rows.findIndex((row, i) => i > 0 && (row[0] || '').trim() === ten);

  if (action === 'delete') {
    if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy nhóm' });
    await ghiDong(sheetId, token, idx + 1, ['', '']);
    return res.status(200).json({ ok: true });
  }

  const chatId = (Chat_Id || '').trim();
  if (!chatId) return res.status(400).json({ error: 'Thiếu Chat_Id' });

  if (idx !== -1) {
    await ghiDong(sheetId, token, idx + 1, [ten, chatId]);
    return res.status(200).json({ ok: true, updated: true });
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!${NHOM_COLUMNS}:append?valueInputOption=${WRITE_MODE}&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[ten, chatId]] }),
  });
  return res.status(200).json({ ok: true, added: true });
}

async function ghiDong(sheetId, token, rowNumber, values) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${NHOM_SHEET}!A${rowNumber}:B${rowNumber}?valueInputOption=${WRITE_MODE}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
}

// Tự tạo sheet + dòng tiêu đề ở lần chạy đầu, để không ai phải vào Google Sheet gõ tay
// trước khi dùng được tính năng.
async function taoSheet(sheetId, token, ten, headers, oTieuDe) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: ten } } }] }),
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${ten}!${oTieuDe}?valueInputOption=${WRITE_MODE}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [headers] }),
  });
}

const taoNhomSheet = (sheetId, token) => taoSheet(sheetId, token, NHOM_SHEET, NHOM_HEADERS, 'A1:B1');

// ============ Quét nhóm (?sheet=quet) ============

// Dò các nhóm bot đang ở trong, để khỏi phải đi lấy chat ID bằng tay.
//
// Bot API KHÔNG có hàm liệt kê nhóm ("The Bot API does not provide a method to list all
// chats or groups a bot is a member of") — cách duy nhất là đọc getUpdates rồi nhặt chat
// ra từ các sự kiện. Kéo theo hai giới hạn phải nói rõ cho người dùng:
//   - Telegram chỉ giữ update trong 24 GIỜ, nên nhóm im lặng quá một ngày sẽ không hiện.
//   - getUpdates không chạy được khi bot đã cài webhook.
async function quetNhom(req, res, sheetId, email, key) {
  const TOKEN = (await docToken(sheetId, email, key)) || process.env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN) return res.status(400).json({ error: 'Chưa có token bot — điền token trước đã.' });

  // KHÔNG truyền offset: có offset là báo Telegram "đã nhận xong", nó xoá update khỏi
  // hàng đợi. Quét là việc chỉ đọc, không được phép làm mất dữ liệu của lần quét sau.
  // timeout 0 = trả về ngay, hợp với serverless (không ngồi chờ long-poll).
  const r = await goiTelegram(TOKEN, 'getUpdates', { limit: 100, timeout: 0 });
  if (!r.ok) {
    if (/webhook/i.test(r.detail)) {
      return res.status(400).json({
        error: 'Bot đang cài webhook nên không quét được. Gỡ webhook rồi quét lại, hoặc nhập chat ID tay.',
      });
    }
    return res.status(502).json({ error: `Telegram từ chối: ${r.detail}` });
  }

  const thay = new Map();
  for (const up of r.data?.result || []) {
    // my_chat_member là sự kiện bot được thêm/gỡ khỏi nhóm — đúng thứ cần nhất.
    // Mấy cái còn lại để bắt cả nhóm chỉ có tin nhắn thường trong 24h qua.
    const chat = up.my_chat_member?.chat || up.message?.chat || up.channel_post?.chat
      || up.edited_message?.chat || up.chat_member?.chat;
    if (!chat) continue;
    // Bỏ chat 1-1 với người: đây là tính năng đẩy hàng vào nhóm, không phải nhắn riêng.
    if (!['group', 'supergroup', 'channel'].includes(chat.type)) continue;
    thay.set(String(chat.id), {
      Chat_Id:  String(chat.id),
      Ten_Nhom: (chat.title || '').trim() || String(chat.id),
      Loai:     chat.type,
    });
  }
  return res.status(200).json([...thay.values()]);
}

// ============ Cấu hình (?sheet=cauhinh) ============

// Đọc token để dùng nội bộ. KHÔNG có đường nào trả giá trị này ra client.
async function docToken(sheetId, email, key) {
  try {
    const token = await getAccessToken(email, key, true);
    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${CH_SHEET}!${CH_COLUMNS}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return '';          // chưa có sheet -> coi như chưa đặt token
    const rows = (await r.json()).values || [];
    const dong = rows.find((row, i) => i > 0 && (row[0] || '').trim() === CH_TOKEN);
    return (dong?.[1] || '').trim();
  } catch {
    // Đọc cấu hình hỏng thì coi như chưa đặt, để còn rơi xuống biến môi trường —
    // chứ không làm sập luôn đường gửi tin.
    return '';
  }
}

// Chỉ trả về CÓ hay KHÔNG và 4 ký tự cuối. Token đầy đủ không bao giờ rời khỏi server:
// ai cầm nó là nhắn được vào mọi nhóm bot đang ở trong, kể cả nhóm không liên quan.
async function cauHinhGet(req, res, sheetId, email, key) {
  const tokenSheet = await docToken(sheetId, email, key);
  const tokenEnv = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const dung = tokenSheet || tokenEnv;
  return res.status(200).json({
    coToken: !!dung,
    nguon: tokenSheet ? 'app' : (tokenEnv ? 'vercel' : ''),
    duoi: dung ? dung.slice(-4) : '',
  });
}

async function cauHinhPost(req, res, sheetId, email, key) {
  const { action } = req.body || {};
  const token = await getAccessToken(email, key, true);

  if (action === 'delete-token') {
    await ghiCauHinh(sheetId, token, '');
    return res.status(200).json({ ok: true });
  }

  const giaTri = (req.body?.token || '').trim();
  if (!giaTri) return res.status(400).json({ error: 'Thiếu token' });
  // Dạng chuẩn của BotFather: "<số bot>:<chuỗi chữ>". Chặn ở đây để người dùng biết
  // ngay là dán nhầm, thay vì phải gửi thử một căn rồi nhận lỗi khó hiểu từ Telegram.
  if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(giaTri)) {
    return res.status(400).json({ error: 'Token không đúng dạng (phải là 1234567890:AAH...).' });
  }

  // Hỏi Telegram xem token có thật không trước khi lưu. Lưu token sai rồi để người
  // dùng phát hiện lúc đang cần gửi gấp là tệ nhất.
  const kt = await goiTelegram(giaTri, 'getMe', {});
  if (!kt.ok) return res.status(400).json({ error: `Telegram từ chối token: ${kt.detail}` });

  await ghiCauHinh(sheetId, token, giaTri);
  return res.status(200).json({ ok: true, botName: kt.data?.result?.username || '' });
}

async function ghiCauHinh(sheetId, token, giaTri) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${CH_SHEET}!${CH_COLUMNS}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const errText = await r.text();
    if (errText.includes('Unable to parse range')) await taoSheet(sheetId, token, CH_SHEET, CH_HEADERS, 'A1:B1');
    else throw new Error(errText);
  }
  const rows = r.ok ? ((await r.json()).values || []) : [];
  const idx = rows.findIndex((row, i) => i > 0 && (row[0] || '').trim() === CH_TOKEN);

  if (idx !== -1) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${CH_SHEET}!A${idx + 1}:B${idx + 1}?valueInputOption=${WRITE_MODE}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[CH_TOKEN, giaTri]] }),
    });
    return;
  }
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${CH_SHEET}!${CH_COLUMNS}:append?valueInputOption=${WRITE_MODE}&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[CH_TOKEN, giaTri]] }),
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
