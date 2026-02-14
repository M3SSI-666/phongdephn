export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const prompt = `Extract room rental info from this Vietnamese Zalo message. Return ONLY a single-line compact JSON with these exact fields:
{"quan_huyen":"","khu_vuc":"","dia_chi":"","gia":0,"loai_phong":"","so_phong":"","gia_dien":"","gia_nuoc":"","gia_internet":"","dich_vu_chung":"","noi_that":"","ghi_chu":"","confidence":{"quan_huyen":"low","gia":"low","loai_phong":"low","khu_vuc":"low"}}

Rules:
- quan_huyen: one of Ba Đình,Bắc Từ Liêm,Cầu Giấy,Đống Đa,Hà Đông,Hai Bà Trưng,Hoàn Kiếm,Hoàng Mai,Long Biên,Nam Từ Liêm,Tây Hồ,Thanh Xuân,Ba Vì,Chương Mỹ,Đan Phượng,Đông Anh,Gia Lâm,Hoài Đức,Mê Linh,Mỹ Đức,Phú Xuyên,Phúc Thọ,Quốc Oai,Sóc Sơn,Sơn Tây,Thạch Thất,Thanh Oai,Thanh Trì,Thường Tín,Ứng Hòa
- khu_vuc: extract street/neighborhood name from address using Hanoi geography (e.g. "Ngõ 158 Ngọc Hà"→"Ngọc Hà", "Kim Mã"→"Kim Mã", "Khương Trung"→"Khương Trung")
- dia_chi: full specific address
- gia: price in VND (4tr5=4500000)
- loai_phong: Phòng trọ/CCMN/Studio/Chung cư/Homestay
- so_phong: room number if mentioned (e.g. "P401"→"401"), empty if not found
- gia_dien/gia_nuoc/gia_internet: as text, empty if not mentioned
- dich_vu_chung: common service fee if mentioned
- noi_that: list of furnishings
- ghi_chu: aggregate ALL remaining info here: khép kín (yes/no), diện tích (m2), xe điện, pet, hoa hồng/commission, mã toà nhà, and any other details
- confidence: high/medium/low

Message: ${text}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (response.status === 429) {
      return res.status(429).json({ error: 'Gemini rate limit. Thử lại sau 1 phút.' });
    }

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'gemini_error', detail: errText });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'parse_fail', raw: content.substring(0, 500) });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
