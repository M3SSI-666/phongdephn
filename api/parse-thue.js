export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Missing text' });

    const cleanText = text
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    const PROMPT = `Parse this Times City apartment rental message (Vietnamese). Return ONLY valid JSON, no markdown.

{"Ma_Can":"","Thiet_Ke":"","Dien_Tich":"","Huong_BC":"","Gia":"","Phi_MG":"","Noi_That":"","Slot_Xe":"Không","Thoi_Gian_Vao":"","Lien_He":""}

Rules:
- Ma_Can: apartment code from "Căn hộ:" or "Căn:" line (e.g. "P0112a11", "R6-1208"). Keep original format.
- Thiet_Ke: design/layout from "Thiết kế:" (e.g. "3PN", "2PN", "Studio"). Normalize "3n"→"3PN", "2n"→"2PN".
- Dien_Tich: area with unit from "Diện tích:" (e.g. "106m²", "75m²"). Normalize "106m"→"106m²".
- Huong_BC: balcony direction from "Hướng ban công:" (e.g. "Nam", "Đông Nam", "Tây Bắc").
- Gia + Phi_MG: parse from "Giá:" line together using these rules:
  • If price has "tv" or "thu về" → Gia="Xtr tv" (e.g. "14tr tv"), Phi_MG="" (empty — tv means net price, no broker fee)
  • If price has "pmg X" → Gia=price only (e.g. "15tr"), Phi_MG=the pmg value (e.g. "pmg 1/2"→"1/2", "pmg 10tr"→"10tr", "pmg 1 tháng"→"1 tháng")
  • If price has "phí đủ" → Gia=price only, Phi_MG="Phí đủ"
  • If price has "phí nửa" or "nửa tháng" → Gia=price only, Phi_MG="Nửa tháng"
  • If price has "1 tháng" (fee) → Gia=price only, Phi_MG="1 tháng"
  • If no fee info → Gia=full price text, Phi_MG=""
  Examples: "15tr pmg 1/2"→Gia="15tr",Phi_MG="1/2" | "14tr tv"→Gia="14tr tv",Phi_MG="" | "23tr phí đủ"→Gia="23tr",Phi_MG="Phí đủ"
- Noi_That: furniture/interior from "Hiện trạng:" line. "full đồ"→"Full nội thất", "đầy đủ"→"Full nội thất", "cơ bản"→"Cơ bản", "trống"→"Không nội thất", "không đồ"→"Không nội thất".
- Slot_Xe: "Có" if "slot xe", "có xe", "bãi xe" mentioned in "Hiện trạng:". Default "Không".
- Thoi_Gian_Vao: full content from "Thời gian vào:" line — keep everything after the colon including notes. Only normalize abbreviations: "lun"→"Luôn", "ngay"→"Ngay". Keep all additional context (e.g. "Luôn, ưu tiên nước ngoài", "Tháng 6/2025, có thể linh hoạt").
- Lien_He: contact phone/name from "Xem nhà lh:" or "Liên hệ:" line. Keep original format.

Message: ${cleanText}`;

    // Try Groq first (faster)
    const groqKeys = [];
    if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
    for (let i = 2; i <= 10; i++) {
      const v = process.env[`GROQ_API_KEY_${i}`];
      if (v) groqKeys.push(v);
    }

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
    for (let i = 2; i <= 10; i++) {
      const v = process.env[`GEMINI_API_KEY_${i}`];
      if (v) geminiKeys.push(v);
    }

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
    console.error('[parse-thue]', err.message);
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

function parseJson(content) {
  const block = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const str = block ? block[1].trim() : (content.match(/\{[\s\S]*\}/) || [''])[0];
  if (!str) return { error: true };
  try { return { data: JSON.parse(str) }; }
  catch { try { return { data: JSON.parse(str.replace(/,\s*}/g, '}').replace(/'/g, '"')) }; } catch { return { error: true }; } }
}
