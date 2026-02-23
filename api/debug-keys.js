export default async function handler(req, res) {
  const keys = [];
  const mainKey = process.env.GEMINI_API_KEY;
  if (mainKey) keys.push({ name: 'GEMINI_API_KEY', last4: mainKey.slice(-4), value: mainKey });

  for (let i = 2; i <= 10; i++) {
    const val = process.env[`GEMINI_API_KEY_${i}`];
    if (val) keys.push({ name: `GEMINI_API_KEY_${i}`, last4: val.slice(-4), value: val });
  }

  const MODEL = 'gemini-2.5-flash';
  const testBody = JSON.stringify({
    contents: [{ parts: [{ text: 'Say "ok"' }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 10 },
  });

  const results = [];
  for (const key of keys) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key.value}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: testBody,
        }
      );

      let body = null;
      try { body = await resp.json(); } catch {}

      results.push({
        name: key.name,
        last4: key.last4,
        status: resp.status,
        ok: resp.ok,
        errorMessage: body?.error?.message || null,
        errorStatus: body?.error?.status || null,
      });
    } catch (e) {
      results.push({
        name: key.name,
        last4: key.last4,
        status: 'error',
        message: e.message,
      });
    }
  }

  return res.status(200).json({
    totalKeys: keys.length,
    testResults: results,
    timestamp: new Date().toISOString(),
  });
}
