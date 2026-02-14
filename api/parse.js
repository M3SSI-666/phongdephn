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
- khu_vuc: MUST be the phường/xã (ward) name where the address is located, NOT the street name. Use your knowledge of Hanoi geography to determine the correct ward. Examples: "244 Trịnh Đình Cửu, Hoàng Mai"→"Định Công" (because Trịnh Đình Cửu street is in Định Công ward), "Ngõ 158 Ngọc Hà, Ba Đình"→"Ngọc Hà" (Ngọc Hà is both street and ward), "55 Kim Mã, Ba Đình"→"Kim Mã" (Kim Mã is both street and ward), "Khương Trung, Thanh Xuân"→"Khương Trung", "Giải Phóng, Hoàng Mai"→"Giáp Bát" or "Phương Liệt" depending on exact number. If you cannot determine the ward, use the most prominent neighborhood/area name near the address. NEVER just copy the street name - always resolve to the actual phường/xã
- dia_chi: full specific address
- gia: price in VND (4tr5=4500000)
- loai_phong: Phòng trọ/CCMN/Studio/Chung cư/Homestay
- so_phong: room number if mentioned (e.g. "P401"→"401"), empty if not found
- gia_dien: MUST write full VND format with dot separators. Convert abbreviations: "4k"→"4.000 đ/số", "3k5"→"3.500 đ/số", "4000đ"→"4.000 đ/số". Always include unit like "đ/số" or "đ/người". Example: "4.000 đ/số". Empty if not mentioned.
- gia_nuoc: MUST write full VND format. Convert: "100k"→"100.000 đ/người", "80k/người"→"80.000 đ/người", "30k/số"→"30.000 đ/số". Always include unit. Example: "100.000 đ/người". Empty if not mentioned.
- gia_internet: MUST write full VND format. Convert: "50k"→"50.000 đ/người", "100k/phòng"→"100.000 đ/phòng". If free, write "Miễn phí". Example: "50.000 đ/phòng". Empty if not mentioned.
- dich_vu_chung: Format MUST be: price first, then parentheses listing included services. Convert price to full VND. Example: "200.000 đ (Vệ sinh, Thang máy, Điện hành lang)" or "150.000 đ (Vệ sinh, An ninh, Rác)". If no price found but services mentioned, just list services. Empty if not mentioned.
- noi_that: List ALL furnishings/equipment. Include shared amenities like máy giặt chung, máy sấy miễn phí, máy giặt. If original says "như hình" or "nội thất như hình", write "Nội thất như hình ảnh mô tả". Combine all furniture items into one string.
- ghi_chu: ONLY include info that TENANTS would care about. List POSITIVE things first, then NEGATIVE things. Positives examples: Giờ giấc tự do, Không chung chủ, Cho nuôi pet, Nhận xe điện, Nhận khách nước ngoài, Khóa vân tay, WC khép kín, Ban công. Negatives examples: Không nuôi pet, Không nhận khách nước ngoài, Chung chủ, Giờ giấc. DO NOT include: diện tích, hoa hồng, mã toà nhà, commission - these are NOT relevant to tenants. Keep concise, comma-separated.
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
