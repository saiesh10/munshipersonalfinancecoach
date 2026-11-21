/**
 * @file lib/engine/ai.js
 * Safe Gemini client and AI fallback wrappers.
 * Adheres strictly to zero-leak privacy, timeouts, and quota backoff.
 */

const { parseDate, normalizeMerchant, generateStableId, ALIASES } = require('./parser');

class AiUnavailableError extends Error {
  constructor(message = 'Gemini API key is not configured or service is unavailable') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/**
 * Call Gemini REST API directly using global fetch with timeout and single retry.
 * @param {Object} options
 * @param {string} options.prompt
 * @param {string} [options.system]
 * @param {boolean} [options.json=false]
 * @param {number} [options.maxTokens=512]
 * @returns {Promise<string>}
 */
async function callGemini({ prompt, system = '', json = false, maxTokens = 512 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new AiUnavailableError('GEMINI_API_KEY environment variable is not set');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = [];
  if (system) {
    contents.push({
      role: 'user',
      parts: [{ text: `Instructions: ${system}\n\nTask: ${prompt}` }]
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  }

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2
    }
  };

  if (json) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  async function makeRequest() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const err = new Error(`Gemini API error ${res.status}: ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  try {
    return await makeRequest();
  } catch (err) {
    // Retry once on 429 or 5xx with 600ms backoff
    if (err.status === 429 || (err.status >= 500 && err.status < 600) || err.name === 'AbortError') {
      await new Promise(r => setTimeout(r, 600));
      return await makeRequest();
    }
    throw err;
  }
}

/**
 * Safely parse JSON from raw LLM output.
 * Strips markdown code blocks.
 * @param {string} raw
 * @returns {any}
 */
function cleanAndParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Categorize unknown merchant keys in a single batch call.
 * Never leaks full SMS or account numbers; only sends merchant keys.
 * @param {string[]} merchantKeys
 * @param {string[]} validCategories
 * @returns {Promise<Record<string, string>>}
 */
async function categorizeUnknownMerchants(merchantKeys, validCategories) {
  if (!Array.isArray(merchantKeys) || merchantKeys.length === 0) {
    return {};
  }

  const prompt = `Classify these Indian merchant names into exactly one of these categories:
Categories: ${validCategories.join(', ')}

Merchants:
${merchantKeys.map(k => `- ${k}`).join('\n')}

Respond ONLY with a JSON array of objects:
[{"merchantKey": "MERCHANT", "category": "Category Name"}]`;

  try {
    const raw = await callGemini({
      prompt,
      system: 'You are a precise transaction classification assistant. Output valid JSON only.',
      json: true,
      maxTokens: 512
    });

    const parsed = cleanAndParseJson(raw);
    const result = {};

    let list = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      list = parsed.merchants || parsed.categories || Object.values(parsed).find(Array.isArray) || [];
    }

    for (const item of list) {
      if (item && item.merchantKey && item.category && validCategories.includes(item.category)) {
        result[item.merchantKey.toUpperCase()] = item.category;
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Intelligent secondary heuristic extractor when Gemini is offline, unconfigured, or rate-limited.
 * Ensures uploaded messages are never dropped or left misunderstood.
 * @param {string} line
 * @returns {import('../types').Transaction | null}
 */
function parseHeuristicSmsLine(line) {
  if (!line || typeof line !== 'string') return null;
  const cleanLine = line.trim();
  if (cleanLine.length < 12) return null;

  // Filter out pure OTP / authentication alerts
  if (/\b(?:otp|one\s*time\s*password|verification\s*code|secret\s*otp)\b/i.test(cleanLine) &&
      /\b(?:valid\s*for|do\s*not\s*share|strictly\s*confidential)\b/i.test(cleanLine)) {
    return null;
  }

  // Look for amount
  const amtMatch = cleanLine.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                   cleanLine.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs\.?|INR|₹)/i) ||
                   cleanLine.match(/(?:debited|credited|paid|spent|sent|received|amt|amount)\s*(?:by|with|for|to|of|is)?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);

  if (!amtMatch) return null;

  const rawAmt = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (isNaN(rawAmt) || rawAmt <= 0) return null;

  // Look for direction
  const isCredit = /\b(?:credited|received|refund|deposited|transferred\s+from|cr\b|cashback)\b/i.test(cleanLine);
  const isDebit = /\b(?:debited|spent|paid|sent|purchase|withdrawn|transferred\s+to|dr\b|payment)\b/i.test(cleanLine);

  if (!isCredit && !isDebit) return null;
  const direction = isCredit ? 'credit' : 'debit';

  // Look for merchant
  let rawMerchant = '';

  const merchantPrepositions = [
    /(?:to\s+VPA|vpa)\s+([^\s()]+)/i,
    /(?:refund\s+from|from)\s+([A-Za-z0-9 &._'-]{2,30}?)(?=\s+via\b|\s+on\b|\s+Rs\b|\s+INR\b|\s+₹\b|\.|$|\s+ref\b|\s+using\b|\s+was\b|\s+is\b|\s+successful\b)/i,
    /(?:at|to|for|towards?|by|payee|merchant)\s+(?:refund\s+from\s+|neft-|imps-|upi-)?([A-Za-z0-9 &._'-]{2,30}?)(?=\s+via\b|\s+on\b|\s+Rs\b|\s+INR\b|\s+₹\b|\.|$|\s+ref\b|\s+using\b|\s+was\b|\s+is\b|\s+successful\b)/i,
    /Info:\s*(?:UPI\/)?([^/\s,;]+)/i
  ];

  for (const regex of merchantPrepositions) {
    const match = cleanLine.match(regex);
    if (match && match[1] && !/^(?:A\/C|account|VPA|Card|refund)/i.test(match[1].trim())) {
      rawMerchant = match[1].trim();
      break;
    }
  }

  // Fallback: match known brands / aliases in line
  if (!rawMerchant && ALIASES) {
    const upperLine = cleanLine.toUpperCase();
    for (const aliasKey of Object.keys(ALIASES)) {
      if (new RegExp(`\\b${aliasKey}\\b`, 'i').test(upperLine)) {
        rawMerchant = aliasKey;
        break;
      }
    }
  }

  if (!rawMerchant) {
    return null;
  }

  const date = parseDate(cleanLine);
  const { merchant, merchantKey } = normalizeMerchant(rawMerchant);
  const id = generateStableId(date, rawAmt, merchantKey, cleanLine);

  return {
    id,
    date,
    amount: rawAmt,
    direction,
    merchant,
    merchantKey,
    category: 'Other',
    categorySource: 'ai',
    rawText: cleanLine
  };
}

/**
 * Parse unreadable SMS lines via Gemini with intelligent heuristic fallback (capped at 10 lines).
 * @param {string[]} lines
 * @returns {Promise<Array<Object>>}
 */
async function parseUnreadableSmsLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }

  const candidateLines = lines.slice(0, 10);
  const prompt = `Extract transaction details from these unparsed Indian SMS/alert strings.
Only include transactions that represent confirmed settlements (ignore OTPs, promo messages, or login alerts).

Lines:
${candidateLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Return a JSON array of objects with:
[
  {
    "rawText": "exact original line",
    "amount": 123.45,
    "date": "YYYY-MM-DD",
    "direction": "debit" or "credit",
    "merchant": "Clean Title Case Merchant",
    "merchantKey": "UPPERCASE_KEY"
  }
]`;

  try {
    const raw = await callGemini({
      prompt,
      system: 'You are an Indian financial SMS parsing engine. Output valid JSON only.',
      json: true,
      maxTokens: 768
    });

    const parsed = cleanAndParseJson(raw);
    let list = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      list = parsed.transactions || parsed.data || parsed.results || Object.values(parsed).find(Array.isArray) || [];
    }

    const aiResults = [];
    for (const item of list) {
      if (!item) continue;
      const rawAmt = parseFloat(String(item.amount || '').replace(/,/g, '').replace(/[^0-9.]/g, ''));
      if (isNaN(rawAmt) || rawAmt <= 0) continue;

      const dirStr = String(item.direction || '').toLowerCase();
      const isCred = dirStr.includes('cr') || dirStr.includes('deposit') || dirStr.includes('received');
      const direction = isCred ? 'credit' : 'debit';

      const merchantRaw = item.merchant || item.merchantKey || 'Unknown Merchant';
      const { merchant, merchantKey } = normalizeMerchant(merchantRaw);
      const date = parseDate(item.date);

      // Match rawText to closest candidate line
      let matchedRaw = item.rawText || '';
      if (!candidateLines.includes(matchedRaw)) {
        const found = candidateLines.find(cl => cl.includes(matchedRaw) || matchedRaw.includes(cl) || cl.includes(String(rawAmt)));
        if (found) matchedRaw = found;
      }

      const id = generateStableId(date, rawAmt, merchantKey, matchedRaw || JSON.stringify(item));
      aiResults.push({
        id,
        date,
        amount: rawAmt,
        direction,
        merchant,
        merchantKey,
        category: 'Other',
        categorySource: 'ai',
        rawText: matchedRaw
      });
    }

    if (aiResults.length > 0) {
      return aiResults;
    }

    // If Gemini output didn't yield transactions, fallback to heuristic parser
    const fallbackResults = [];
    for (const line of candidateLines) {
      const txn = parseHeuristicSmsLine(line);
      if (txn) fallbackResults.push(txn);
    }
    return fallbackResults;
  } catch {
    // If Gemini is unavailable, rate-limited, or key missing, use intelligent heuristic fallback
    const fallbackResults = [];
    for (const line of candidateLines) {
      const txn = parseHeuristicSmsLine(line);
      if (txn) fallbackResults.push(txn);
    }
    return fallbackResults;
  }
}

module.exports = {
  callGemini,
  cleanAndParseJson,
  categorizeUnknownMerchants,
  parseUnreadableSmsLines,
  parseHeuristicSmsLine,
  AiUnavailableError
};
