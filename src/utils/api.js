const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Role hiện tại của user, gắn vào mọi POST quỹ căn để server chặn ghi bảng
// hàng công ty (chỉ admin). TimesCity.jsx set giá trị này khi role đổi.
let _clientRole = '';
export function setClientRole(r) { _clientRole = r || ''; }

export async function parseTextWithClaude(rawText) {
  // Try once, if 429 wait 5s and retry once more
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });

    if (res.ok) return res.json();

    const errData = await res.json().catch(() => ({}));

    if (res.status === 429 && attempt === 1) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    throw new Error(errData.error || `Parse failed (${res.status})`);
  }
}

export async function uploadToCloudinary(file, resourceType = 'image', onProgress) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'phongdephn');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(formData);
  });
}

export async function uploadImagesToCloudinary(files, onProgress) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(files[i].file, 'image', (p) => {
      const overall = ((i * 100 + p) / files.length);
      onProgress?.(overall);
    });
    urls.push(url);
  }
  onProgress?.(100);
  return urls;
}

export async function uploadVideosToCloudinary(files, onProgress) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(files[i].file, 'video', (p) => {
      const overall = ((i * 100 + p) / files.length);
      onProgress?.(overall);
    });
    urls.push(url);
  }
  onProgress?.(100);
  return urls;
}

export async function pushToGoogleSheets(data) {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Push to Sheets failed');
  return res.json();
}

export async function smartSearch(query) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (res.ok) return res.json();

    const errData = await res.json().catch(() => ({}));

    if (res.status === 429 && attempt === 1) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    throw new Error(errData.error || `Search failed (${res.status})`);
  }
}

export async function fetchRoomsFromSheets(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const res = await fetch(`/api/rooms?${params.toString()}`);
  if (!res.ok) throw new Error('Fetch rooms failed');
  return res.json();
}

// ============ Nguồn Hàng Custom (cá nhân) ============
export async function fetchNguonHangCustom() {
  const res = await fetch(`/api/nguonhangcustom?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Fetch nguon hang custom failed');
  return res.json();
}

export async function postNguonHangCustom(payload) {
  const res = await fetch('/api/nguonhangcustom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ XLSX Import ============
export async function fetchXlsxImport() {
  const res = await fetch(`/api/xlsx-import?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch XLSX import failed');
  return res.json();
}

export async function postXlsxImport(sheets, mode = 'init') {
  const res = await fetch('/api/xlsx-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheets, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Import failed (${res.status})`);
  }
  return res.json();
}

// ============ Quỹ Căn Thuê ============
export async function fetchQuyCanThue(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now() });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quycanthue?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy can thue failed');
  return res.json();
}

export async function postQuyCanThue(payload) {
  const res = await fetch('/api/quycanthue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, role: _clientRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ Quỹ Căn Thuê Con (bảng con lưu trữ) ============
// Dùng chung endpoint /api/quycanthue, chọn sheet con bằng tham số sheet=con
// (gộp function để không vượt giới hạn Serverless Functions của Vercel).
export async function fetchQuyCanThueCon(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now(), sheet: 'con' });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quycanthue?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy can thue con failed');
  return res.json();
}

export async function postQuyCanThueCon(payload) {
  const res = await fetch('/api/quycanthue?sheet=con', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, sheet: 'con', role: _clientRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || `Action failed (${res.status})`);
    // 409: _rowIndex đang trỏ sang dòng khác (ai đó xoá dòng phía trên). Trang phải tải lại.
    if (err.stale) e.stale = true;
    throw e;
  }
  return res.json();
}

// ============ Quỹ Căn Bán ============
export async function fetchQuyCanBan(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now() });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quycanban?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy can ban failed');
  return res.json();
}

export async function postQuyCanBan(payload) {
  const res = await fetch('/api/quycanban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, role: _clientRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ Quỹ Căn Bán Con (bảng con lưu trữ) ============
export async function fetchQuyCanBanCon(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now(), sheet: 'con' });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quycanban?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy can ban con failed');
  return res.json();
}

export async function postQuyCanBanCon(payload) {
  const res = await fetch('/api/quycanban?sheet=con', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, sheet: 'con', role: _clientRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || `Action failed (${res.status})`);
    if (err.stale) e.stale = true;
    throw e;
  }
  return res.json();
}

// ============ Quỹ Đập Thông ============
export async function fetchQuyDapThong(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now() });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quydapthong?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy dap thong failed');
  return res.json();
}

export async function postQuyDapThong(payload) {
  const res = await fetch('/api/quydapthong', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, role: _clientRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ Quỹ Đập Thông Con (bảng con lưu trữ) ============
export async function fetchQuyDapThongCon(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now(), sheet: 'con' });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quydapthong?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy dap thong con failed');
  return res.json();
}

export async function postQuyDapThongCon(payload) {
  const res = await fetch('/api/quydapthong?sheet=con', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, sheet: 'con', role: _clientRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || `Action failed (${res.status})`);
    if (err.stale) e.stale = true;
    throw e;
  }
  return res.json();
}

// ============ Parse Times City (unified: thue|ban|search) ============
async function callParseTC(body, retry = true) {
  const res = await fetch('/api/parse-tc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return res.json();
  const err = await res.json().catch(() => ({}));
  if (res.status === 429 && retry) {
    await new Promise(r => setTimeout(r, 5000));
    return callParseTC(body, false);
  }
  throw new Error(err.error || `Parse failed (${res.status})`);
}

// Lưới chắn cho kết quả AI. Nội thất chỉ còn 2 trạng thái (Full đồ / Không đồ), nhưng model
// vẫn có thể trả "Đồ cơ bản" theo thói quen — giá trị đó không khớp nút nào trong form, nhìn
// vào tưởng chưa chọn. Nên: chỉ giữ khi trả về đúng 1 trong 2, còn lại đọc lại từ tin nhắn.
function fixNoiThat(result, text) {
  if (!result) return result;
  if (result.Noi_That === 'Full đồ' || result.Noi_That === 'Không đồ') return result;
  const t = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  // "co do" mà không phải "co ban" => Full đồ. Không suy ra được thì để TRỐNG cho người dùng
  // tự chọn, tuyệt đối không đoán bừa hiện trạng căn.
  result.Noi_That = t.includes('co do') && !t.includes('co ban') ? 'Full đồ' : '';
  return result;
}
export function parseThue(text) { return callParseTC({ type: 'thue', text }).then(r => fixNoiThat(r, text)); }
export function parseBan(text)  { return callParseTC({ type: 'ban',  text }).then(r => fixNoiThat(r, text)); }
export function parseSearchQuery(query) { return callParseTC({ type: 'search', query }); }

// ============ Quỹ Shophouse ============
export async function fetchQuyShophouse(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now() });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quyshophouse?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy shophouse failed');
  return res.json();
}

export async function postQuyShophouse(payload) {
  const res = await fetch('/api/quyshophouse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ Quỹ Homestay ============
export async function fetchQuyHomestay(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now() });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/quyhomestay?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch quy homestay failed');
  return res.json();
}

export async function postQuyHomestay(payload) {
  const res = await fetch('/api/quyhomestay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ Khach Times City ============
export async function fetchKhachTimes(userId, role, isViewAs = false) {
  const params = new URLSearchParams({ t: Date.now() });
  if (userId) params.set('userId', userId);
  if (role)   params.set('role', role);
  if (isViewAs) params.set('viewAs', '1');
  const res = await fetch(`/api/khachtimes?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch khach times failed');
  return res.json();
}

export async function postKhachTimes(payload) {
  const res = await fetch('/api/khachtimes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}

// ============ Danh mục Khu Vực (tab Khách Homestay) ============
// Dùng chung endpoint /api/khachtimes, chọn sheet danh mục bằng tham số sheet=khu
// (gộp function để không vượt giới hạn Serverless Functions của Vercel).
export async function fetchKhachTimesKhu(userId) {
  const params = new URLSearchParams({ t: Date.now(), sheet: 'khu' });
  if (userId) params.set('userId', userId);
  const res = await fetch(`/api/khachtimes?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch khach times khu failed');
  return res.json();
}

export async function postKhachTimesKhu(payload) {
  const res = await fetch('/api/khachtimes?sheet=khu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // `sheet` phải có ở CẢ query string lẫn body: handler đọc req.query cho GET và
    // req.body cho POST, thiếu một chỗ là rơi nhầm sang bảng khách.
    body: JSON.stringify({ ...payload, sheet: 'khu' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Action failed (${res.status})`);
  }
  return res.json();
}
