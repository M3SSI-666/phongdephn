export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const cleanQuery = query
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    const SEARCH_PROMPT = `You are a Hanoi room search assistant. Parse the user's natural language query into structured search filters. Return ONLY valid JSON, no markdown, no explanation.

Output format:
{"quan_huyen":[],"khu_vuc":[],"gia_max":0,"loai_phong":"","summary":""}

Rules:
- quan_huyen: array of matching districts. Must be from: Ba Đình, Bắc Từ Liêm, Cầu Giấy, Đống Đa, Hà Đông, Hai Bà Trưng, Hoàn Kiếm, Hoàng Mai, Long Biên, Nam Từ Liêm, Tây Hồ, Thanh Xuân, Ba Vì, Chương Mỹ, Đan Phượng, Đông Anh, Gia Lâm, Hoài Đức, Mê Linh, Mỹ Đức, Phú Xuyên, Phúc Thọ, Quốc Oai, Sóc Sơn, Sơn Tây, Thạch Thất, Thanh Oai, Thanh Trì, Thường Tín, Ứng Hòa
- khu_vuc: array of nearby wards/phường. Use your Hanoi geography knowledge to identify wards NEAR the mentioned location. Include 3-6 nearby wards. Examples:
  - "gần Đại học Bách Khoa" → ["Bách Khoa", "Lê Đại Hành", "Trương Định"], quận Hai Bà Trưng
  - "gần Hồ Tây" → ["Quảng An", "Nhật Tân", "Xuân La", "Bưởi", "Thụy Khuê"], quận Tây Hồ
  - "gần Cao đẳng Y Hà Nội" → ["Nguyên Hồng", "Láng Hạ", "Kim Mã", "Thành Công"], quận Ba Đình/Đống Đa
  - "khu Cầu Giấy" → ["Dịch Vọng", "Dịch Vọng Hậu", "Mai Dịch", "Quan Hoa", "Nghĩa Đô"], quận Cầu Giấy
  - "Vũ Tông Phan, Kim Giang" → ["Khương Đình", "Kim Giang", "Thanh Xuân Trung"], quận Thanh Xuân/Hoàng Mai
  - "gần ĐH Quốc Gia" → ["Dịch Vọng Hậu", "Mai Dịch", "Cổ Nhuế"], quận Cầu Giấy/Bắc Từ Liêm
  - "khu Mỹ Đình" → ["Mỹ Đình 1", "Mỹ Đình 2", "Cầu Diễn", "Phú Đô"], quận Nam Từ Liêm
- If user mentions specific khu_vuc/phường names directly, include them as-is in khu_vuc array
- gia_max: maximum price in VND. If user says "khoảng X triệu" or "tầm X triệu" or "X triệu", set gia_max = X * 1.1 (add 10% buffer). "3 triệu" → 3300000, "5tr" → 5500000, "4tr5" → 4950000. If no price mentioned, set to 0.
- loai_phong: one of "Phòng đơn", "Nguyên căn", "Homestay", "1 Ngủ 1 Khách", "2 Ngủ 1 Khách", "3 Ngủ 1 Khách". Empty string if not specified.
- summary: Vietnamese sentence summarizing what AI understood. E.g. "Tìm phòng gần ĐH Bách Khoa (Hai Bà Trưng), giá tối đa 3.3 triệu"

Important:
- "trường X", "gần X", "quanh X" → find wards NEAR that location
- If user mentions a street name, identify which phường it belongs to
- Always return arrays for quan_huyen and khu_vuc
- If query is too vague, return empty arrays and summary explaining

User query: ${cleanQuery}`;

    // Strategy: Groq first (fast + high quota), Gemini fallback
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      console.log('[Search] Trying Groq...');
      const groqResult = await callGroq(groqKey, SEARCH_PROMPT);
      if (groqResult.data) {
        console.log('[Search] Groq → SUCCESS');
        return res.status(200).json(postProcess(groqResult.data));
      }
      console.log(`[Search] Groq → failed: ${groqResult.errorDetail}`);
    }

    // Fallback to Gemini
    const geminiKeys = [];
    const mainKey = process.env.GEMINI_API_KEY;
    if (mainKey) geminiKeys.push(mainKey);
    for (let i = 2; i <= 10; i++) {
      const val = process.env[`GEMINI_API_KEY_${i}`];
      if (val) geminiKeys.push(val);
    }

    if (geminiKeys.length > 0) {
      const geminiBody = JSON.stringify({
        contents: [{ parts: [{ text: SEARCH_PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      });

      const startIdx = Math.floor(Math.random() * geminiKeys.length);
      for (let i = 0; i < geminiKeys.length; i++) {
        const idx = (startIdx + i) % geminiKeys.length;
        console.log(`[Search] Trying Gemini key ${idx + 1}...`);
        const result = await callGemini(geminiKeys[idx], geminiBody);
        if (result.data) {
          console.log(`[Search] Gemini key ${idx + 1} → SUCCESS`);
          return res.status(200).json(postProcess(result.data));
        }
      }
    }

    return res.status(429).json({
      error: 'Tất cả API đều rate limit. Đợi 15 giây rồi thử lại.',
    });
  } catch (err) {
    console.error(`[Search] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

function postProcess(data) {
  if (!Array.isArray(data.quan_huyen)) {
    data.quan_huyen = data.quan_huyen ? [data.quan_huyen] : [];
  }
  if (!Array.isArray(data.khu_vuc)) {
    data.khu_vuc = data.khu_vuc ? [data.khu_vuc] : [];
  }
  data.gia_max = Number(data.gia_max) || 0;
  data.loai_phong = data.loai_phong || '';
  data.summary = data.summary || '';
  return data;
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
          { role: 'system', content: 'You are a JSON extractor. Return ONLY valid JSON, no markdown, no explanation.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) return { rateLimited: true, errorDetail: '429 rate limited' };
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
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    jsonStr = codeBlock[1].trim();
  } else {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }

  if (!jsonStr) return { error: true, errorDetail: `No JSON found: ${content.slice(0, 100)}` };

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
