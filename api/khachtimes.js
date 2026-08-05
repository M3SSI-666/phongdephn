import crypto from 'crypto';

const SHEET_NAME = 'Khach_Times';
// 28 columns: STT, Ngay_PS, Ten_Zalo, SDT, Nhu_Cau, Phong_Ngu, Noi_That, Slot_Xe, Thoi_Han_Thue, Ngay_Vao, Dien_Tich, Tai_Chinh, Toa, Can_Tu_Van, Trang_Thai, Thu_Ve, Ghi_Chu, Coc, Chu_Can, Owner_Id, Thu_Tu, Check_Out, Tang, Ban_Cong, Cua, Coc_Host, Mau_KH, Khu_Vuc
const COLUMNS = 'A:AB';

// RAW, KHÔNG USER_ENTERED. Sheet này có 3 cột ngày dạng chữ tự do — Ngay_PS (B), Ngay_Vao (J),
// Check_Out (V) — và mọi lần lưu khách đều đẩy cả ba qua đây. USER_ENTERED để Sheets tự đoán
// kiểu, và nó đoán sai theo cách phá dữ liệu: "1/7/2026" bị hiểu thành ngày rồi lưu thành số
// serial, ô đang định dạng m/yyyy hiển thị lại thành "1/2026" — mất sạch phần ngày.
// Xem thêm ghi chú cùng loại ở api/quycanthue.js.
// STT và Thu_Tu vì thế lưu thành chuỗi; client đều đã Number() nên không ảnh hưởng.
const WRITE_MODE = 'RAW';

// Sheet thứ hai: danh mục khu vực + ghi chú của từng khu (tab Khách Homestay).
// Gộp vào chung serverless function này qua ?sheet=khu để không vượt trần function của Vercel.
// 3 columns: Ten_Khu, Ghi_Chu, Owner_Id
const KHU_SHEET = 'Khach_Times_Khu';
const KHU_COLUMNS = 'A:C';
const KHU_HEADERS = ['Ten_Khu', 'Ghi_Chu', 'Owner_Id'];

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

    // Rẽ nhánh ở đây thay vì luồn một biến SHEET_NAME xuống handler dùng chung: 2 sheet có
    // schema khác hẳn (28 vs 3 cột) và động từ khác hẳn, dùng chung sẽ đẻ ra `if (isKhu)`
    // trong từng nhánh action.
    const isKhu = req.query?.sheet === 'khu' || req.body?.sheet === 'khu';

    if (req.method === 'GET') {
      return isKhu
        ? handleKhuGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY)
        : handleGet(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    }
    if (req.method === 'POST') {
      return isKhu
        ? handleKhuPost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY)
        : handlePost(req, res, SHEET_ID, SERVICE_EMAIL, PRIVATE_KEY);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[KhachTimes] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ============ GET - Read all rows ============
async function handleGet(req, res, sheetId, email, key) {
  const token = await getAccessToken(email, key);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!${COLUMNS}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const data = await response.json();
  const rows = data.values || [];

  // Skip header row (row 0), map to objects
  const items = rows.slice(1).map((row, i) => ({
    STT: row[0] || '',
    Ngay_PS: row[1] || '',
    Ten_Zalo: row[2] || '',
    SDT: row[3] || '',
    Nhu_Cau: row[4] || '',
    Phong_Ngu: row[5] || '',
    Noi_That: row[6] || '',
    Slot_Xe: row[7] || '',
    Thoi_Han_Thue: row[8] || '',
    Ngay_Vao: row[9] || '',
    Dien_Tich: row[10] || '',
    Tai_Chinh: row[11] || '',
    Toa: row[12] || '',
    Can_Tu_Van: row[13] || '',
    Trang_Thai: row[14] || '',
    Thu_Ve: row[15] || '',
    Ghi_Chu: row[16] || '',
    Coc: row[17] || '',
    Chu_Can: row[18] || '',
    Owner_Id: row[19] || '',
    Thu_Tu: row[20] || '',
    Check_Out: row[21] || '',
    Tang: row[22] || '',
    Ban_Cong: row[23] || '',
    Cua: row[24] || '',
    Coc_Host: row[25] || '',
    Mau_KH: row[26] || '',
    // Khu vực (tab Khách Homestay). Trả nguyên ô, KHÔNG mặc định 'Times' ở đây: client
    // sẽ dội giá trị này ngược lại sheet ở lần sửa kế, thành backfill chui lên cả khách
    // Bán/Thuê. Quy ước "rỗng = Times" nằm ở khuOf() trong KhachTimes.jsx.
    Khu_Vuc: row[27] || '',
    _rowIndex: i + 2,
  }));

  const userId  = req.query.userId  || '';
  const role    = req.query.role    || 'staff';
  const viewAs  = req.query.viewAs  === '1';

  const filtered = userId
    ? items.filter(it => it.Owner_Id === userId || (!viewAs && role === 'admin' && !it.Owner_Id))
    : items;

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.status(200).json(filtered);
}

// ============ POST - Add / Update / Delete ============
async function handlePost(req, res, sheetId, email, key) {
  const payload = req.body;
  if (!payload || !payload.action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  const token = await getAccessToken(email, key, true);

  function buildRow(p) {
    return [
      p.STT, p.Ngay_PS, p.Ten_Zalo, p.SDT,
      p.Nhu_Cau, p.Phong_Ngu, p.Noi_That, p.Slot_Xe,
      p.Thoi_Han_Thue, p.Ngay_Vao, p.Dien_Tich, p.Tai_Chinh,
      p.Toa, p.Can_Tu_Van, p.Trang_Thai, p.Thu_Ve || '', p.Ghi_Chu, p.Coc || '', p.Chu_Can || '', p.Owner_Id || '', p.Thu_Tu || '', p.Check_Out || '', p.Tang || '', p.Ban_Cong || '', p.Cua || '', p.Coc_Host || '', p.Mau_KH || '', p.Khu_Vuc || '',
    ];
  }

  if (payload.action === 'add') {
    const row = buildRow(payload);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:append?valueInputOption=${WRITE_MODE}&insertDataOption=INSERT_ROWS`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_append', detail: errText });
    }

    const appendData = await response.json();
    // Extract the actual row index from the updated range (e.g. "Khach_Times!A11:T11")
    const updatedRange = appendData.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/!A(\d+)/);
    const rowIndex = rowMatch ? parseInt(rowMatch[1]) : null;

    return res.status(200).json({ success: true, rowIndex });
  }

  if (payload.action === 'update') {
    if (!payload._rowIndex) {
      return res.status(400).json({ error: 'Missing _rowIndex' });
    }

    const row = buildRow(payload);
    // Dải phải khớp ĐÚNG số phần tử buildRow trả về. Hẹp hơn -> Google trả 400; rộng hơn
    // -> ô thừa không được ghi, lưu "thành công" mà dữ liệu không dính. Sửa 2 chỗ cùng lúc.
    const range = `${SHEET_NAME}!A${payload._rowIndex}:AB${payload._rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=${WRITE_MODE}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_update', detail: errText });
    }

    return res.status(200).json({ success: true });
  }

  if (payload.action === 'reorder') {
    // payload.orders: [{ _rowIndex: number, Thu_Tu: number|string }, ...]
    const orders = Array.isArray(payload.orders) ? payload.orders : [];
    if (orders.length === 0) {
      return res.status(400).json({ error: 'Missing orders' });
    }

    const valueRanges = orders.map((o) => ({
      range: `${SHEET_NAME}!U${o._rowIndex}:U${o._rowIndex}`,
      values: [[String(o.Thu_Tu)]],
    }));

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valueInputOption: WRITE_MODE, data: valueRanges }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_reorder', detail: errText });
    }

    return res.status(200).json({ success: true });
  }

  if (payload.action === 'delete') {
    if (!payload._rowIndex) {
      return res.status(400).json({ error: 'Missing _rowIndex' });
    }

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const gid = await getSheetGid(sheetId, token, SHEET_NAME);
    if (gid === null) {
      return res.status(404).json({ error: 'Sheet Khach_Times not found' });
    }

    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: gid,
                dimension: 'ROWS',
                startIndex: payload._rowIndex - 1,
                endIndex: payload._rowIndex,
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'sheets_delete', detail: errText });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: `Unknown action: ${payload.action}` });
}

// ============ Khu vực (?sheet=khu) - Danh mục khu + ghi chú ============
async function handleKhuGet(req, res, sheetId, email, key) {
  const token = await getAccessToken(email, key, true);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${KHU_SHEET}!${KHU_COLUMNS}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    const errText = await response.text();
    // Sheet chưa tồn tại (lần chạy đầu). Tự tạo rồi trả rỗng, thay vì ném cục lỗi Google
    // mà không ai đoán được nguyên nhân.
    if (errText.includes('Unable to parse range')) {
      await createKhuSheet(sheetId, token);
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'sheets_read', detail: errText });
  }

  const rows = (await response.json()).values || [];
  const items = rows.slice(1).map((row, i) => ({
    Ten_Khu: row[0] || '',
    Ghi_Chu: row[1] || '',
    Owner_Id: row[2] || '',
    _rowIndex: i + 2,
  })).filter(it => it.Ten_Khu);

  const userId = req.query.userId || '';
  // Danh mục khu là của riêng từng user, khớp với cách lọc khách ở handleGet.
  const filtered = userId ? items.filter(it => it.Owner_Id === userId) : [];

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.status(200).json(filtered);
}

async function handleKhuPost(req, res, sheetId, email, key) {
  const payload = req.body;
  if (!payload || !payload.action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  const ten = String(payload.Ten_Khu || '').trim();
  const ownerId = String(payload.Owner_Id || '');
  if (!ten) return res.status(400).json({ error: 'Thiếu tên khu vực' });
  if (!ownerId) return res.status(400).json({ error: 'Thiếu Owner_Id' });

  const token = await getAccessToken(email, key, true);
  const hit = await findKhuRow(sheetId, token, ownerId, ten);
  if (hit.error) return res.status(500).json(hit.error);

  if (payload.action === 'addkhu') {
    // Upsert, KHÔNG append mù: hai máy cùng thêm "Ocean" một lúc không được đẻ 2 dòng.
    if (hit.row) return res.status(200).json({ success: true, mode: 'exists', _rowIndex: hit.row });
    const r = await appendKhu(sheetId, token, [ten, String(payload.Ghi_Chu || ''), ownerId]);
    if (r !== true) return res.status(500).json(r);
    return res.status(200).json({ success: true, mode: 'add' });
  }

  if (payload.action === 'setnote') {
    const note = String(payload.Ghi_Chu || '').slice(0, 5000);
    // Không thấy dòng = thẻ "ma" (chỉ tồn tại trong dữ liệu khách). Ghi chú là cách tự
    // nhiên để vật chất hoá nó.
    if (!hit.row) {
      const r = await appendKhu(sheetId, token, [ten, note, ownerId]);
      if (r !== true) return res.status(500).json(r);
      return res.status(200).json({ success: true, mode: 'add' });
    }
    // Ghi ĐÚNG một ô: không thể đè lên tên khu đang được sửa song song ở máy khác.
    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${KHU_SHEET}!B${hit.row}?valueInputOption=${WRITE_MODE}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[note]] }),
      }
    );
    if (!r.ok) return res.status(500).json({ error: 'sheets_setnote', detail: await r.text() });
    return res.status(200).json({ success: true, mode: 'update', _rowIndex: hit.row });
  }

  if (payload.action === 'delkhu') {
    if (!hit.row) return res.status(200).json({ success: true, mode: 'noop' });
    const gid = await getSheetGid(sheetId, token, KHU_SHEET);
    if (gid === null) return res.status(404).json({ error: 'Sheet Khach_Times_Khu not found' });
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId: gid, dimension: 'ROWS', startIndex: hit.row - 1, endIndex: hit.row },
          },
        }],
      }),
    });
    if (!r.ok) return res.status(500).json({ error: 'sheets_delkhu', detail: await r.text() });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: `Unknown action: ${payload.action}` });
}

// Dò dòng theo (Owner_Id, Ten_Khu) NGAY TRÊN SERVER. Tuyệt đối không nhận _rowIndex của
// client cho sheet này: sheet dùng chung, user A xoá 1 thẻ là mọi dòng bên dưới — kể cả của
// user B — trượt lên 1, và _rowIndex client đang giữ sẽ trỏ vào dòng người khác.
async function findKhuRow(sheetId, token, ownerId, ten) {
  const ranges = ['A', 'C'].map(c => `ranges=${KHU_SHEET}!${c}:${c}`).join('&');
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}&majorDimension=COLUMNS`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) {
    const errText = await r.text();
    // Sheet chưa có -> chưa có dòng nào, đường addkhu sẽ tự tạo khi append.
    if (errText.includes('Unable to parse range')) return { row: null };
    return { error: { error: 'sheets_read', detail: errText } };
  }
  const vr = (await r.json()).valueRanges || [];
  // Mỗi cột bị cắt đuôi ĐỘC LẬP (cột rỗng hẳn thì không có key `values`), nên duyệt theo
  // cột tên và đọc cột kia bằng (arr[i] || '') — không zip, không Math.min.
  const tenCol = vr[0]?.values?.[0] || [];
  const ownCol = vr[1]?.values?.[0] || [];
  const key = ten.trim().toLowerCase();
  // i = 0 là dòng tiêu đề -> dòng sheet = i + 1.
  for (let i = 1; i < tenCol.length; i++) {
    if ((ownCol[i] || '') === ownerId && String(tenCol[i] || '').trim().toLowerCase() === key) {
      return { row: i + 1 };
    }
  }
  return { row: null };
}

async function appendKhu(sheetId, token, row) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${KHU_SHEET}!A1:append?valueInputOption=${WRITE_MODE}&insertDataOption=INSERT_ROWS`;
  let r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!r.ok) {
    const errText = await r.text();
    if (!errText.includes('Unable to parse range')) {
      return { error: 'sheets_append_khu', detail: errText };
    }
    await createKhuSheet(sheetId, token);
    r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    });
    if (!r.ok) return { error: 'sheets_append_khu', detail: await r.text() };
  }
  return true;
}

async function createKhuSheet(sheetId, token) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: KHU_SHEET } } }] }),
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${KHU_SHEET}!A1:C1?valueInputOption=${WRITE_MODE}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [KHU_HEADERS] }),
  });
}

// gid của sheet không bao giờ đổi -> nhớ lại để đường xoá bớt 1 lượt gọi metadata.
const _gidCache = {};
async function getSheetGid(sheetId, token, sheetName) {
  const k = `${sheetId}|${sheetName}`;
  if (_gidCache[k] !== undefined) return _gidCache[k];
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  const t = (d.sheets || []).find(s => s.properties.title === sheetName);
  const gid = t ? t.properties.sheetId : null;
  if (gid !== null) _gidCache[k] = gid;
  return gid;
}

// ============ Auth ============
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
    .then((data) => {
      if (!data.access_token) throw new Error('token_fail: ' + JSON.stringify(data));
      return data.access_token;
    });
}
