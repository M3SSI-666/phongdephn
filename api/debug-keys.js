export default async function handler(req, res) {
  const keys = [];
  const mainKey = process.env.GEMINI_API_KEY;
  if (mainKey) keys.push({ name: 'GEMINI_API_KEY', last4: mainKey.slice(-4) });

  for (let i = 2; i <= 10; i++) {
    const val = process.env[`GEMINI_API_KEY_${i}`];
    if (val) keys.push({ name: `GEMINI_API_KEY_${i}`, last4: val.slice(-4) });
  }

  // Test each key with a simple request
  const MODEL = 'gemini-2.5-flash';
  const testBody = JSON.stringify({
    contents: [{ parts: [{ text: 'Say "ok"' }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 10 },
  });

  const results = [];
  for (const key of keys) {
    const fullKey = key.name === 'GEMINI_API_KEY'
      ? process.env.GEMINI_API_KEY
      : process.env[key.name];

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${fullKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: testBody,
        }
      );
      results.push({
        name: key.name,
        last4: key.last4,
        status: resp.status,
        ok: resp.ok,
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
    keys: keys.map(k => ({ name: k.name, last4: k.last4 })),
    testResults: results,
    timestamp: new Date().toISOString(),
  });
}
