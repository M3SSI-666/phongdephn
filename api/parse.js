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

    const prompt = `Trích xuất thông tin phòng trọ từ tin nhắn Zalo. Trả về JSON gồm:
ma_toa(string), dia_chi(string), quan(string, 1 trong: Đống Đa/Cầu Giấy/Nam Từ Liêm/Bắc Từ Liêm/Thanh Xuân/Hai Bà Trưng/Hoàng Mai/Hà Đông/Tây Hồ/Ba Đình/Hoàn Kiếm/Long Biên), khu_vuc(string), gia(number VNĐ, 4tr5=4500000), dien_tich(number m2), loai_phong(string: Phòng trọ/CCMN/Studio/Chung cư/Homestay), khep_kin(bool), xe_dien(bool), pet(bool), dien(string), nuoc(string), internet(string), noi_that(string), mo_ta(string), hoa_hong(string), confidence(object: quan/gia/loai_phong/dien_tich -> high/medium/low)

Tin nhắn: ${text}`;

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );

        if (response.status === 429) {
          lastError = `Rate limit on ${model}`;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model} error: ${errText}`;
          continue;
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return res.status(500).json({ error: 'parse_fail', raw: content });
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json(parsed);
      } catch (modelErr) {
        lastError = `${model}: ${modelErr.message}`;
        continue;
      }
    }

    return res.status(429).json({
      error: 'Gemini API rate limit. Vui lòng thử lại sau 1 phút.',
      detail: lastError,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
