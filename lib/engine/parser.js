/**
 * @file lib/engine/parser.js
 * Pure, side-effect-free SMS and banking text parser for Indian formats.
 */

const crypto = require('crypto');

// Known aliases mapping raw merchant prefixes/patterns to clean canonical keys
const ALIASES = {
  'SWIGGY ONE MEMBERSHIP': 'SWIGGY ONE',
  'SWIGGY ONE': 'SWIGGY ONE',
  'SWIGGY': 'SWIGGY',
  'SWIGGY INSTAMART': 'SWIGGY',
  'SWIGGY ORDER': 'SWIGGY',
  'ZOMATO GOLD': 'ZOMATO GOLD',
  'ZOMATO': 'ZOMATO',
  'ZOMATO ORDER': 'ZOMATO',
  'UBER INDIA': 'UBER',
  'UBER TRIP': 'UBER',
  'UBER': 'UBER',
  'AMZN': 'AMAZON',
  'AMAZON PAY': 'AMAZON',
  'AMAZON IN': 'AMAZON',
  'AMAZON SELLER': 'AMAZON',
  'FLIPKART INTERNET': 'FLIPKART',
  'FLIPKART PAY': 'FLIPKART',
  'NETFLIX MUMBAI': 'NETFLIX',
  'NETFLIX ENTERTAINMENT': 'NETFLIX',
  'RELIANCE JIO': 'JIO',
  'JIO PREPAID': 'JIO',
  'AIRTEL PREPAID': 'AIRTEL',
  'BHARTI AIRTEL': 'AIRTEL',
  'CULT FIT': 'CULT.FIT',
  'CULTFIT': 'CULT.FIT',
  'CUREFIT': 'CULT.FIT'
};

const MONTH_NAMES = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Convert string to Title Case.
 * @param {string} str
 * @returns {string}
 */
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize merchant name by stripping UPI handles, prefixes, refs, and collapsing aliases.
 * @param {string} raw
 * @returns {{ merchant: string, merchantKey: string }}
 */
function normalizeMerchant(raw) {
  if (!raw || typeof raw !== 'string') {
    return { merchant: 'Unknown Merchant', merchantKey: 'UNKNOWN' };
  }

  let cleaned = raw.trim();

  // Strip VPA handles (e.g. zomato@icici -> zomato)
  cleaned = cleaned.replace(/@[\w.-]+/g, '');

  // Strip common bank transfer prefixes (handles compound like "TO TRANSFER-UPI/DR/ZEPTO")
  cleaned = cleaned.replace(/^(?:TO\s+TRANSFER[-/]|BY\s+TRANSFER[-/]|TRANSFER[-/])/i, '');
  cleaned = cleaned.replace(/^(?:UPI\/DR\/|UPI\/CR\/|UPI\/|NEFT[-/]|IMPS[-/]|RTGS[-/]|VPA\s+|POS\s+\d*\s*|POS\s+|INF\/|BIL\/|INB\/|E-COMM\/|ACH\/|NACH\/)/i, '');
  cleaned = cleaned.replace(/^(?:DR\/|CR\/)/i, '');
  cleaned = cleaned.replace(/^(?:refund\s+from\s+|refund\s+by\s+|refund\s+)/i, '');

  // Strip trailing reference numbers, timestamps or balance info
  cleaned = cleaned.replace(/(?:\bRef\b|\bUPI Ref\b|\bTxn\b|\bBal\b|\bBalance\b|\bInfo:\b|\bwas successful\b|\bsuccessful\b).*$/i, '');

  // If there are multiple slash-separated components remaining (e.g. "NETFLIX/..."), extract the first meaningful part
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').map(p => p.trim()).filter(p => p && !/^\d+$/.test(p) && !/^(?:DR|CR|UPI)$/i.test(p));
    if (parts.length > 0) {
      cleaned = parts[0];
    }
  }

  // Remove common punctuation and trailing/leading noise
  cleaned = cleaned.replace(/[*#()]/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');

  const upper = cleaned.toUpperCase().trim();

  // Check aliases
  let canonicalKey = ALIASES[upper];
  if (!canonicalKey) {
    // Specifically protect SWIGGY ONE from collapsing to SWIGGY
    if (upper === 'SWIGGY ONE' || upper.startsWith('SWIGGY ONE ') || upper.startsWith('SWIGGY ONE-') || upper.startsWith('SWIGGY ONE/')) {
      canonicalKey = 'SWIGGY ONE';
    } else if (upper === 'ZOMATO GOLD' || upper.startsWith('ZOMATO GOLD ') || upper.startsWith('ZOMATO GOLD-') || upper.startsWith('ZOMATO GOLD/')) {
      canonicalKey = 'ZOMATO GOLD';
    } else {
      // Check prefix alias matching (longest patterns first)
      const sortedPatterns = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length);
      for (const [pattern, target] of sortedPatterns) {
        if (upper === pattern || upper.startsWith(pattern + ' ') || upper.startsWith(pattern + '-') || upper.startsWith(pattern + '/')) {
          canonicalKey = target;
          break;
        }
      }
    }
  }

  const merchantKey = canonicalKey || upper || 'UNKNOWN';
  const merchant = toTitleCase(canonicalKey || upper || 'Unknown Merchant');

  return { merchant, merchantKey };
}

/**
 * Parse date string into YYYY-MM-DD.
 * Supports: dd-mm-yy, dd-mm-yyyy, dd/mm/yy, dd/mm/yyyy, ddMonyy, dd-Mon-yy, dd Mon yyyy.
 * Two-digit years default to 20yy.
 * @param {string} text
 * @returns {string} YYYY-MM-DD
 */
function parseDate(text) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!text) return todayStr;

  // 1. ddMonyy (e.g. 05Nov26 or 05Nov2026)
  const ddMonYy = text.match(/\b([0-3]?[0-9])([A-Za-z]{3})([0-9]{2,4})\b/);
  if (ddMonYy) {
    const day = ddMonYy[1].padStart(2, '0');
    const mon = MONTH_NAMES[ddMonYy[2].toLowerCase()];
    if (mon) {
      let yr = ddMonYy[3];
      if (yr.length === 2) yr = '20' + yr;
      return `${yr}-${mon}-${day}`;
    }
  }

  // 2. dd-Mon-yy or dd-Mon-yyyy or "dd Mon yyyy"
  const ddMonYyDelim = text.match(/\b([0-3]?[0-9])[\s/-]([A-Za-z]{3})[\s/-]([0-9]{2,4})\b/);
  if (ddMonYyDelim) {
    const day = ddMonYyDelim[1].padStart(2, '0');
    const mon = MONTH_NAMES[ddMonYyDelim[2].toLowerCase()];
    if (mon) {
      let yr = ddMonYyDelim[3];
      if (yr.length === 2) yr = '20' + yr;
      return `${yr}-${mon}-${day}`;
    }
  }

  // 3. dd-mm-yy, dd-mm-yyyy, dd/mm/yy, dd/mm/yyyy
  const ddMmYy = text.match(/\b([0-3]?[0-9])[\/-]([0-1]?[0-9])[\/-]([0-9]{2,4})\b/);
  if (ddMmYy) {
    const day = ddMmYy[1].padStart(2, '0');
    const mon = ddMmYy[2].padStart(2, '0');
    let yr = ddMmYy[3];
    if (yr.length === 2) yr = '20' + yr;
    return `${yr}-${mon}-${day}`;
  }

  // 4. ISO yyyy-mm-dd
  const yyyyMmDd = text.match(/\b(20[0-9]{2})[\/-]([0-1]?[0-9])[\/-]([0-3]?[0-9])\b/);
  if (yyyyMmDd) {
    const yr = yyyyMmDd[1];
    const mon = yyyyMmDd[2].padStart(2, '0');
    const day = yyyyMmDd[3].padStart(2, '0');
    return `${yr}-${mon}-${day}`;
  }

  return todayStr;
}

/**
 * Generate stable ID for a transaction.
 * @param {string} date
 * @param {number} amount
 * @param {string} merchantKey
 * @param {string} rawText
 * @returns {string}
 */
function generateStableId(date, amount, merchantKey, rawText) {
  const payload = `${date}|${Number(amount).toFixed(2)}|${merchantKey}|${rawText.trim()}`;
  try {
    if (crypto && typeof crypto.createHash === 'function') {
      return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
    }
  } catch {}
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }
  return 'tx_' + Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Parse an SMS string into a Transaction.
 * Returns null if the line is unreadable or not a confirmed settlement.
 * @param {string} line
 * @returns {import('../types').Transaction | null}
 */
function parseSms(line) {
  if (!line || typeof line !== 'string') return null;
  const cleanLine = line.trim();
  if (cleanLine.length < 10) return null;

  // Filter out pure OTP / authentication messages
  if (/\b(?:otp|one\s*time\s*password|secret\s*otp|verification\s*code)\b/i.test(cleanLine) &&
      /\b(?:valid\s*for|do\s*not\s*share|strictly\s*confidential)\b/i.test(cleanLine)) {
    return null;
  }

  // Determine direction
  const isDebit = /\b(?:debited|spent|paid|sent|purchase|withdrawn|transferred\s+to|dr\b|payment\s+to)\b/i.test(cleanLine);
  const isCredit = /\b(?:credited|received|refund|deposited|transferred\s+from|cr\b|cashback)\b/i.test(cleanLine);

  if (!isDebit && !isCredit) {
    return null;
  }

  const direction = isDebit ? 'debit' : 'credit';

  // Extract amount: handles Rs, Rs., INR, ₹, commas, decimals
  const amountPattern = /(?:(?:Rs\.?|INR|₹)\s*|debited\s*(?:by|with|for)?\s*(?:Rs\.?|INR|₹)?\s*|spent\s*(?:Rs\.?|INR|₹)?\s*|paid\s*(?:to\s+[A-Za-z0-9\s]+)?\s*(?:Rs\.?|INR|₹)?\s*|sent\s*(?:to\s+[A-Za-z0-9\s]+)?\s*(?:Rs\.?|INR|₹)?\s*|credited\s*(?:to|with|by|for)?\s*(?:Rs\.?|INR|₹)?\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i;
  let amountMatch = cleanLine.match(amountPattern);

  if (!amountMatch) {
    amountMatch = cleanLine.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                  cleanLine.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs\.?|INR|₹)/i);
  }

  if (!amountMatch) {
    return null;
  }

  const rawAmountStr = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(rawAmountStr);
  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  // Extract date
  const date = parseDate(cleanLine);

  // Extract account / card if available
  const accMatch = cleanLine.match(/(?:a\/c|account|card|ending)\s*(?:no\.?\s*)?([*X0-9]{3,16})/i);
  const account = accMatch ? accMatch[1].trim() : undefined;

  // Extract reference number if available
  const refMatch = cleanLine.match(/(?:Ref|UPI Ref|Txn|Reference)\s*(?:no\.?\s*|:)?\s*([A-Za-z0-9]+)/i);
  const ref = refMatch ? refMatch[1].trim() : undefined;

  // Extract merchant name
  let rawMerchant = '';

  // 1. "to VPA zomato@icici"
  const vpaMatch = cleanLine.match(/to\s+VPA\s+([^\s()]+)/i);
  if (vpaMatch) {
    rawMerchant = vpaMatch[1];
  }

  // 2. "Info: UPI/NETFLIX/..."
  if (!rawMerchant) {
    const infoMatch = cleanLine.match(/Info:\s*(?:UPI\/)?([^/\s,;]+)/i);
    if (infoMatch) {
      rawMerchant = infoMatch[1];
    }
  }

  // 3. "at SWIGGY on 14-Nov-26"
  if (!rawMerchant) {
    const atMatch = cleanLine.match(/\bat\s+([A-Za-z0-9 &._'-]+?)(?=\s+on\b|\.|$|\s+ref\b|\s+using\b)/i);
    if (atMatch) {
      rawMerchant = atMatch[1];
    }
  }

  // 4. "by NEFT-ACME TECH SALARY"
  if (!rawMerchant) {
    const byMatch = cleanLine.match(/\bby\s+(?:NEFT-|IMPS-|UPI-)?([A-Za-z0-9 &._'-]+?)(?=\s+on\b|\.|$|\s+ref\b)/i);
    if (byMatch) {
      rawMerchant = byMatch[1];
    }
  }

  // 5. "towards BLINKIT" or "toward BLINKIT"
  if (!rawMerchant) {
    const towardMatch = cleanLine.match(/\btowards?\s+([A-Za-z0-9 &._'-]+?)(?=\s+on\b|\.|$|\s+ref\b)/i);
    if (towardMatch) {
      rawMerchant = towardMatch[1];
    }
  }

  // 6. "To UBER INDIA On 10/11/26" or "Paid ₹349 to JIO via PhonePe"
  if (!rawMerchant) {
    const toMatch = cleanLine.match(/\b(?:to|To)\s+([A-Za-z0-9 &._'-]+?)(?=\s+via\b|\s+on\b|\s+Rs\b|\s+INR\b|\s+₹\b|\.|$|\s+ref\b)/i);
    if (toMatch && !/^(?:A\/C|account|VPA)/i.test(toMatch[1])) {
      rawMerchant = toMatch[1];
    }
  }

  // 7. "for GYMKHANA FITNESS on 02-11-2026"
  if (!rawMerchant) {
    const forMatch = cleanLine.match(/\bfor\s+([A-Za-z0-9 &._'-]+?)(?=\s+on\b|\.|$|\s+ref\b)/i);
    if (forMatch) {
      rawMerchant = forMatch[1];
    }
  }

  // 8. "to <merchant>" fallback
  if (!rawMerchant) {
    const fallbackTo = cleanLine.match(/to\s+([A-Za-z0-9 &._'-]{2,30})/i);
    if (fallbackTo && !/^(?:A\/C|account)/i.test(fallbackTo[1])) {
      rawMerchant = fallbackTo[1];
    }
  }

  // 9. Match known brand aliases anywhere in line
  if (!rawMerchant) {
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

  const { merchant, merchantKey } = normalizeMerchant(rawMerchant);
  const id = generateStableId(date, amount, merchantKey, cleanLine);

  return {
    id,
    date,
    amount,
    direction,
    merchant,
    merchantKey,
    category: 'Other',
    categorySource: 'unsure',
    rawText: cleanLine,
    account,
    ref
  };
}

/**
 * Split text input into individual message chunks.
 * Splits by blank lines, or lines starting with bank sender codes.
 * @param {string} text
 * @returns {string[]}
 */
function splitMessages(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const chunks = [];
  let currentChunk = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
      }
      continue;
    }

    const isSenderHeader = /^[A-Z0-9-]{2,10}\s*[:|-]\s*/i.test(trimmed) ||
      /^(?:Dear\s+Customer|Your\s+|A\/c|Account|Rs\.?\s*\d|INR\s*\d|₹\s*\d|Paid\s+|Sent\s+|Salary\s+of|Txn\s+|Payment\s+)/i.test(trimmed);

    if (isSenderHeader && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [trimmed];
    } else {
      currentChunk.push(trimmed);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

/**
 * Parse raw text into transactions and unparsed lines.
 * Optionally attempts AI parsing for unparsed lines (capped at 10).
 * @param {string} text
 * @param {function(string[]): Promise<import('../types').Transaction[]>} [aiParser]
 * @returns {Promise<{ transactions: import('../types').Transaction[], unparsed: string[] }>}
 */
async function parseInputText(text, aiParser = null) {
  const chunks = splitMessages(text);
  const transactions = [];
  const unparsed = [];
  const seenIds = new Set();

  for (const chunk of chunks) {
    const txn = parseSms(chunk);
    if (txn) {
      if (!seenIds.has(txn.id)) {
        seenIds.add(txn.id);
        transactions.push(txn);
      }
    } else {
      unparsed.push(chunk);
    }
  }

  if (unparsed.length > 0 && typeof aiParser === 'function') {
    try {
      const candidates = unparsed.slice(0, 10);
      const aiResults = await aiParser(candidates);
      if (Array.isArray(aiResults) && aiResults.length > 0) {
        for (const txn of aiResults) {
          if (txn && txn.amount && txn.direction && !seenIds.has(txn.id)) {
            seenIds.add(txn.id);
            transactions.push(txn);
            const idx = unparsed.indexOf(txn.rawText);
            if (idx !== -1) {
              unparsed.splice(idx, 1);
            } else {
              const looseIdx = unparsed.findIndex(u =>
                u.trim() === (txn.rawText || '').trim() ||
                (txn.rawText && (u.includes(txn.rawText) || txn.rawText.includes(u)))
              );
              if (looseIdx !== -1) {
                unparsed.splice(looseIdx, 1);
              }
            }
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  return { transactions, unparsed };
}

module.exports = {
  parseSms,
  splitMessages,
  parseInputText,
  parseDate,
  normalizeMerchant,
  generateStableId,
  ALIASES
};
