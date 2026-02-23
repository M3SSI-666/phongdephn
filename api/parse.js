export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    // Collect all API keys
    const keys = [];
    const keyNames = [];
    const mainKey = process.env.GEMINI_API_KEY;
    if (mainKey) {
      keys.push(mainKey);
      keyNames.push('KEY_1');
    }
    for (let i = 2; i <= 10; i++) {
      const val = process.env[`GEMINI_API_KEY_${i}`];
      if (val) {
        keys.push(val);
        keyNames.push(`KEY_${i}`);
      }
    }

    console.log(`[Parse] ${keys.length} keys available`);

    if (keys.length === 0) {
      return res.status(500).json({ error: 'No Gemini API keys configured' });
    }

    const cleanText = text
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    const prompt = `Extract room rental info from this Vietnamese Zalo message. Return ONLY valid JSON, no markdown, no explanation.

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

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });

    const MODEL = 'gemini-2.5-flash';

    // Simple: try all keys from random start, no dead key tracking, no long waits
    const startIdx = Math.floor(Math.random() * keys.length);

    for (let i = 0; i < keys.length; i++) {
      const idx = (startIdx + i) % keys.length;
      console.log(`[Parse] Trying ${keyNames[idx]}...`);
      const result = await callGemini(keys[idx], MODEL, requestBody);

      if (result.data) {
        console.log(`[Parse] ${keyNames[idx]} → SUCCESS`);
        return res.status(200).json(result.data);
      }
      if (result.rateLimited) {
        console.log(`[Parse] ${keyNames[idx]} → 429`);
      }
      if (result.error) {
        console.log(`[Parse] ${keyNames[idx]} → error: ${result.errorDetail}`);
      }
    }

    // All failed — return immediately, let frontend handle retry
    return res.status(429).json({
      error: `Gemini rate limit. Đợi 15 giây rồi thử lại.`,
    });
  } catch (err) {
    console.error(`[Parse] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

async function callGemini(apiKey, model, requestBody) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      }
    );

    if (response.status === 429) return { rateLimited: true };
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { error: true, errorDetail: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!content) return { error: true, errorDetail: 'Empty response' };

    let jsonStr = '';
    const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      jsonStr = codeBlock[1].trim();
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    if (!jsonStr) return { error: true, errorDetail: 'No JSON in response' };

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
  } catch (e) {
    return { error: true, errorDetail: e.message };
  } finally {
    clearTimeout(timeout);
  }
}
