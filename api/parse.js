export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const cleanText = text
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    const PROMPT = `Extract room rental info from this Vietnamese Zalo message. Return ONLY valid JSON, no markdown, no explanation.

{"quan_huyen":"","khu_vuc":"","dia_chi":"","gia":0,"so_phong":"","gia_dien":"","gia_nuoc":"","gia_internet":"","dich_vu_chung":"","noi_that":"","ghi_chu":"","confidence":{"quan_huyen":"low","gia":"low","khu_vuc":"low"}}

Rules:
- quan_huyen: one of Ba Đình,Bắc Từ Liêm,Cầu Giấy,Đống Đa,Hà Đông,Hai Bà Trưng,Hoàn Kiếm,Hoàng Mai,Long Biên,Nam Từ Liêm,Tây Hồ,Thanh Xuân,Ba Vì,Chương Mỹ,Đan Phượng,Đông Anh,Gia Lâm,Hoài Đức,Mê Linh,Mỹ Đức,Phú Xuyên,Phúc Thọ,Quốc Oai,Sóc Sơn,Sơn Tây,Thạch Thất,Thanh Oai,Thanh Trì,Thường Tín,Ứng Hòa
- khu_vuc: MUST be phường/xã (ward), NOT street name. Use Hanoi geography knowledge. "Ngõ 296 Minh Khai, HBT"→"Minh Khai", "244 Trịnh Đình Cửu, Hoàng Mai"→"Định Công", "55 Kim Mã, Ba Đình"→"Kim Mã"
- dia_chi: full address
- gia: VND number (4tr5=4500000, 4tr9=4900000, 3tr=3000000)
- so_phong: room number if mentioned, empty if not
- gia_dien: full VND format. "4k"→"4.000 đ/số", "3k5"→"3.500 đ/số". Always include unit. Empty if not mentioned.
- gia_nuoc: full VND format. "100k"→"100.000 đ/người", "35k/khối"→"35.000 đ/khối". Always include unit. Empty if not mentioned.
- gia_internet: full VND format. "100k/phòng"→"100.000 đ/phòng". "Miễn phí" if free. Empty if not mentioned.
- dich_vu_chung: price + services in parentheses. "150k (Vệ sinh, Thang máy)". Empty if not mentioned.
- noi_that: list all furnishings, private items first, shared items last. Comma-separated.
- ghi_chu: tenant-relevant info ONLY. Positives first (Thang máy, Vệ sinh khép kín, Gửi xe miễn phí, Giờ giấc tự do), then negatives. NO hoa hồng, mã toà nhà, commission. Comma-separated.
- confidence: high/medium/low

Message: ${cleanText}`;

    // Strategy: Try Groq first (fast + high quota), fallback to Gemini
    // Groq free: 30 RPM, 1000+ RPD per account
    // Gemini free: 5 RPM, 20 RPD per account

    // 1. Try Groq keys (rotate through all available)
    const groqKeys = [];
    if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
    for (let i = 2; i <= 10; i++) {
      const val = process.env[`GROQ_API_KEY_${i}`];
      if (val) groqKeys.push(val);
    }

    if (groqKeys.length > 0) {
      const startIdx = Math.floor(Math.random() * groqKeys.length);
      for (let i = 0; i < groqKeys.length; i++) {
        const idx = (startIdx + i) % groqKeys.length;
        console.log(`[Parse] Trying Groq key ${idx + 1}/${groqKeys.length}...`);
        const groqResult = await callGroq(groqKeys[idx], PROMPT);
        if (groqResult.data) {
          console.log(`[Parse] Groq key ${idx + 1} → SUCCESS`);
          return res.status(200).json(groqResult.data);
        }
        console.log(`[Parse] Groq key ${idx + 1} → ${groqResult.rateLimited ? '429' : 'failed'}: ${groqResult.errorDetail}`);
      }
    }

    // 2. Fallback to Gemini
    const geminiKeys = [];
    const mainKey = process.env.GEMINI_API_KEY;
    if (mainKey) geminiKeys.push(mainKey);
    for (let i = 2; i <= 10; i++) {
      const val = process.env[`GEMINI_API_KEY_${i}`];
      if (val) geminiKeys.push(val);
    }

    if (geminiKeys.length > 0) {
      const geminiBody = JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      });

      const startIdx = Math.floor(Math.random() * geminiKeys.length);
      for (let i = 0; i < geminiKeys.length; i++) {
        const idx = (startIdx + i) % geminiKeys.length;
        console.log(`[Parse] Trying Gemini key ${idx + 1}...`);
        const result = await callGemini(geminiKeys[idx], geminiBody);
        if (result.data) {
          console.log(`[Parse] Gemini key ${idx + 1} → SUCCESS`);
          return res.status(200).json(result.data);
        }
        console.log(`[Parse] Gemini key ${idx + 1} → ${result.rateLimited ? '429' : 'error'}`);
      }
    }

    // All providers failed
    return res.status(429).json({
      error: 'Tất cả API đều rate limit. Đợi 15 giây rồi thử lại.',
    });
  } catch (err) {
    console.error(`[Parse] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ============ GROQ ============
async function callGroq(apiKey, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a JSON extractor. Return ONLY valid JSON, no markdown, no explanation.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      return { rateLimited: true, errorDetail: '429 rate limited' };
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { error: true, errorDetail: `HTTP ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) return { error: true, errorDetail: 'Empty response' };

    return parseJsonResponse(content);
  } catch (e) {
    return { error: true, errorDetail: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

// ============ GEMINI ============
async function callGemini(apiKey, requestBody) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      }
    );

    if (response.status === 429) return { rateLimited: true };
    if (!response.ok) return { error: true, errorDetail: `HTTP ${response.status}` };

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!content) return { error: true, errorDetail: 'Empty response' };

    return parseJsonResponse(content);
  } catch (e) {
    return { error: true, errorDetail: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

// ============ JSON Parser ============
function parseJsonResponse(content) {
  let jsonStr = '';

  // Try code block first
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    jsonStr = codeBlock[1].trim();
  } else {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }

  if (!jsonStr) {
    return { error: true, errorDetail: `No JSON found: ${content.slice(0, 100)}` };
  }

  try {
    return { data: JSON.parse(jsonStr) };
  } catch {
    const fixed = jsonStr
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/'/g, '"');
    try {
      return { data: JSON.parse(fixed) };
    } catch {
      return { error: true, errorDetail: 'JSON parse failed' };
    }
  }
}
