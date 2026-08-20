// Unified Times City parse handler: type=thue|ban|search

// Nhà cung cấp AI khai tử model liên tục, và khi đó MỌI tính năng AI chết cùng lúc
// (llama-3.3-70b-versatile bị gỡ giữa 2026 -> cả 3 key Groq trả 404, mọi request dồn
// xuống 1 key Gemini rồi cháy quota -> người dùng chỉ thấy "Rate limit").
// Để tên model ở biến môi trường: lần sau chỉ cần sửa biến trên Vercel, không cần deploy.
const GROQ_MODEL   = process.env.GROQ_MODEL   || 'openai/gpt-oss-120b';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

{"Ma_Can":"","Thiet_Ke":"","Dien_Tich":"","Huong_BC":"","Gia":"","Phi_MG":"","Noi_That":"","Slot_Xe":"Không","Thoi_Gian_Vao":"","Lien_He":"","Ghi_Chu_NT":""}

Rules:
- FILLED-IN FORM: the message is often a form the user typed into, as "Label: value" pairs.
  Newlines were collapsed to spaces, so a label whose value is BLANK is immediately followed by
  the next label (e.g. "... Phí mg: Nội thất: full đồ" means Phí mg is blank).
  A blank label means the field was NOT provided → output "" for it. Never treat a label as a
  value, and never guess a value for a blank label.
  Known labels: "Căn hộ:", "Thiết kế:", "Diện tích:", "Hướng ban công:", "Slot xe:", "Giá:",
  "Phí mg:", "Nội thất:", "Hiện trạng:", "Thời gian vào:", "Liên hệ:", "Xem nhà lh:".
- Ma_Can: apartment code from "Căn hộ:" or "Căn:" line (e.g. "P0112a11", "R6-1208"). Keep original format.
- Thiet_Ke: design/layout from "Thiết kế:" (e.g. "3PN", "2PN", "Studio"). Normalize "3n"→"3PN", "2n"→"2PN".
- Dien_Tich: area with unit from "Diện tích:" (e.g. "106m²", "75m²"). Normalize "106m"→"106m²".
- Huong_BC: balcony direction from "Hướng ban công:" (e.g. "Nam", "Đông Nam", "Tây Bắc").
- Gia + Phi_MG: if there is a separate "Phí mg:" (or "Phí:") label, take Phi_MG from its value
  ("phí đủ"→"Phí đủ", "tv"/"thu về"→"Thu về", "1/2"→"1/2", blank→""), and take Gia from the
  "Giá:" value using STEP 1 only. Otherwise parse both from the "Giá:" line in 2 steps:
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
- Noi_That: ONLY one of exactly 2 values, based on the "Nội thất:" or "Hiện trạng:" value:
  • "Full đồ" — full furniture: "full đồ", "full nội thất", "đầy đủ đồ", "full", "có đồ", "đủ đồ"
  • "Không đồ" — empty: "không đồ", "trống", "không nội thất", "thô"
  Output "" (empty string) if unclear or if it only says partial furniture ("cơ bản", "một số đồ"). Never guess.
- Ghi_Chu_NT: extra notes from the "Nội thất:"/"Hiện trạng:" value after removing furniture level and slot/parking info (e.g. "nhà sửa đẹp", "mới sơn", "view đẹp"). Empty string if none.
- Slot_Xe: if there is a "Slot xe:" label, decide ONLY from its value — "có"/"1"/"2"/"có slot" → "Có";
  "không"/"ko"/"0" → "Không"; BLANK value → "Không". Do NOT answer "Có" merely because the words
  "slot xe" appear: they are the label itself.
  If there is no such label, detect from the whole message: "có slot"/"slot xe"/"có xe"/"bãi xe" → "Có";
  "không slot"/"không có xe"/"không xe" → "Không". Default "Không".
- Thoi_Gian_Vao: full content from "Thời gian vào:" line. Only normalize: "lun"→"Luôn", "ngay"→"Ngay". Keep all additional context.
- Lien_He: contact phone/name from "Xem nhà lh:" or "Liên hệ:" line.

Message: ${cleanText}`;

    } else if (type === 'ban') {
      if (!text?.trim()) return res.status(400).json({ error: 'Missing text' });
      const cleanText = text
        .replace(/[\u{1F000}-\u{1F9FF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '').replace(/\s+/g, ' ').trim();
      PROMPT = `Parse this Times City apartment FOR SALE message (Vietnamese). Return ONLY valid JSON, no markdown.

{"Ma_Can":"","Thiet_Ke":"","Dien_Tich":"","Huong_BC":"","Gia":"","Phi":"Thu về","Noi_That":"","Slot_Xe":"Không","SDT":"","Ten_Chu":"","Ghi_Chu_NT":""}

Rules:
- FILLED-IN FORM: the message is often a form the user typed into, as "Label: value" pairs.
  Newlines were collapsed to spaces, so a label whose value is BLANK is immediately followed by
  the next label (e.g. "... Phí: Nội thất: full đồ" means Phí is blank).
  A blank label means the field was NOT provided → output "" for it. Never treat a label as a
  value, and never guess a value for a blank label.
  Known labels: "Căn hộ:", "Thiết kế:", "Diện tích:", "Hướng ban công:", "Slot xe:", "Giá:",
  "Phí:", "Nội thất:", "Hiện trạng:", "SĐT:", "Tên chủ:", "Liên hệ:".
- Ma_Can: apartment code from "Căn hộ:" or "Căn:" line. Keep original format, uppercase all letters.
- Thiet_Ke: design/layout (e.g. "3PN", "2PN", "Studio"). Normalize "3n"→"3PN", "2n"→"2PN".
- Dien_Tich: area with unit (e.g. "106m²", "75m²"). Normalize "106m"→"106m²".
- Huong_BC: balcony direction (e.g. "Nam", "Đông Nam", "Tây Bắc").
- Gia + Phi: if there is a separate "Phí:" label, take Phi from its value ("bao phí"/"phí đủ"→"Bao phí",
  "tv"/"thu về"→"Thu về", blank→"Thu về"), and take Gia from the "Giá:" value using STEP 1 only.
  Otherwise parse both from the "Giá:" line in 2 steps:
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
- Noi_That: ONLY one of exactly 2 values, based on the "Nội thất:" or "Hiện trạng:" value:
  • "Full đồ" — full furniture: "full đồ", "full nội thất", "đầy đủ đồ", "full", "có đồ", "đủ đồ"
  • "Không đồ" — empty: "không đồ", "trống", "không nội thất", "thô"
  Output "" (empty string) if unclear or if it only says partial furniture ("cơ bản", "một số đồ"). Never guess.
- Ghi_Chu_NT: extra notes from the "Nội thất:"/"Hiện trạng:" value after removing furniture level and slot/parking info (e.g. "nhà sửa đẹp", "mới sơn", "view đẹp"). Empty string if none.
- Slot_Xe: if there is a "Slot xe:" label, decide ONLY from its value — "có"/"1"/"2"/"có slot" → "Có";
  "không"/"ko"/"0" → "Không"; BLANK value → "Không". Do NOT answer "Có" merely because the words
  "slot xe" appear: they are the label itself.
  If there is no such label: "có slot"/"slot xe"/"có xe" → "Có"; "không slot"/"không xe" → "Không". Default "Không".
- SDT: phone number from "SĐT:", "Liên hệ:", "Xem nhà lh:" line.
- Ten_Chu: owner name from "Tên chủ:" line, or the contact name if mentioned elsewhere. "" if none.

Message: ${cleanText}`;

    } else if (type === 'search') {
      if (!query?.trim()) return res.status(400).json({ error: 'Missing query' });
      PROMPT = `Parse this Vietnamese real estate search query for Times City Hanoi apartments. Return ONLY valid JSON, no markdown.

{"Thiet_Ke":null,"Slot_Xe":null,"Gia_Max":null,"Gia_Min":null,"Huong_BC":null,"Noi_That":null,"Toa":null,"Khu":null,"Truc":null,"Tang_Min":null,"Tang_Max":null,"DT_Min":null,"DT_Max":null}

Times City zone knowledge (IMPORTANT):
- Khu "Times" = tòa T01,T02,T03,T04,T05,T06,T07,T08,T09,T10,T11
- Khu "ParkHill" = tòa P01,P02,P03,T18(=P04),P05,P06,P07,P08
- Khu "ParkPremium" = tòa P09,P10,P11,P12 (also called "G4" or "Park Premium")
- Khu "Park" = ParkHill + ParkPremium (Park 1 through Park 12), when user says just "bên Park"/"khu Park"
- Khu "BenT" = every tower whose CODE starts with T: T01..T11 and T18. Said as "bên T"/"bên chữ T".
- Khu "BenP" = every tower whose CODE starts with P: P01,P02,P03,P05..P12. Said as "bên P"/"bên chữ P".
  Note T18 IS Park 4 (code P04 does not exist), so T18 belongs to "ParkHill" and to "BenT", but NOT to "BenP".

Rules:
- Thiet_Ke: "1PN"|"2PN"|"3PN"|"4PN"|"Studio"|null. Detect: "2 ngủ"→"2PN", "2n"→"2PN", "3 phòng ngủ"→"3PN". null if not mentioned.
- Slot_Xe: "Có" if "có slot"/"slot xe"/"có xe". "Không" if "không slot"/"không xe". null if not mentioned.
- Gia_Max: max budget in triệu. Convert: "19tr"→19, "dưới 20 triệu"→20, "tài chính 19"→19, "4 tỷ"→4000, "tối đa 25tr"→25, "khoảng 20tr"→20. null if not mentioned.
- Gia_Min: min price in triệu. "từ 15tr"→15, "trên 18 triệu"→18. null if not mentioned.
- Huong_BC: "Bắc"|"Nam"|"Đông"|"Tây"|"Đông Nam"|"Đông Bắc"|"Tây Nam"|"Tây Bắc"|null.
- Noi_That: ONLY one of exactly 2 values or null. "Full đồ" if: "full đồ","full","đầy đủ","có đồ","đủ đồ". "Không đồ" if: "không đồ","ko đồ","không có đồ","trống","thô". null if not mentioned.
- Toa: specific building code ONLY if user mentions a specific tower like "tòa T04","tòa P01","T18". Normalize: pad single digit "p1"→"P01","t4"→"T04". null if not mentioned or if a zone (Khu) is mentioned instead.
- Khu: "Times" | "ParkHill" | "ParkPremium" | "Park" | "BenT" | "BenP" | null. Detect: "khu times"/"times"→"Times", "park hill"/"parkhill"→"ParkHill", "park premium"/"g4"/"premium"→"ParkPremium", "khu park"/"bên park"→"Park", "bên T"/"bên chữ T"/"bắt đầu bằng chữ T"→"BenT", "bên P"/"bên chữ P"→"BenP". If user mentions a specific Toa, set Khu=null. null if not mentioned.
  Careful: "bên T"/"bên P" are letter-prefix groups, NOT the same as "Times"/"Park". Do not confuse "bên T" with "bên trong"/"bên trái"/"bên phải", which are not zones at all.
- Truc: apartment axis = the LAST 2-3 characters of a unit code, as a STRING. "trục 12"→"12", "trục 5"→"05" (pad to 2 digits), "trục 12A"→"12A", "trục 12B"→"12B". Valid values: "01".."12","12A","12B","15".."24","26". null if not mentioned. Do NOT infer Truc from a floor mention.
- Tang_Min / Tang_Max: floor range as INTEGERS. Single floor sets both: "tầng 20"→Tang_Min=20,Tang_Max=20. Range: "từ tầng 10 đến tầng 20"→10 and 20, "tầng 10-20"→10 and 20. Open ended: "từ tầng 20 trở lên"→Tang_Min=20,Tang_Max=null; "dưới tầng 10"→Tang_Min=null,Tang_Max=9; "tầng cao"→Tang_Min=20,Tang_Max=null; "tầng thấp"→Tang_Min=null,Tang_Max=10. null if not mentioned.
- DT_Min / DT_Max: floor AREA in m², as NUMBERS (decimals allowed). "trên 100m"/"lớn hơn 100m2"/"từ 100m trở lên"→DT_Min=100,DT_Max=null. "dưới 80m"/"nhỏ hơn 80m2"→DT_Min=null,DT_Max=80. "từ 80 đến 100m"/"80-100m2"/"diện tích 80~100"→DT_Min=80,DT_Max=100. Approximate: "khoảng 100m2"/"tầm 100m"/"100m2"→DT_Min=95,DT_Max=105 (±5). Comma is a decimal point: "106,5m2"→106.5.
  ONLY set these when the query has an area unit (m, m2, m², mét, mét vuông) or the words "diện tích"/"dt". A bare number is money, never area: "tài chính 100" is Gia_Max=100, NOT area. Never take area from a floor ("tầng 20") or an axis ("trục 12").

CRITICAL floor numbering: Times City skips 13 and 14, writing them as "12A" and "12B". So "12A" IS floor 13 and "12B" IS floor 14. Always output the INTEGER: "tầng 12A"→13, "tầng 12B"→14, "tầng 13"→13, "tầng 14"→14. Floors run 2..12, 12A(13), 12B(14), 15..35.

Important: Toa and Khu are mutually exclusive — if zone is detected set Khu and leave Toa null, and vice versa.
Truc and Tang are independent of each other and of Toa/Khu: "2 ngủ trục 12" sets Thiet_Ke="2PN" and Truc="12" and leaves the rest null.

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

    // Gom lý do hỏng của TỪNG key. Trước đây mọi thất bại đều bị nuốt rồi báo chung
    // là "Rate limit", nên hết quota, key bị thu hồi và AI trả chậm nhìn giống hệt nhau.
    const fails = [];

    if (groqKeys.length > 0) {
      const start = Math.floor(Math.random() * groqKeys.length);
      for (let i = 0; i < groqKeys.length; i++) {
        const idx = (start + i) % groqKeys.length;
        const result = await callGroq(groqKeys[idx], PROMPT);
        if (result.data) return res.status(200).json(result.data);
        fails.push({ provider: 'Groq', key: idx + 1, ...result });
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
        fails.push({ provider: 'Gemini', key: idx + 1, ...result });
      }
    }

    console.error(`[parse-tc] type=${type} thất bại: ` + (
      fails.length
        ? fails.map(f => `${f.provider}#${f.key}=${f.status || f.reason}`).join(', ')
        : 'không có API key nào được cấu hình'
    ));
    const { code, error } = explainFailure(fails, groqKeys.length + geminiKeys.length);
    return res.status(code).json({ error });
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
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are a JSON extractor. Return ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        // gpt-oss là model có bước suy luận, và token suy luận cũng trừ vào hạn mức này.
        // Để 512 như cũ thì JSON dễ bị cắt cụt giữa chừng -> parse hỏng.
        temperature: 0.1, max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { error: true, status: res.status, detail: (await res.text()).slice(0, 300) };
    const d = await res.json();
    const out = parseJson(d.choices?.[0]?.message?.content || '');
    return out.data ? out : { error: true, reason: 'bad_json' };
  } catch (e) { return { error: true, reason: e.name === 'AbortError' ? 'timeout' : 'network' }; }
  finally { clearTimeout(t); }
}

async function callGemini(apiKey, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal }
    );
    if (!res.ok) return { error: true, status: res.status, detail: (await res.text()).slice(0, 300) };
    const d = await res.json();
    const out = parseJson(d.candidates?.[0]?.content?.parts?.[0]?.text || '');
    return out.data ? out : { error: true, reason: 'bad_json' };
  } catch (e) { return { error: true, reason: e.name === 'AbortError' ? 'timeout' : 'network' }; }
  finally { clearTimeout(t); }
}

// Biến đống lý do hỏng thành MỘT câu đúng sự thật cho người dùng.
// Ưu tiên nguyên nhân cần hành động khác nhau: thiếu key > key sai > quá tải > chậm.
// `code` quyết định client có tự thử lại hay không: CHỈ 429 mới đáng thử lại, còn key sai
// hay model chết thì thử lại chỉ tổ bắt người dùng chờ thêm 5 giây rồi vẫn hỏng.
function explainFailure(fails, totalKeys) {
  if (!totalKeys) {
    return { code: 500, error: 'Chưa cấu hình API key cho AI (GROQ_API_KEY / GEMINI_API_KEY trên Vercel).' };
  }
  const has = (fn) => fails.some(fn);
  // Lỗi cần người sửa (không phải chờ) thì kèm luôn nhà cung cấp + mã lỗi, để biết đường
  // sửa chỗ nào mà không phải mở Vercel log. Chỉ có tên provider, số thứ tự key và status
  // — không có mẩu nào của key thật.
  const dbg = ' [' + fails.map(f => `${f.provider}#${f.key}=${f.status || f.reason}`).join(' ') + ']';
  if (has(f => f.status === 401 || f.status === 403)) {
    return { code: 502, error: 'API key của AI bị từ chối (sai hoặc đã thu hồi) — cần cấp lại key.' + dbg };
  }
  if (has(f => f.status === 404)) {
    return { code: 502, error: 'Model AI không còn tồn tại — cần cập nhật tên model.' + dbg };
  }
  if (has(f => f.status === 429)) {
    return { code: 429, error: 'Hết lượt gọi AI (rate limit). Đợi ~15 giây rồi thử lại.' };
  }
  if (fails.length && fails.every(f => f.reason === 'timeout')) {
    return { code: 504, error: 'AI phản hồi quá chậm (quá 10 giây). Thử lại, hoặc rút gọn câu tìm.' };
  }
  const st = fails.find(f => f.status)?.status;
  return { code: 502, error: st ? `AI trả lỗi ${st}. Thử lại sau ít phút.` : 'Không gọi được AI. Thử lại sau ít phút.' };
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
      // Cờ `banned` của Clerk chỉ chặn ĐĂNG NHẬP MỚI và không lộ ra ở frontend SDK, nên
      // trạng thái khoá còn được ghi kèm vào public_metadata.status để AuthGate đọc được.
      // Nhận cả hai nguồn: khoá tay từ Clerk Dashboard chỉ set `banned`.
      locked: !!u.banned || u.public_metadata?.status === 'locked',
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

  if (action === 'ban' || action === 'unban') {
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    // Tự khoá mình là đứt đường về: AuthGate sẽ chặn, mà chỉ admin mới mở khoá được.
    if (userId === callerId) return res.status(400).json({ error: 'Không thể tự khoá tài khoản của mình' });
    const lock = action === 'ban';

    const r = await fetch(`https://api.clerk.com/v1/users/${userId}/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${SECRET_KEY}` },
    });
    if (!r.ok) return res.status(502).json({ error: `Clerk ${action} lỗi`, detail: await r.text() });

    // Chỉ /ban là chưa đủ: nó chặn đăng nhập mới nhưng frontend không đọc được cờ đó,
    // nên phiên đang mở vẫn dùng app bình thường. status ở đây mới là thứ AuthGate chặn.
    // PATCH metadata là MERGE nên role/approved giữ nguyên.
    const m = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_metadata: { status: lock ? 'locked' : 'active' } }),
    });
    if (!m.ok) return res.status(502).json({ error: 'Cập nhật trạng thái lỗi', detail: await m.text() });
    return res.status(200).json({ ok: true, locked: lock });
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
