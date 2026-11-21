/**
 * @file lib/engine/letter.js
 * Generates the emotional payoff: "Future You" letter.
 * Zero-cost, privacy-preserving LLM generation via Gemini with graceful offline fallback.
 * Supports both English and Hindi narration formats.
 */

const { callGemini } = require('./ai');

// Simple in-memory sliding window rate limiter: max 20 requests per IP per minute
const rateLimitMap = new Map();

/**
 * Clean up old timestamps and check whether clientIp is within rate limit.
 * @param {string} clientIp
 * @param {number} maxPerMinute
 * @returns {boolean}
 */
function checkRateLimit(clientIp, maxPerMinute = 20) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = rateLimitMap.get(clientIp) || [];

  // Filter out timestamps older than 60s
  const recent = timestamps.filter(ts => now - ts < windowMs);

  if (recent.length >= maxPerMinute) {
    return false;
  }

  recent.push(now);
  rateLimitMap.set(clientIp, recent);
  return true;
}

/**
 * Format number into Indian currency representation.
 * @param {number} num
 * @returns {string}
 */
function formatRupees(num) {
  return '₹' + Math.abs(Math.round(num || 0)).toLocaleString('en-IN');
}

/**
 * Hand-written fallback templates chosen by fiscal situation.
 * Strictly plain text, warm, realistic, Indian English or conversational Hindi, 80-110 words.
 * @param {Object} summary
 * @param {string} [lang='en']
 */
function getFallbackLetter(summary, lang = 'en') {
  const isHindi = (lang || '').toLowerCase().startsWith('hi');
  const goalName = summary.goalName || (isHindi ? 'तुम्हारा लक्ष्य' : 'your goal');
  const targetDate = summary.goalDatePlan || (isHindi ? 'लक्ष्य तिथि' : 'the target date');
  const continueDate = summary.goalDateContinue || (isHindi ? 'कुछ समय बाद' : 'a little later');
  const monthlyNet = summary.monthlyNet || 0;
  const shortfall = summary.shortfallAtTarget || 0;
  const category = summary.topCategory || summary.topOverspendCategory || (isHindi ? 'खान-पान और डिलीवरी' : 'food and delivery');
  const cutPct = summary.cutPctNeeded ? `${summary.cutPctNeeded}%` : '20%';

  let text = '';

  if (isHindi) {
    if (monthlyNet <= 0) {
      // Net negative Hindi template
      text = `मैं तुम्हें ${targetDate} से यह ख़त लिख रहा हूँ। पीछे मुड़कर देखें, तो यह वही महीना था जब ${goalName} की ओर हमारे कदम रुक गए थे। हम हर आने वाला रुपया खर्च कर रहे थे, कल के लिए कोई बचत नहीं बची थी। यह खर्च घर के किराए या बिलों में नहीं—बल्कि ${category} में चुपचाप बह रहा था। अगर तुम इस महीने से ${category} में सिर्फ़ ${cutPct} की कटौती कर लो, तो तुरंत राहत मिल जाएगी। आज रात थोड़ा वक्त निकालो और एक हद तय करो। तुम पहले भी इससे मुश्किल हालात से संभल चुके हो।`;
    } else if (shortfall > 0) {
      // Will miss goal Hindi template
      text = `मैं तुम्हें ${targetDate} से यह ख़त लिख रहा हूँ। हम ${goalName} के बहुत करीब हैं, लेकिन सिर्फ़ ${formatRupees(shortfall)} से चूक गए। यह इसलिए अखरता है क्योंकि बिना किसी बड़ी क़ुर्बानी के हम इसे पूरा कर सकते थे। पूरी बात बस ${category} पर आकर अटकी। अगर तुम हर महीने ${category} पर सिर्फ़ ${cutPct} कम खर्च करो, तो यह कमी पूरी हो जाएगी और हम ${continueDate} की जगह ${targetDate} तक ही अपना लक्ष्य पा लेंगे। आज खुद को यह अनुशासन उपहार में दो। तुम्हारा भविष्य तुम पर भरोसा कर रहा है।`;
    } else {
      // Will make it Hindi template
      text = `मैं तुम्हें ${targetDate} से यह ख़त लिख रहा हूँ। तुमने कर दिखाया! ${goalName} के लिए पूरे पैसे जमा हो गए हैं, और इस सुकून को शब्दों में बयां करना मुश्किल है। तय योजना पर टिके रहने और ${category} पर नज़र रखने से हमारी मासिक बचत ${formatRupees(monthlyNet)} बनी रही। उन शामों में जब तुमने जल्दबाज़ी के बजाय संयम को चुना, उसी ने आज हमें यह चैन दिया है। इस रफ़्तार को बनाए रखो। तुमने खुद को साबित कर दिया है कि तुम अपने भविष्य से किए वादे निभाते हो।`;
    }
  } else {
    if (monthlyNet <= 0) {
      // Net negative English template
      text = `I am writing to you from ${targetDate}. Looking back, this was the month things came to a standstill with ${goalName}. We were spending every rupee that arrived, leaving zero cushion for tomorrow. The leak was not rent or bills—it was ${category}, quietly claiming our margin week after week. If you trim ${cutPct} from ${category} starting this pay cycle, you instantly free up breathing room. Take a quiet hour tonight and draw the line. You have pulled yourself out of tighter corners before.`;
    } else if (shortfall > 0) {
      // Will miss goal English template
      text = `I am writing to you from ${targetDate}. We are close to ${goalName}, but we missed it by ${formatRupees(shortfall)}. It hurts because we could have made it without much sacrifice. The entire slip came down to ${category}. If you cut back just ${cutPct} on ${category} each month, the gap closes completely and we hit the number by ${targetDate} instead of drifting to ${continueDate}. Give yourself the gift of that discipline today. Your future self is counting on you.`;
    } else {
      // Will make it English template
      text = `I am writing to you from ${targetDate}. You made it. ${goalName} is fully funded, and the quiet relief is hard to describe. Sticking to the plan and watching ${category} kept our monthly net steady at ${formatRupees(monthlyNet)}. Those evenings when you chose restraint over convenience paid for the peace of mind we have today. Hold on to this rhythm. You proved to yourself that you are someone who keeps promises to their future.`;
    }
  }

  return {
    text,
    source: 'fallback',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Clean LLM letter response and validate word count / formatting.
 * Must be 40 to 220 words and contain no markdown headers or bullet points.
 * @param {string} text
 * @returns {boolean}
 */
function isValidLetter(text) {
  if (!text || typeof text !== 'string') return false;
  // Disallow markdown bold, headers, bullets
  if (/[#*_`~]/.test(text) || /^\s*[-*•]\s+/m.test(text)) {
    return false;
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 40 && words.length <= 220;
}

/**
 * Generate Future You letter via Gemini with automatic fallback on missing key,
 * rate limit, or format invalidation.
 * @param {Object} summary
 * @param {string} [clientIp='127.0.0.1']
 * @param {string} [lang='en']
 * @returns {Promise<import('../types').Letter>}
 */
async function generateLetter(summary, clientIp = '127.0.0.1', lang = 'en') {
  const rateLimitPerMin = parseInt(process.env.RATE_LIMIT_PER_MIN || '20', 10);
  const selectedLang = (lang || summary?.lang || 'en').toLowerCase();
  const isHindi = selectedLang.startsWith('hi');

  // Rate limiting check: on limit, return fallback letter gracefully
  if (!checkRateLimit(clientIp, rateLimitPerMin)) {
    return getFallbackLetter(summary, selectedLang);
  }

  const system = isHindi
    ? `You are the user's future self, writing a short, warm, plain-spoken letter in first person in natural, conversational Hindi (Devanagari script) from the date they would reach, or miss, their goal. Warm, respectful and encouraging, like a supportive elder self or close friend. No hype, no emojis, no bullet points, no markdown. 80 to 120 words. Mention the goal, the exact rupee shortfall or surplus, the single category that matters most, and one concrete change with its rupee effect. End with one honest sentence of encouragement. Use only the numbers provided.`
    : `You are the user's future self, writing a short, warm, plain-spoken letter in first person from the date they would reach, or miss, their goal. Indian English, no hype, no emojis, no bullet points. 80 to 110 words. Mention the goal, the exact rupee shortfall or surplus, the single category that matters most, and one concrete change with its rupee effect. End with one honest sentence of encouragement. Use only the numbers provided.`;

  // Privacy: prompt contains ONLY the summary numbers, never full SMS, accounts or transaction history
  const prompt = `Here is the current fiscal projection summary:
${JSON.stringify(summary, null, 2)}

Write the first-person letter now as plain text without any markdown or formatting:`;

  try {
    const rawLetter = await callGemini({
      system,
      prompt,
      json: false,
      maxTokens: 350
    });

    // Strip any accidental markdown formatting
    const cleaned = rawLetter
      .replace(/^["']|["']$/g, '')
      .replace(/[*#_~`]/g, '')
      .trim();

    if (isValidLetter(cleaned)) {
      return {
        text: cleaned,
        source: 'gemini',
        generatedAt: new Date().toISOString()
      };
    }

    return getFallbackLetter(summary, selectedLang);
  } catch (err) {
    // If Gemini fails or key missing, return human fallback seamlessly
    return getFallbackLetter(summary, selectedLang);
  }
}

module.exports = {
  generateLetter,
  getFallbackLetter,
  checkRateLimit,
  isValidLetter,
  formatRupees
};
