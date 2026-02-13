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
{"ma_toa":"","dia_chi":"","quan":"","khu_vuc":"","gia":0,"dien_tich":0,"loai_phong":"","khep_kin":false,"xe_dien":false,"pet":false,"dien":"","nuoc":"","internet":"","noi_that":"","mo_ta":"","hoa_hong":"","confidence":{"quan":"low","gia":"low","loai_phong":"low","dien_tich":"low"}}
Rules: quan must be one of: Đống Đa,Cầu Giấy,Nam Từ Liêm,Bắc Từ Liêm,Thanh Xuân,Hai Bà Trưng,Hoàng Mai,Hà Đông,Tây Hồ,Ba Đình,Hoàn Kiếm,Long Biên. gia in VND (4tr5=4500000). loai_phong: Phòng trọ/CCMN/Studio/Chung cư/Homestay. confidence: high/medium/low.
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

    // Find JSON object in response
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

