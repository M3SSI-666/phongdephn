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

    const PROMPT = `Bạn là trợ lý tìm phòng trọ tại Hà Nội với kiến thức địa lý CỰC KỲ chi tiết. Nhiệm vụ: phân tích yêu cầu tìm phòng → trả về danh sách khu vực (phường/xã) phù hợp.

Return ONLY valid JSON, no markdown, no explanation.

=== QUY TẮC ===
1. Xác định khu vực (phường/xã) mà khách đề cập
2. Nếu khách nói tên trường/bệnh viện/landmark/đường → TRA CỨU TRONG DATABASE DƯỚI ĐÂY
3. Tìm thêm 5-10 phường LÂN CẬN trong cùng quận hoặc giáp ranh quận
4. Trả JSON: { "quan_huyen": [...], "khu_vuc": [...], "summary": "..." }
5. khu_vuc = tên PHƯỜNG/XÃ chính thức (KHÔNG phải tên đường)
6. Nếu khách chỉ nói tên quận → liệt kê TẤT CẢ phường thuộc quận đó
7. Nếu đường/địa điểm đi qua NHIỀU quận → bao gồm phường ở TẤT CẢ các quận đó

=== DANH SÁCH PHƯỜNG THEO QUẬN (SỬ DỤNG CHÍNH XÁC, KHÔNG ĐƯỢC THÊM BỚT) ===

Hoàng Mai: Hoàng Liệt, Đại Kim, Định Công, Giáp Bát, Hoàng Văn Thụ, Lĩnh Nam, Mai Động, Tân Mai, Thanh Trì, Thịnh Liệt, Trương Định, Tương Mai, Vĩnh Hưng, Yên Sở
Thanh Xuân: Hạ Đình, Khương Đình, Khương Mai, Khương Trung, Kim Giang, Nhân Chính, Phương Liệt, Thanh Xuân Bắc, Thanh Xuân Nam, Thanh Xuân Trung, Thượng Đình
Đống Đa: Cát Linh, Chùa Bộc, Hàng Bột, Khâm Thiên, Khương Thượng, Kim Liên, Láng Hạ, Láng Thượng, Nam Đồng, Ngã Tư Sở, Ô Chợ Dừa, Phương Liên, Phương Mai, Quang Trung, Thịnh Quang, Thổ Quan, Trung Liệt, Trung Phụng, Trung Tự, Văn Chương, Văn Miếu
Hai Bà Trưng: Bách Khoa, Bạch Đằng, Bạch Mai, Cầu Dền, Đống Mác, Đồng Nhân, Đồng Tâm, Lê Đại Hành, Minh Khai, Ngô Thì Nhậm, Nguyễn Du, Phạm Đình Hổ, Phố Huế, Quỳnh Lôi, Quỳnh Mai, Thanh Lương, Thanh Nhàn, Trương Định, Vĩnh Tuy
Cầu Giấy: Dịch Vọng, Dịch Vọng Hậu, Mai Dịch, Nghĩa Đô, Nghĩa Tân, Quan Hoa, Trung Hòa, Yên Hòa
Ba Đình: Cống Vị, Điện Biên, Đội Cấn, Giảng Võ, Kim Mã, Liễu Giai, Ngọc Hà, Ngọc Khánh, Nguyễn Trung Trực, Phúc Xá, Quán Thánh, Thành Công, Trúc Bạch, Vĩnh Phúc
Hà Đông: Biên Giang, Dương Nội, Đồng Mai, Hà Cầu, Kiến Hưng, La Khê, Mỗ Lao, Nguyễn Trãi, Phú La, Phú Lãm, Phú Lương, Phúc La, Quang Trung, Vạn Phúc, Văn Quán, Yên Nghĩa, Yết Kiêu
Long Biên: Bồ Đề, Cự Khối, Đức Giang, Giang Biên, Gia Thụy, Long Biên, Ngọc Lâm, Ngọc Thụy, Phúc Đồng, Phúc Lợi, Sài Đồng, Thạch Bàn, Thượng Thanh, Việt Hưng
Tây Hồ: Bưởi, Nhật Tân, Phú Thượng, Quảng An, Thụy Khuê, Tứ Liên, Xuân La, Yên Phụ
Nam Từ Liêm: Cầu Diễn, Đại Mỗ, Mễ Trì, Mỹ Đình 1, Mỹ Đình 2, Phú Đô, Phương Canh, Tây Mỗ, Trung Văn, Xuân Phương
Bắc Từ Liêm: Cổ Nhuế 1, Cổ Nhuế 2, Đông Ngạc, Đức Thắng, Liên Mạc, Minh Khai, Phú Diễn, Phúc Diễn, Tây Tựu, Thượng Cát, Thụy Phương, Xuân Đỉnh, Xuân Tảo
Hoàn Kiếm: Chương Dương, Cửa Đông, Cửa Nam, Đồng Xuân, Hàng Bạc, Hàng Bài, Hàng Bồ, Hàng Buồm, Hàng Đào, Hàng Gai, Hàng Mã, Hàng Trống, Lý Thái Tổ, Phan Chu Trinh, Phúc Tân, Trần Hưng Đạo, Tráng Tiền
Thanh Trì: Đại Áng, Đông Mỹ, Duyên Hà, Hữu Hòa, Liên Ninh, Ngọc Hồi, Ngũ Hiệp, Tả Thanh Oai, Tam Hiệp, Tân Triều, Thanh Liệt, Tứ Hiệp, Vạn Phúc, Vĩnh Quỳnh, Yên Mỹ

=== ĐƯỜNG LỚN ĐI QUA NHIỀU QUẬN (QUAN TRỌNG!) ===

Đường Nguyễn Trãi: Thanh Xuân (Thanh Xuân Trung, Thanh Xuân Bắc, Thượng Đình, Nhân Chính, Khương Mai) → Hà Đông (Nguyễn Trãi, Văn Quán, Mỗ Lao, Phúc La, Quang Trung)
Đường Giải Phóng: Đống Đa (Phương Mai, Kim Liên) → Hai Bà Trưng (Phạm Đình Hổ, Đồng Tâm) → Hoàng Mai (Giáp Bát, Tương Mai, Thịnh Liệt)
Đường Minh Khai: Hai Bà Trưng (Minh Khai, Thanh Lương, Vĩnh Tuy) → Hoàng Mai (Mai Động, Tân Mai)
Đường Láng: Đống Đa (Láng Thượng, Láng Hạ) → Cầu Giấy (giáp Dịch Vọng, Quan Hoa)
Đường Trường Chinh: Đống Đa (Khương Thượng, Phương Mai) → Thanh Xuân (Khương Mai, Phương Liệt) → Hoàng Mai (giáp Giáp Bát)
Đường Lê Trọng Tấn: Thanh Xuân (Khương Mai) → Hà Đông (La Khê, Dương Nội, Phú Lãm)
Đường Kim Giang: Thanh Xuân (Kim Giang) → Hoàng Mai (Đại Kim) → Thanh Trì (Thanh Liệt)
Đường Nguyễn Xiển: Thanh Xuân (Hạ Đình) → Hoàng Mai (Đại Kim) → Thanh Trì (Tân Triều)
Đường Tố Hữu/Lê Văn Lương kéo dài: Thanh Xuân (Nhân Chính) → Hà Đông (La Khê, Phú La)
Đường Lê Văn Lương: Thanh Xuân (Nhân Chính, Thượng Đình) → Cầu Giấy (Trung Hòa)
Đường Cầu Giấy: Cầu Giấy (Quan Hoa, Dịch Vọng) → Ba Đình (giáp Ngọc Khánh)
Đường Hoàng Quốc Việt: Cầu Giấy (Nghĩa Đô, Nghĩa Tân) → Bắc Từ Liêm (Cổ Nhuế 1, Cổ Nhuế 2)
Đường Xuân Thủy - Cầu Giấy: Cầu Giấy (Dịch Vọng Hậu, Quan Hoa, Dịch Vọng)
Đường Phạm Hùng: Nam Từ Liêm (Mễ Trì, Mỹ Đình 1, Mỹ Đình 2) → Cầu Giấy (giáp Mai Dịch)
Đường Phạm Văn Đồng: Bắc Từ Liêm (Cổ Nhuế 1, Xuân Đỉnh) → Cầu Giấy (Mai Dịch)
Đường Ngọc Hồi: Hoàng Mai (Hoàng Liệt) → Thanh Trì (Ngọc Hồi, Tứ Hiệp)
Đường Tam Trinh: Hoàng Mai (Mai Động, Tân Mai, Hoàng Văn Thụ, Yên Sở, Lĩnh Nam)
Đường Vũ Tông Phan: Thanh Xuân (Kim Giang, Khương Đình) → Hoàng Mai (giáp Đại Kim)
Đường Định Công: Hoàng Mai (Định Công, Đại Kim, Thịnh Liệt)
Đường Trịnh Đình Cửu: Hoàng Mai (Định Công, Đại Kim)

=== TRƯỜNG ĐẠI HỌC / CAO ĐẲNG ===

ĐH Bách Khoa HN → Hai Bà Trưng: Bách Khoa. Lân cận: Lê Đại Hành, Trương Định(HBT), Phạm Đình Hổ, Thanh Nhàn, Đồng Tâm, Minh Khai. Giáp Hoàng Mai: Tân Mai, Mai Động
ĐH Thăng Long → Hoàng Mai: Đại Kim. Lân cận: Thịnh Liệt, Định Công, Tân Mai, Giáp Bát. Giáp Thanh Xuân: Kim Giang, Hạ Đình, Khương Đình
ĐH Xây Dựng HN → Hai Bà Trưng: Thanh Lương. Lân cận: Minh Khai, Vĩnh Tuy, Bạch Mai, Thanh Nhàn. Giáp Hoàng Mai: Mai Động, Tân Mai
ĐH Kinh Tế Quốc Dân → Hai Bà Trưng: Đồng Tâm. Lân cận: Bách Khoa, Lê Đại Hành, Phạm Đình Hổ, Đồng Nhân, Quỳnh Lôi
ĐH Quốc Gia HN (Xuân Thủy) → Cầu Giấy: Dịch Vọng Hậu. Lân cận: Dịch Vọng, Quan Hoa, Mai Dịch, Nghĩa Tân, Nghĩa Đô
ĐH Khoa Học Tự Nhiên (Thanh Xuân) → Thanh Xuân: Thanh Xuân Bắc. Lân cận: Thanh Xuân Trung, Thanh Xuân Nam, Khương Mai, Nhân Chính, Thượng Đình. Giáp Đống Đa: Ngã Tư Sở, Phương Liên, Khương Thượng
ĐH Sư Phạm HN → Cầu Giấy: Dịch Vọng Hậu. Lân cận: Quan Hoa, Dịch Vọng, Mai Dịch
Học Viện Nông Nghiệp → Gia Lâm: Trâu Quỳ. Lân cận: Đặng Xá, Cổ Bi, Dương Xá, Kim Sơn
ĐH Công Nghiệp HN → Bắc Từ Liêm: Minh Khai(BTL). Lân cận: Phúc Diễn, Phú Diễn, Cầu Diễn, Tây Tựu
CĐ Y Hà Nội → Ba Đình: Ngọc Hà. Lân cận: Đội Cấn, Kim Mã, Giảng Võ, Cống Vị, Liễu Giai
ĐH Y Hà Nội → Đống Đa: Trung Tự. Lân cận: Kim Liên, Phương Mai, Phương Liên, Chùa Bộc, Nam Đồng
ĐH Thủy Lợi → Đống Đa: Chùa Bộc. Lân cận: Trung Liệt, Thịnh Quang, Kim Liên, Phương Mai, Trung Tự
ĐH Giao Thông Vận Tải → Đống Đa: Láng Thượng. Lân cận: Láng Hạ, Ô Chợ Dừa, Thịnh Quang. Giáp Cầu Giấy: Dịch Vọng, Quan Hoa
ĐH Ngoại Thương → Đống Đa: Láng Thượng. Lân cận: giống ĐH GTVT
ĐH Luật HN → Đống Đa: Ngã Tư Sở. Lân cận: Khương Thượng, Phương Liên, Thịnh Quang. Giáp Thanh Xuân: Thanh Xuân Bắc
ĐH Mở HN → Hai Bà Trưng: Bạch Đằng. Lân cận: Phố Huế, Đồng Nhân, Ngô Thì Nhậm
ĐH Công Đoàn → Đống Đa: Quang Trung. Lân cận: Trung Tự, Nam Đồng, Văn Chương, Khâm Thiên
ĐH Phenikaa → Hà Đông: Yên Nghĩa. Lân cận: Phú Lãm, Dương Nội, Kiến Hưng
ĐH FPT (HN) → Thạch Thất: Thạch Hòa. Lân cận: khu vực ngoại thành
ĐH Hà Nội → Thanh Xuân: Nhân Chính. Lân cận: Thượng Đình, Thanh Xuân Trung, Thanh Xuân Bắc

=== BỆNH VIỆN / LANDMARK ===

BV Bạch Mai → Đống Đa: Phương Mai. Giáp: Kim Liên, Trung Tự, Chùa Bộc. Giáp Hai Bà Trưng: Phạm Đình Hổ
BV Việt Đức → Hoàn Kiếm: Hàng Bông. Lân cận: Cửa Nam, Hàng Trống, Hàng Gai
Bến xe Giáp Bát → Hoàng Mai: Giáp Bát. Lân cận: Tương Mai, Thịnh Liệt, Trương Định(HM)
Bến xe Mỹ Đình → Nam Từ Liêm: Mỹ Đình 2. Lân cận: Mỹ Đình 1, Mễ Trì, Cầu Diễn
Hồ Tây → Tây Hồ: Quảng An, Nhật Tân, Bưởi, Xuân La, Thụy Khuê
Công viên Thống Nhất → Hai Bà Trưng: Lê Đại Hành. Giáp Đống Đa: Kim Liên, Trung Tự
Khu đô thị Times City → Hai Bà Trưng: Vĩnh Tuy, Mai Động. Giáp Hoàng Mai
Khu đô thị Linh Đàm → Hoàng Mai: Hoàng Liệt, Đại Kim. Giáp Thanh Trì
Khu đô thị Royal City → Thanh Xuân: Thượng Đình, Nhân Chính
The Manor → Nam Từ Liêm: Mỹ Đình 1
Keangnam → Nam Từ Liêm: Mễ Trì, Mỹ Đình 1
Chợ Đồng Xuân → Hoàn Kiếm: Đồng Xuân
Big C Thăng Long → Cầu Giấy: Dịch Vọng Hậu. Lân cận: Mai Dịch, Nghĩa Tân
Aeon Mall Long Biên → Long Biên: Cự Khối. Lân cận: Thạch Bàn, Sài Đồng, Long Biên
Aeon Mall Hà Đông → Hà Đông: Dương Nội. Lân cận: La Khê, Phú Lãm, Kiến Hưng

=== LƯU Ý QUAN TRỌNG ===
- Phường "Trương Định" có ở CẢ Hai Bà Trưng VÀ Hoàng Mai → xác định theo ngữ cảnh
- Phường "Minh Khai" có ở CẢ Hai Bà Trưng VÀ Bắc Từ Liêm → xác định theo ngữ cảnh
- Phường "Quang Trung" có ở CẢ Đống Đa VÀ Hà Đông → xác định theo ngữ cảnh
- Khi khách nói tên ĐƯỜNG → tra cứu đường đó đi qua những quận/phường nào → trả về TẤT CẢ

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
