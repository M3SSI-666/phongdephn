export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    // Support multiple API keys for rotation
    const keys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean);

    if (keys.length === 0) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Clean input: remove emojis and excessive whitespace
    const cleanText = text
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
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
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    // Use Flash-Lite: 15 RPM + 1000 RPD (vs Flash: 10 RPM + 250 RPD)
    const MODEL = 'gemini-2.5-flash-lite';

    // Try each API key, rotate on 429
    for (let ki = 0; ki < keys.length; ki++) {
      const apiKey = keys[ki];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
            signal: controller.signal,
          }
        );
      } catch (fetchErr) {
        clearTimeout(timeout);
        continue; // try next key
      } finally {
        clearTimeout(timeout);
      }

      // Rate limited → try next key
      if (response.status === 429) continue;

      if (!response.ok) {
        const errText = await response.text();
        // If not last key, try next
        if (ki < keys.length - 1) continue;
        return res.status(500).json({ error: 'gemini_error', detail: errText.substring(0, 500) });
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract JSON from response
      let jsonStr = '';
      const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) {
        jsonStr = codeBlock[1].trim();
      } else {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
      }

      if (!jsonStr) {
        if (ki < keys.length - 1) continue;
        return res.status(500).json({ error: 'parse_fail', raw: content.substring(0, 300) });
      }

      try {
        return res.status(200).json(JSON.parse(jsonStr));
      } catch {
        // Fix common JSON issues
        const fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/'/g, '"');
        try {
          return res.status(200).json(JSON.parse(fixed));
        } catch {
          if (ki < keys.length - 1) continue;
          return res.status(500).json({ error: 'json_fail', raw: jsonStr.substring(0, 300) });
        }
      }
    }

    return res.status(429).json({
      error: `Rate limit trên ${keys.length} API key. Thử lại sau 1 phút.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
