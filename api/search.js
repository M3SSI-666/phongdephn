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

    const SEARCH_PROMPT = `You are a Hanoi room search assistant. Parse the user's query into search filters. Return ONLY valid JSON.

Output: {"quan_huyen":[],"khu_vuc":[],"gia_max":0,"loai_phong":"","summary":""}

Districts: Ba Đình,Bắc Từ Liêm,Cầu Giấy,Đống Đa,Hà Đông,Hai Bà Trưng,Hoàn Kiếm,Hoàng Mai,Long Biên,Nam Từ Liêm,Tây Hồ,Thanh Xuân

=== HANOI LOCATION DATABASE (USE THIS, DO NOT GUESS) ===

UNIVERSITIES & COLLEGES:
- ĐH Bách Khoa HN → Hai Bà Trưng: Bách Khoa, Lê Đại Hành, Trương Định
- ĐH Xây Dựng HN → Hai Bà Trưng: Bách Khoa, Thanh Nhàn, Lê Đại Hành
- ĐH Kinh Tế Quốc Dân (NEU) → Hai Bà Trưng: Bách Khoa, Đồng Tâm, Lê Đại Hành
- ĐH Thăng Long → Hoàng Mai: Đại Kim, Kim Giang, Tân Mai, Linh Đàm. Giáp Thanh Xuân: Hạ Đình, Khương Đình
- ĐH Quốc Gia HN (Cầu Giấy campus) → Cầu Giấy: Dịch Vọng Hậu, Mai Dịch, Quan Hoa. Bắc Từ Liêm: Cổ Nhuế
- ĐH Sư Phạm HN → Cầu Giấy: Dịch Vọng, Dịch Vọng Hậu, Mai Dịch
- ĐH Giao Thông Vận Tải → Đống Đa: Láng Thượng, Ô Chợ Dừa, Trung Liệt
- ĐH Công Nghiệp HN → Bắc Từ Liêm: Minh Khai, Phú Diễn, Cổ Nhuế
- ĐH Ngoại Thương → Đống Đa: Láng Thượng, Chùa Bộc, Trung Liệt
- ĐH Y Hà Nội → Đống Đa: Trung Tự, Kim Liên, Phương Mai
- Cao đẳng Y Hà Nội → Đống Đa: Trung Tự, Kim Liên, Phương Mai. Ba Đình: Nguyên Hồng
- Học Viện Ngân Hàng → Đống Đa: Chùa Bộc, Quang Trung, Thịnh Quang
- Học Viện Nông Nghiệp → Gia Lâm: Trâu Quỳ, Đặng Xá. Long Biên: Thạch Bàn
- ĐH Thương Mại → Cầu Giấy: Mai Dịch, Dịch Vọng. Bắc Từ Liêm: Cổ Nhuế
- ĐH Hà Nội → Thanh Xuân: Nhân Chính, Thanh Xuân Bắc
- ĐH Mỏ Địa Chất → Bắc Từ Liêm: Đức Thắng, Cổ Nhuế, Phú Diễn
- ĐH Phenikaa → Hà Đông: Yên Nghĩa, Hà Cầu, Dương Nội
- ĐH FPT Hòa Lạc → Thạch Thất: Thạch Hòa
- ĐH Kiến Trúc HN → Thanh Xuân: Nhân Chính, Thanh Xuân Bắc, Kim Giang
- ĐH Văn Hóa → Cầu Giấy: Mai Dịch, Dịch Vọng
- ĐH Luật HN → Đống Đa: Ngã Tư Sở, Khương Thượng, Thịnh Quang
- ĐH Mở HN → Hai Bà Trưng: Bách Khoa, Thanh Nhàn

LANDMARKS & AREAS:
- Hồ Tây → Tây Hồ: Quảng An, Nhật Tân, Xuân La, Bưởi, Thụy Khuê
- Hồ Hoàn Kiếm → Hoàn Kiếm: Hàng Bài, Tràng Tiền, Hàng Trống
- Mỹ Đình → Nam Từ Liêm: Mỹ Đình 1, Mỹ Đình 2, Cầu Diễn, Phú Đô
- Times City → Hai Bà Trưng: Vĩnh Tuy, Mai Động, Minh Khai
- Royal City → Thanh Xuân: Thanh Xuân Trung, Nhân Chính, Thượng Đình
- Aeon Mall Long Biên → Long Biên: Cổ Linh, Long Biên, Phúc Đồng
- Aeon Mall Hà Đông → Hà Đông: Dương Nội, La Khê, Kiến Hưng
- Big C Thăng Long → Cầu Giấy: Dịch Vọng Hậu, Mai Dịch
- Bệnh Viện Bạch Mai → Đống Đa: Phương Mai, Trung Tự. Hai Bà Trưng: Bạch Mai
- Ngã Tư Sở → Đống Đa/Thanh Xuân: Khương Thượng, Thịnh Quang, Thượng Đình
- Cầu Giấy (area) → Cầu Giấy: Dịch Vọng, Dịch Vọng Hậu, Mai Dịch, Quan Hoa, Nghĩa Đô, Nghĩa Tân

STREETS → WARDS:
- Vũ Tông Phan → Thanh Xuân: Khương Đình. Hoàng Mai: Kim Giang
- Kim Giang → Thanh Xuân: Kim Giang, Hạ Đình. Hoàng Mai: Đại Kim
- Giải Phóng → Đống Đa: Phương Mai, Phương Liệt. Thanh Xuân: Phương Liệt
- Trường Chinh → Đống Đa: Khương Thượng, Phương Mai. Thanh Xuân: Phương Liệt
- Láng Hạ → Ba Đình: Láng Hạ, Thành Công. Đống Đa: Láng Hạ
- Nguyễn Trãi → Thanh Xuân: Thượng Đình, Nhân Chính. Hà Đông: Mỗ Lao, Văn Quán
- Lê Văn Lương → Thanh Xuân: Nhân Chính. Nam Từ Liêm: Trung Văn
- Nguyễn Xiển → Thanh Xuân: Hạ Đình. Hoàng Mai: Đại Kim, Tân Triều
- Minh Khai → Hai Bà Trưng: Minh Khai, Vĩnh Tuy

=== END DATABASE ===

Rules:
- quan_huyen: array of districts from the database above
- khu_vuc: array of wards/phường. MUST use the database above. Include wards from neighboring districts if location is near border.
- gia_max: price in VND. "khoảng/tầm X triệu" → X * 1.1 (add 10%). "3tr" → 3300000, "5tr" → 5500000, "4tr5" → 4950000. 0 if no price.
- loai_phong: "Phòng đơn"/"Nguyên căn"/"Homestay"/"1 Ngủ 1 Khách"/"2 Ngủ 1 Khách"/"3 Ngủ 1 Khách". Empty if not specified.
- summary: Vietnamese summary of what was understood.
- If user mentions specific phường/khu vực names, include them directly.
- If location not in database, use your best knowledge but prefer nearby wards from database entries.

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
