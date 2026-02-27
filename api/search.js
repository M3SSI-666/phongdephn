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

    const PROMPT = `Bạn là trợ lý tìm phòng trọ tại Hà Nội. Nhiệm vụ: phân tích yêu cầu tìm phòng và trả về danh sách khu vực (phường/xã) phù hợp.

Return ONLY valid JSON, no markdown, no explanation.

RULES:
1. Xác định khu vực (phường/xã) mà khách đề cập
2. Nếu khách nói tên trường/bệnh viện/landmark → xác định thuộc quận nào, phường nào
3. Tìm thêm 5-10 phường LÂN CẬN trong cùng quận hoặc giáp ranh quận
4. Trả JSON: { "quan_huyen": [...], "khu_vuc": [...], "summary": "..." }
5. khu_vuc phải là tên PHƯỜNG/XÃ chính thức tại Hà Nội (VD: "Trương Định", "Tân Mai", KHÔNG phải tên đường)
6. summary: 1 câu tiếng Việt ngắn gọn tóm tắt kết quả tìm kiếm
7. Nếu khách chỉ nói tên quận (VD: "phòng Đống Đa", "khu vực Hoàng Mai") → liệt kê TẤT CẢ phường thuộc quận đó
8. quan_huyen PHẢI thuộc danh sách: Ba Đình, Bắc Từ Liêm, Cầu Giấy, Đống Đa, Hà Đông, Hai Bà Trưng, Hoàn Kiếm, Hoàng Mai, Long Biên, Nam Từ Liêm, Tây Hồ, Thanh Xuân, Thanh Trì, Đông Anh, Gia Lâm, Hoài Đức

VÍ DỤ:
Input: "Phòng khu vực Trương Định, Hoàng Mai"
Output: {"quan_huyen":["Hoàng Mai"],"khu_vuc":["Trương Định","Tân Mai","Giáp Bát","Tương Mai","Hoàng Văn Thụ","Thịnh Liệt","Đại Kim"],"summary":"Tìm phòng khu vực Trương Định và các phường lân cận tại Hoàng Mai"}

Input: "Phòng gần ĐH Bách Khoa"
Output: {"quan_huyen":["Hai Bà Trưng","Hoàng Mai"],"khu_vuc":["Bách Khoa","Lê Đại Hành","Trương Định","Phạm Đình Hổ","Thanh Nhàn","Đồng Nhân","Minh Khai","Tân Mai"],"summary":"Tìm phòng quanh ĐH Bách Khoa Hà Nội (Bách Khoa, Hai Bà Trưng) và khu vực lân cận"}

Input: "Phòng Đống Đa"
Output: {"quan_huyen":["Đống Đa"],"khu_vuc":["Láng Thượng","Láng Hạ","Ô Chợ Dừa","Trung Liệt","Kim Liên","Phương Mai","Chùa Bộc","Thịnh Quang","Khương Thượng","Trung Tự","Nam Đồng","Quang Trung","Hàng Bột","Cát Linh","Văn Chương","Văn Miếu","Khâm Thiên","Phương Liên","Ngã Tư Sở","Thổ Quan"],"summary":"Tìm phòng tất cả các phường thuộc quận Đống Đa"}

Input: "Tìm phòng quanh ĐH Thăng Long"
Output: {"quan_huyen":["Hoàng Mai","Thanh Xuân"],"khu_vuc":["Đại Kim","Kim Giang","Tân Mai","Thịnh Liệt","Hoàng Liệt","Hạ Đình","Khương Đình","Thanh Xuân Trung"],"summary":"Tìm phòng quanh ĐH Thăng Long (Đại Kim, Hoàng Mai) và khu vực lân cận"}

Input: "Phòng gần trường Khoa học tự nhiên Hà Nội"
Output: {"quan_huyen":["Thanh Xuân","Đống Đa"],"khu_vuc":["Thanh Xuân Bắc","Thanh Xuân Nam","Thanh Xuân Trung","Khương Mai","Hạ Đình","Kim Giang","Phương Liên","Khương Thượng","Ngã Tư Sở"],"summary":"Tìm phòng quanh ĐH Khoa học Tự nhiên (Thanh Xuân Bắc, Thanh Xuân) và khu vực lân cận"}

Yêu cầu tìm kiếm: ${cleanQuery}`;

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
        console.log(`[Search] Trying Groq key ${idx + 1}/${groqKeys.length}...`);
        const result = await callGroq(groqKeys[idx], PROMPT);
        if (result.data) {
          console.log(`[Search] Groq key ${idx + 1} → SUCCESS`);
          return res.status(200).json(postProcess(result.data));
        }
        console.log(`[Search] Groq key ${idx + 1} → ${result.rateLimited ? '429' : 'failed'}: ${result.errorDetail}`);
      }
    }

    // 2. Fallback to Gemini
    const geminiKeys = [];
    if (process.env.GEMINI_API_KEY) geminiKeys.push(process.env.GEMINI_API_KEY);
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
        console.log(`[Search] Trying Gemini key ${idx + 1}...`);
        const result = await callGemini(geminiKeys[idx], geminiBody);
        if (result.data) {
          console.log(`[Search] Gemini key ${idx + 1} → SUCCESS`);
          return res.status(200).json(postProcess(result.data));
        }
        console.log(`[Search] Gemini key ${idx + 1} → ${result.rateLimited ? '429' : 'error'}`);
      }
    }

    return res.status(429).json({
      error: 'Tất cả API đều rate limit. Đợi vài giây rồi thử lại.',
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
          {
            role: 'system',
            content: 'You are a Hanoi geography expert. Return ONLY valid JSON, no markdown, no explanation.',
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
