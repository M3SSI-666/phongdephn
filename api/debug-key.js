export default async function handler(req, res) {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';

  return res.status(200).json({
    rawKeyLength: rawKey.length,
    first50: rawKey.substring(0, 50),
    last50: rawKey.substring(rawKey.length - 50),
    hasLiteralBackslashN: rawKey.includes('\\n'),
    hasRealNewline: rawKey.includes('\n'),
    startsWithQuote: rawKey[0] === '"' || rawKey[0] === "'",
    endsWithQuote: rawKey[rawKey.length - 1] === '"' || rawKey[rawKey.length - 1] === "'",
    startsWithBegin: rawKey.includes('-----BEGIN'),
    endsWithEnd: rawKey.includes('-----END'),
    hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasSheetId: !!process.env.GOOGLE_SHEETS_ID,
  });
}
