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

    const prompt = `Bạn là AI trích xuất thông tin phòng trọ từ tin nhắn Zalo tiếng Việt.
Trích xuất và trả về JSON với các trường sau:
- ma_toa: string (mã toà nhà, VD: F066)
- dia_chi: string (địa chỉ đầy đủ)
- quan: string (quận/huyện, phải là 1 trong: Đống Đa, Cầu Giấy, Nam Từ Liêm, Bắc Từ Liêm, Thanh Xuân, Hai Bà Trưng, Hoàng Mai, Hà Đông, Tây Hồ, Ba Đình, Hoàn Kiếm, Long Biên)
- khu_vuc: string (tên đường/khu vực)
- gia: number (giá phòng/tháng, đơn vị VNĐ. VD: "4tr5" = 4500000, "3.5 triệu" = 3500000)
- dien_tich: number (m², chỉ số)
- loai_phong: string (1 trong: "Phòng trọ", "CCMN", "Studio", "Chung cư", "Homestay")
- khep_kin: boolean (WC khép kín hay không)
- xe_dien: boolean (có chỗ sạc xe điện không)
- pet: boolean (có được nuôi thú cưng không)
- dien: string (giá điện, VD: "4.000đ/số")
- nuoc: string (giá nước)
- internet: string (giá/tình trạng internet)
- noi_that: string (danh sách nội thất)
- mo_ta: string (mô tả thêm)
- hoa_hong: string (thông tin hoa hồng CTV nếu có)
- confidence: object với key là tên trường và value là "high"/"medium"/"low" (chỉ cần cho: quan, gia, loai_phong, dien_tich)

Chỉ trả về JSON, không giải thích. Đây là tin nhắn:

${text}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'gemini_error', detail: errText });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'parse_fail', raw: content });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
