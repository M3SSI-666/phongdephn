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

    const PROMPT = `Parse this Times City apartment FOR SALE message (Vietnamese). Return ONLY valid JSON, no markdown.

{"Ma_Can":"","Thiet_Ke":"","Dien_Tich":"","Huong_BC":"","Gia":"","Phi":"Thu về","Noi_That":"","Slot_Xe":"Không","SDT":"","Ten_Chu":""}

Rules:
- Ma_Can: apartment code from "Căn hộ:" or "Căn:" line (e.g. "P0112a11", "R6-1208"). Keep original format, uppercase all letters.
- Thiet_Ke: design/layout (e.g. "3PN", "2PN", "Studio"). Normalize "3n"→"3PN", "2n"→"2PN".
- Dien_Tich: area with unit (e.g. "106m²", "75m²"). Normalize "106m"→"106m²".
- Huong_BC: balcony direction (e.g. "Nam", "Đông Nam", "Tây Bắc").
- Gia + Phi: parse from "Giá:" line together:
  • If price contains "bao phí" or "phí đủ" or "bao fee" → Gia=price without fee text, Phi="Bao phí"
  • If price contains "pmg X" → Gia=price only, Phi=the pmg value (e.g. "pmg 1 tháng"→"1 tháng")
  • Otherwise → Gia=full price text, Phi="Thu về"
  Examples: "5.5 tỷ bao phí"→Gia="5.5 tỷ",Phi="Bao phí" | "4.2 tỷ"→Gia="4.2 tỷ",Phi="Thu về" | "3.8 tỷ pmg 1 tháng"→Gia="3.8 tỷ",Phi="1 tháng"
- Noi_That: content from "Hiện trạng:" or "Nội thất:" line — keep original text BUT remove any slot/parking mentions. Only keep furniture/interior description.
- Slot_Xe: detect from entire message. "có slot"/"slot xe"/"có xe"/"bãi xe" → "Có". "không slot"/"không có xe"/"không xe" → "Không". Default "Không".
- SDT: phone number of owner/contact from "Liên hệ:", "SĐT:", "Tel:" or "Xem nhà lh:" line.
- Ten_Chu: owner/contact name if mentioned alongside the phone number.

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
    console.error('[parse-ban]', err.message);
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
