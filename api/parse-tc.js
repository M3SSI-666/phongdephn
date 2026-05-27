// Unified Times City parse handler: type=thue|ban|search
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { type, text, query } = req.body;

    let PROMPT;

    if (type === 'thue') {
      if (!text?.trim()) return res.status(400).json({ error: 'Missing text' });
      const cleanText = text
        .replace(/[\u{1F000}-\u{1F9FF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '').replace(/\s+/g, ' ').trim();
      PROMPT = `Parse this Times City apartment rental message (Vietnamese). Return ONLY valid JSON, no markdown.

{"Ma_Can":"","Thiet_Ke":"","Dien_Tich":"","Huong_BC":"","Gia":"","Phi_MG":"","Noi_That":"Đồ cơ bản","Slot_Xe":"Không","Thoi_Gian_Vao":"","Lien_He":"","Ghi_Chu_NT":""}

Rules:
- Ma_Can: apartment code from "Căn hộ:" or "Căn:" line (e.g. "P0112a11", "R6-1208"). Keep original format.
- Thiet_Ke: design/layout from "Thiết kế:" (e.g. "3PN", "2PN", "Studio"). Normalize "3n"→"3PN", "2n"→"2PN".
- Dien_Tich: area with unit from "Diện tích:" (e.g. "106m²", "75m²"). Normalize "106m"→"106m²".
- Huong_BC: balcony direction from "Hướng ban công:" (e.g. "Nam", "Đông Nam", "Tây Bắc").
- Gia + Phi_MG: parse from "Giá:" line in 2 steps:
  STEP 1 — Extract & format the numeric price (always output with space before unit):
  • "tr"/"triệu" = triệu → format as "15 tr", "23 tr"
  • Combined tỷ+triệu: "9ty650"/"9ty650tr" = 9 tỷ + 650 triệu = 9.65 tỷ → "9.65 tỷ"; "10ty5" = 10.05 tỷ → "10.05 tỷ"; "10ty500" = 10.5 tỷ → "10.5 tỷ"
  • Plain tỷ: "9.5ty"/"9.5 tỷ"/"9.5tỷ" → "9.5 tỷ"
  STEP 2 — Detect fee type (always strip fee keyword from Gia):
  • "tv"/"thu về" → Gia=price only, Phi_MG="Thu về"
  • "pmg X" → Gia=price only, Phi_MG=X value (e.g. "pmg 1/2"→"1/2", "pmg 1 tháng"→"1 tháng")
  • "phí đủ" → Gia=price only, Phi_MG="Phí đủ"
  • "nửa tháng"/"phí nửa" → Gia=price only, Phi_MG="Nửa tháng"
  • "1 tháng" fee → Gia=price only, Phi_MG="1 tháng"
  • No fee info → Gia=price only, Phi_MG=""
  Examples: "15tr pmg 1/2"→Gia="15 tr",Phi_MG="1/2" | "14tr tv"→Gia="14 tr",Phi_MG="Thu về" | "23tr phí đủ"→Gia="23 tr",Phi_MG="Phí đủ"
- Noi_That: ONLY one of exactly 3 values based on "Hiện trạng:" line:
  • "Full đồ" — full furniture: "full đồ", "full nội thất", "đầy đủ đồ", "full", "có đồ", "đủ đồ"
  • "Đồ cơ bản" — basic/some furniture: "cơ bản", "một số đồ", "đồ cơ bản"
  • "Không đồ" — empty: "không đồ", "trống", "không nội thất", "thô"
  Default "Đồ cơ bản" if unclear.
- Ghi_Chu_NT: extra notes from "Hiện trạng:" after removing furniture level and slot/parking info (e.g. "nhà sửa đẹp", "mới sơn", "view đẹp"). Empty string if none.
- Slot_Xe: detect from entire message. "có slot"/"slot xe"/"có xe"/"bãi xe" → "Có". "không slot"/"không có xe"/"không xe" → "Không". Default "Không".
- Thoi_Gian_Vao: full content from "Thời gian vào:" line. Only normalize: "lun"→"Luôn", "ngay"→"Ngay". Keep all additional context.
- Lien_He: contact phone/name from "Xem nhà lh:" or "Liên hệ:" line.

Message: ${cleanText}`;

    } else if (type === 'ban') {
      if (!text?.trim()) return res.status(400).json({ error: 'Missing text' });
      const cleanText = text
        .replace(/[\u{1F000}-\u{1F9FF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '').replace(/\s+/g, ' ').trim();
      PROMPT = `Parse this Times City apartment FOR SALE message (Vietnamese). Return ONLY valid JSON, no markdown.

{"Ma_Can":"","Thiet_Ke":"","Dien_Tich":"","Huong_BC":"","Gia":"","Phi":"Thu về","Noi_That":"Đồ cơ bản","Slot_Xe":"Không","SDT":"","Ten_Chu":"","Ghi_Chu_NT":""}

Rules:
- Ma_Can: apartment code from "Căn hộ:" or "Căn:" line. Keep original format, uppercase all letters.
- Thiet_Ke: design/layout (e.g. "3PN", "2PN", "Studio"). Normalize "3n"→"3PN", "2n"→"2PN".
- Dien_Tich: area with unit (e.g. "106m²", "75m²"). Normalize "106m"→"106m²".
- Huong_BC: balcony direction (e.g. "Nam", "Đông Nam", "Tây Bắc").
- Gia + Phi: parse from "Giá:" line in 2 steps:
  STEP 1 — Extract & format the numeric price (always output with space before unit):
  • "tr"/"triệu" = triệu → format as "15 tr", "23 tr"
  • Combined tỷ+triệu: "9ty650"/"9ty650tr" = 9 tỷ + 650 triệu = 9.65 tỷ → "9.65 tỷ"; "10ty5" = 10.05 tỷ; "10ty500" = 10.5 tỷ
  • Plain tỷ: "9.5ty"/"9.5tỷ"/"9.5 tỷ" → "9.5 tỷ"; "22ty" → "22 tỷ"
  • "tv"/"thu về" suffix: strip from number, handle in STEP 2
  STEP 2 — Detect fee:
  • "bao phí"/"phí đủ" → Phi="Bao phí", Gia=price only
  • "pmg X" → Phi=X value, Gia=price only
  • "tv"/"thu về" → Phi="Thu về", Gia=price only
  • Otherwise → Phi="Thu về", Gia=price only
  Examples: "9ty650tv"→Gia="9.65 tỷ",Phi="Thu về" | "5.5ty bao phí"→Gia="5.5 tỷ",Phi="Bao phí" | "4.2 tỷ"→Gia="4.2 tỷ",Phi="Thu về" | "22ty"→Gia="22 tỷ",Phi="Thu về"
- Noi_That: ONLY one of exactly 3 values based on "Hiện trạng:" line:
  • "Full đồ" — full furniture: "full đồ", "full nội thất", "đầy đủ đồ", "full", "có đồ", "đủ đồ"
  • "Đồ cơ bản" — basic/some furniture: "cơ bản", "một số đồ", "đồ cơ bản"
  • "Không đồ" — empty: "không đồ", "trống", "không nội thất", "thô"
  Default "Đồ cơ bản" if unclear.
- Ghi_Chu_NT: extra notes from "Hiện trạng:" after removing furniture level and slot/parking info (e.g. "nhà sửa đẹp", "mới sơn", "view đẹp"). Empty string if none.
- Slot_Xe: "có slot"/"slot xe"/"có xe" → "Có". "không slot"/"không xe" → "Không". Default "Không".
- SDT: phone number from "Liên hệ:", "SĐT:", "Xem nhà lh:" line.
- Ten_Chu: owner/contact name if mentioned.

Message: ${cleanText}`;

    } else if (type === 'search') {
      if (!query?.trim()) return res.status(400).json({ error: 'Missing query' });
      PROMPT = `Parse this Vietnamese real estate search query for Times City Hanoi apartments. Return ONLY valid JSON, no markdown.

{"Thiet_Ke":null,"Slot_Xe":null,"Gia_Max":null,"Gia_Min":null,"Huong_BC":null,"Noi_That":null,"Toa":null,"Khu":null}

Times City zone knowledge (IMPORTANT):
- Khu "Times" = tòa T01,T02,T03,T04,T05,T06,T07,T08,T09,T10,T11
- Khu "ParkHill" = tòa P01,P02,P03,T18(=P04),P05,P06,P07,P08
- Khu "ParkPremium" = tòa P09,P10,P11,P12 (also called "G4" or "Park Premium")

Rules:
- Thiet_Ke: "1PN"|"2PN"|"3PN"|"4PN"|"Studio"|null. Detect: "2 ngủ"→"2PN", "2n"→"2PN", "3 phòng ngủ"→"3PN". null if not mentioned.
- Slot_Xe: "Có" if "có slot"/"slot xe"/"có xe". "Không" if "không slot"/"không xe". null if not mentioned.
- Gia_Max: max budget in triệu. Convert: "19tr"→19, "dưới 20 triệu"→20, "tài chính 19"→19, "4 tỷ"→4000, "tối đa 25tr"→25, "khoảng 20tr"→20. null if not mentioned.
- Gia_Min: min price in triệu. "từ 15tr"→15, "trên 18 triệu"→18. null if not mentioned.
- Huong_BC: "Bắc"|"Nam"|"Đông"|"Tây"|"Đông Nam"|"Đông Bắc"|"Tây Nam"|"Tây Bắc"|null.
- Noi_That: furniture keywords to search. null if not mentioned.
- Toa: specific building code ONLY if user mentions a specific tower like "tòa T04","tòa P01","T18". Normalize: pad single digit "p1"→"P01","t4"→"T04". null if not mentioned or if a zone (Khu) is mentioned instead.
- Khu: "Times" | "ParkHill" | "ParkPremium" | null. Detect zone mentions: "khu times"/"times"→"Times", "park hill"/"parkhill"/"khu park"→"ParkHill", "park premium"/"g4"/"premium"→"ParkPremium". If user mentions a specific Toa, set Khu=null. null if not mentioned.

Important: Toa and Khu are mutually exclusive — if zone is detected set Khu and leave Toa null, and vice versa.

Query: ${query}`;

    } else if (type === 'admin') {
      return handleAdmin(req, res);
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: thue|ban|search|admin' });
    }

    // Try Groq first
    const groqKeys = [];
    if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
    for (let i = 2; i <= 10; i++) { const v = process.env[`GROQ_API_KEY_${i}`]; if (v) groqKeys.push(v); }

    if (groqKeys.length > 0) {
      const start = Math.floor(Math.random() * groqKeys.length);
      for (let i = 0; i < groqKeys.length; i++) {
        const idx = (start + i) % groqKeys.length;
        const result = await callGroq(groqKeys[idx], PROMPT);
        if (result.data) return res.status(200).json(result.data);
      }
    }

    // Fallback Gemini
    const geminiKeys = [];
    if (process.env.GEMINI_API_KEY) geminiKeys.push(process.env.GEMINI_API_KEY);
    for (let i = 2; i <= 10; i++) { const v = process.env[`GEMINI_API_KEY_${i}`]; if (v) geminiKeys.push(v); }

    if (geminiKeys.length > 0) {
      const body = JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      });
      const start = Math.floor(Math.random() * geminiKeys.length);
      for (let i = 0; i < geminiKeys.length; i++) {
        const idx = (start + i) % geminiKeys.length;
        const result = await callGemini(geminiKeys[idx], body);
        if (result.data) return res.status(200).json(result.data);
      }
    }

    return res.status(429).json({ error: 'Rate limit. Thử lại sau 15 giây.' });
  } catch (err) {
    console.error('[parse-tc]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function callGroq(apiKey, prompt) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a JSON extractor. Return ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { error: true };
    const d = await res.json();
    return parseJson(d.choices?.[0]?.message?.content || '');
  } catch { return { error: true }; }
  finally { clearTimeout(t); }
}

async function callGemini(apiKey, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal }
    );
    if (!res.ok) return { error: true };
    const d = await res.json();
    return parseJson(d.candidates?.[0]?.content?.parts?.[0]?.text || '');
  } catch { return { error: true }; }
  finally { clearTimeout(t); }
}

async function handleAdmin(req, res) {
  const SECRET_KEY = process.env.CLERK_SECRET_KEY;
  if (!SECRET_KEY) return res.status(500).json({ error: 'No Clerk secret key' });

  const { action, callerId, userId, role, approved, email } = req.body;

  // Verify caller is admin
  const callerRes = await fetch(`https://api.clerk.com/v1/users/${callerId}`, {
    headers: { Authorization: `Bearer ${SECRET_KEY}` },
  });
  if (!callerRes.ok) return res.status(401).json({ error: 'Invalid caller' });
  const caller = await callerRes.json();
  if (caller.public_metadata?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  if (action === 'list') {
    // Fetch regular users
    const [usersRes, waitlistRes] = await Promise.all([
      fetch('https://api.clerk.com/v1/users?limit=100&order_by=-created_at', {
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      }),
      fetch('https://api.clerk.com/v1/waitlist_entries?limit=100', {
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      }),
    ]);

    const users = usersRes.ok ? await usersRes.json() : [];
    const waitlistData = waitlistRes.ok ? await waitlistRes.json() : { data: [] };
    const waitlist = Array.isArray(waitlistData) ? waitlistData : (waitlistData.data || []);

    const userList = (Array.isArray(users) ? users : []).map(u => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || '(chưa đặt tên)',
      email: u.email_addresses?.[0]?.email_address || '',
      avatar: u.image_url || '',
      role: u.public_metadata?.role || 'pending',
      approved: u.public_metadata?.approved || false,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      source: 'user',
    }));

    const waitlistList = waitlist
      .filter(w => w.status === 'pending')
      .map(w => ({
        id: w.id,
        name: w.email_address || '(chưa có tên)',
        email: w.email_address || '',
        avatar: '',
        role: 'pending',
        approved: false,
        created_at: w.created_at,
        last_sign_in_at: null,
        source: 'waitlist',
      }));

    return res.status(200).json([...waitlistList, ...userList]);
  }

  if (action === 'approve_waitlist') {
    // Invite waitlisted user → they become a real user
    if (!email) return res.status(400).json({ error: 'Missing email' });
    const r = await fetch('https://api.clerk.com/v1/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: email,
        public_metadata: { role: 'staff', approved: true },
      }),
    });
    const result = await r.json();
    return res.status(200).json({ ok: true, result });
  }

  if (action === 'update') {
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const r = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_metadata: { role, approved } }),
    });
    const updated = await r.json();
    return res.status(200).json({ ok: true, metadata: updated.public_metadata });
  }

  if (action === 'ban') {
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    await fetch(`https://api.clerk.com/v1/users/${userId}/ban`, {
      method: 'POST', headers: { Authorization: `Bearer ${SECRET_KEY}` },
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}

function parseJson(content) {
  const block = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const str = block ? block[1].trim() : (content.match(/\{[\s\S]*\}/) || [''])[0];
  if (!str) return { error: true };
  try { return { data: JSON.parse(str) }; }
  catch { try { return { data: JSON.parse(str.replace(/,\s*}/g, '}').replace(/'/g, '"')) }; } catch { return { error: true }; } }
}
