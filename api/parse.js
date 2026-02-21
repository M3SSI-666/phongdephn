export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    // Support multiple API keys: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
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
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/📰/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const prompt = `Extract room rental info from this Vietnamese Zalo message. Return ONLY a single-line compact JSON with these exact fields:
{"quan_huyen":"","khu_vuc":"","dia_chi":"","gia":0,"so_phong":"","gia_dien":"","gia_nuoc":"","gia_internet":"","dich_vu_chung":"","noi_that":"","ghi_chu":"","confidence":{"quan_huyen":"low","gia":"low","khu_vuc":"low"}}

Rules:
- quan_huyen: one of Ba Đình,Bắc Từ Liêm,Cầu Giấy,Đống Đa,Hà Đông,Hai Bà Trưng,Hoàn Kiếm,Hoàng Mai,Long Biên,Nam Từ Liêm,Tây Hồ,Thanh Xuân,Ba Vì,Chương Mỹ,Đan Phượng,Đông Anh,Gia Lâm,Hoài Đức,Mê Linh,Mỹ Đức,Phú Xuyên,Phúc Thọ,Quốc Oai,Sóc Sơn,Sơn Tây,Thạch Thất,Thanh Oai,Thanh Trì,Thường Tín,Ứng Hòa
- khu_vuc: MUST be the phường/xã (ward) name where the address is located, NOT the street name. Use your knowledge of Hanoi geography to determine the correct ward. Examples: "244 Trịnh Đình Cửu, Hoàng Mai"→"Định Công" (because Trịnh Đình Cửu street is in Định Công ward), "Ngõ 158 Ngọc Hà, Ba Đình"→"Ngọc Hà" (Ngọc Hà is both street and ward), "55 Kim Mã, Ba Đình"→"Kim Mã" (Kim Mã is both street and ward), "Khương Trung, Thanh Xuân"→"Khương Trung", "Giải Phóng, Hoàng Mai"→"Giáp Bát" or "Phương Liệt" depending on exact number. If you cannot determine the ward, use the most prominent neighborhood/area name near the address. NEVER just copy the street name - always resolve to the actual phường/xã
- dia_chi: full specific address
- gia: price in VND (4tr5=4500000, 4tr9=4900000, 3tr=3000000)
- so_phong: room number if mentioned (e.g. "P401"→"401", "Trục 02"→"Trục 02"), empty if not found
- gia_dien: MUST write full VND format with dot separators. Convert abbreviations: "4k"→"4.000 đ/số", "3k5"→"3.500 đ/số", "4000đ"→"4.000 đ/số", "4k/ số"→"4.000 đ/số". Always include unit like "đ/số" or "đ/người". Example: "4.000 đ/số". Empty if not mentioned.
- gia_nuoc: MUST write full VND format. Convert: "100k"→"100.000 đ/người", "80k/người"→"80.000 đ/người", "35k/ khối"→"35.000 đ/khối", "30k/số"→"30.000 đ/số". Always include unit. Example: "100.000 đ/người". Empty if not mentioned.
- gia_internet: MUST write full VND format. Convert: "50k"→"50.000 đ/người", "100k/phòng"→"100.000 đ/phòng", "net 100k/ phòng"→"100.000 đ/phòng". If free, write "Miễn phí". Example: "50.000 đ/phòng". Empty if not mentioned.
- dich_vu_chung: Format MUST be: price first, then parentheses listing included services. Convert price to full VND. Example: "200.000 đ (Vệ sinh, Thang máy, Điện hành lang)" or "150.000 đ/người". If no price found but services mentioned, just list services. Empty if not mentioned.
- noi_that: List ALL furnishings/equipment. ORDERING RULE: list private/in-room items FIRST (giường, tủ, bàn, ghế, tủ lạnh, điều hòa, nóng lạnh, kệ bếp, bếp từ...), then shared/communal items LAST (máy giặt chung, máy sấy, máy giặt chung miễn phí). If original says "như hình" or "nội thất như hình", write "Nội thất như hình ảnh mô tả". Combine all into one comma-separated string.
- ghi_chu: ONLY include info that TENANTS would care about. List POSITIVE things first, then NEGATIVE things. Positives examples: Giờ giấc tự do, Không chung chủ, Cho nuôi pet, Nhận xe điện, Nhận khách nước ngoài, Khóa vân tay, Vệ sinh khép kín, Ban công, Thang máy, Gửi xe miễn phí. Negatives examples: Không nuôi pet, Không nhận khách nước ngoài, Chung chủ, Giờ giấc. DO NOT include: diện tích, hoa hồng, mã toà nhà, commission - these are NOT relevant to tenants. Keep concise, comma-separated.
- confidence: high/medium/low

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanation.

Message: ${cleanText}`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Try each API key, rotate on 429
    for (let ki = 0; ki < keys.length; ki++) {
      const apiKey = keys[ki];

      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        let response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: requestBody,
              signal: controller.signal,
            }
          );
        } catch (fetchErr) {
          clearTimeout(timeout);
          if (attempt === 1) break; // try next key
          continue;
        } finally {
          clearTimeout(timeout);
        }

        // Rate limited → try next key
        if (response.status === 429) {
          break;
        }

        if (!response.ok) {
          const errText = await response.text();
          if (attempt === 1) {
            return res.status(500).json({ error: 'gemini_error', detail: errText.substring(0, 500) });
          }
          continue;
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Try to extract JSON - handle markdown code blocks too
        let jsonStr = '';
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        } else {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
        }

        if (!jsonStr) {
          if (attempt === 1) break; // try next key
          continue;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          return res.status(200).json(parsed);
        } catch (jsonErr) {
          try {
            const fixed = jsonStr
              .replace(/,\s*}/g, '}')
              .replace(/,\s*]/g, ']')
              .replace(/'/g, '"');
            const parsed = JSON.parse(fixed);
            return res.status(200).json(parsed);
          } catch {
            if (attempt === 1) break;
          }
        }
      }
    }

    // All keys exhausted
    return res.status(429).json({
      error: `Rate limit trên tất cả ${keys.length} API key. Thử lại sau 1 phút.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
