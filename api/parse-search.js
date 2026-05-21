export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: 'Missing query' });

    const PROMPT = `Parse this Vietnamese real estate search query and extract filter criteria. Return ONLY valid JSON, no markdown.

{"Thiet_Ke":null,"Slot_Xe":null,"Gia_Max":null,"Gia_Min":null,"Huong_BC":null,"Noi_That":null,"Toa":null}

Rules:
- Thiet_Ke: "1PN"|"2PN"|"3PN"|"4PN"|"Studio"|null. Detect: "2 ngủ"→"2PN", "2n"→"2PN", "3 phòng ngủ"→"3PN", "studio"→"Studio". null if not mentioned.
- Slot_Xe: "Có" if "có slot"/"slot xe"/"có xe"/"có chỗ xe". "Không" if "không slot"/"không xe". null if not mentioned.
- Gia_Max: max budget in triệu (million VND). Convert: "19tr"→19, "dưới 20 triệu"→20, "tài chính 19"→19, "4 tỷ"→4000, "tối đa 25tr"→25, "khoảng 20tr"→20. null if not mentioned.
- Gia_Min: min price in triệu. "từ 15tr"→15, "trên 18 triệu"→18. null if not mentioned.
- Huong_BC: "Bắc"|"Nam"|"Đông"|"Tây"|"Đông Nam"|"Đông Bắc"|"Tây Nam"|"Tây Bắc"|null. null if not mentioned.
- Noi_That: furniture keywords to search — e.g. "full đồ", "không đồ", "cơ bản", "trống", "nội thất". null if not mentioned.
- Toa: building code like "T04","P01","T18","P12". Detect from "tòa T04"→"T04", "tòa p1"→"P01", "T18"→"T18". Normalize: pad single digit ("p1"→"P01","t4"→"T04"). null if not mentioned.

Important: if the query doesn't clearly specify a criterion, leave it null. Don't guess.

Query: ${query}`;

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

    const geminiKeys = [];
    if (process.env.GEMINI_API_KEY) geminiKeys.push(process.env.GEMINI_API_KEY);
    for (let i = 2; i <= 10; i++) {
      const v = process.env[`GEMINI_API_KEY_${i}`];
      if (v) geminiKeys.push(v);
    }

    if (geminiKeys.length > 0) {
      const body = JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
      });
      const start = Math.floor(Math.random() * geminiKeys.length);
      for (let i = 0; i < geminiKeys.length; i++) {
        const idx = (start + i) % geminiKeys.length;
        const result = await callGemini(geminiKeys[idx], body);
        if (result.data) return res.status(200).json(result.data);
      }
    }

    return res.status(429).json({ error: 'Rate limit. Thử lại sau.' });
  } catch (err) {
    console.error('[parse-search]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function callGroq(apiKey, prompt) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
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
        temperature: 0.1, max_tokens: 256,
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
  const t = setTimeout(() => ctrl.abort(), 8000);
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
