/**
 * @file lib/engine/csv.js
 * Pure, side-effect-free CSV parser for Indian bank statements.
 * Uses PapaParse and handles bank preambles, header synonyms, and number formatting.
 */

const Papa = require('papaparse');
const { parseDate, normalizeMerchant, generateStableId, parseSms } = require('./parser');

// Column synonyms (lowercase for comparison)
const DATE_SYNONYMS = ['date', 'txn date', 'transaction date', 'value date', 'post date', 'booking date'];
const NARRATION_SYNONYMS = ['narration', 'description', 'particulars', 'remarks', 'merchant', 'payee', 'details', 'transaction details', 'message', 'sms', 'sms body', 'body', 'text', 'alert'];
const DEBIT_SYNONYMS = ['debit', 'withdrawal', 'dr', 'debit amount', 'dr amount', 'withdrawal amt', 'withdrawal amount', 'debit (inr)'];
const CREDIT_SYNONYMS = ['credit', 'deposit', 'cr', 'credit amount', 'cr amount', 'deposit amt', 'deposit amount', 'credit (inr)'];
const AMOUNT_SYNONYMS = ['amount', 'txn amount', 'transaction amount', 'net amount'];
const TYPE_SYNONYMS = ['type', 'dr/cr', 'cr/dr', 'txn type', 'transaction type'];

/**
 * Clean and parse Indian rupee strings (e.g. "1,25,000.00" or " 450.50 ") into float.
 * @param {any} val
 * @returns {number}
 */
function parseIndianAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);

  const clean = String(val).replace(/,/g, '').replace(/[₹RsINR\s]/gi, '').trim();
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

/**
 * Scan raw 2D array of rows from PapaParse to locate the real table header.
 * Bank statements frequently have metadata in rows 1-10.
 * @param {string[][]} rows
 * @returns {{ headerIndex: number, colIndices: Record<string, number> } | null}
 */
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i].map(c => String(c || '').trim().toLowerCase());
    
    // Check if this row looks like a header
    let dateCol = -1;
    let descCol = -1;
    let debitCol = -1;
    let creditCol = -1;
    let amountCol = -1;
    let typeCol = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;

      if (dateCol === -1 && DATE_SYNONYMS.some(s => cell === s || cell.includes(s))) {
        dateCol = c;
      } else if (descCol === -1 && NARRATION_SYNONYMS.some(s => cell === s || cell.includes(s))) {
        descCol = c;
      } else if (debitCol === -1 && DEBIT_SYNONYMS.some(s => cell === s || cell.startsWith(s))) {
        debitCol = c;
      } else if (creditCol === -1 && CREDIT_SYNONYMS.some(s => cell === s || cell.startsWith(s))) {
        creditCol = c;
      } else if (amountCol === -1 && AMOUNT_SYNONYMS.some(s => cell === s)) {
        amountCol = c;
      } else if (typeCol === -1 && TYPE_SYNONYMS.some(s => cell === s)) {
        typeCol = c;
      }
    }

    const hasDate = dateCol !== -1;
    const hasMoney = (debitCol !== -1 || creditCol !== -1) || amountCol !== -1;
    const hasDesc = descCol !== -1;

    if (hasDate && (hasMoney || hasDesc)) {
      return {
        headerIndex: i,
        colIndices: {
          date: dateCol,
          desc: descCol !== -1 ? descCol : (dateCol === 0 ? 1 : 0),
          debit: debitCol,
          credit: creditCol,
          amount: amountCol,
          type: typeCol
        }
      };
    }
  }

  return null;
}

/**
 * Parse a bank CSV string into an array of deduplicated Transaction objects.
 * @param {string} csvString
 * @returns {{ transactions: import('../types').Transaction[], unparsed: string[] }}
 */
function parseCsv(csvString) {
  if (!csvString || typeof csvString !== 'string') {
    return { transactions: [], unparsed: [] };
  }

  const parsed = Papa.parse(csvString, {
    skipEmptyLines: 'greedy'
  });

  if (!parsed.data || parsed.data.length === 0) {
    return { transactions: [], unparsed: [] };
  }

  const headerInfo = findHeaderRow(parsed.data);
  if (!headerInfo) {
    return {
      transactions: [],
      unparsed: parsed.data.map(r => Array.isArray(r) ? r.join(',') : String(r))
    };
  }

  const { headerIndex, colIndices } = headerInfo;
  const transactions = [];
  const unparsed = [];
  const seenIds = new Set();

  for (let i = headerIndex + 1; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (!row || row.length === 0) continue;

    const rawDate = row[colIndices.date];
    let rawDesc = row[colIndices.desc] || '';
    const rawLine = row.join(' | ');

    if (!rawDate && !rawDesc) continue;

    const date = parseDate(rawDate);

    // Determine amount and direction
    let amount = 0;
    let direction = 'debit';

    if (colIndices.debit !== -1 || colIndices.credit !== -1) {
      const debitVal = colIndices.debit !== -1 ? parseIndianAmount(row[colIndices.debit]) : 0;
      const creditVal = colIndices.credit !== -1 ? parseIndianAmount(row[colIndices.credit]) : 0;

      if (creditVal > 0 && debitVal === 0) {
        amount = creditVal;
        direction = 'credit';
      } else if (debitVal > 0) {
        amount = debitVal;
        direction = 'debit';
      } else if (colIndices.amount !== -1) {
        amount = parseIndianAmount(row[colIndices.amount]);
      }
    } else if (colIndices.amount !== -1) {
      amount = parseIndianAmount(row[colIndices.amount]);
      if (colIndices.type !== -1) {
        const typeStr = String(row[colIndices.type] || '').trim().toLowerCase();
        if (typeStr.includes('cr') || typeStr.includes('credit') || typeStr.includes('deposit')) {
          direction = 'credit';
        } else {
          direction = 'debit';
        }
      }
    }

    // If standard table columns did not yield an amount, check if rawDesc or rawLine is an SMS message
    if (amount <= 0 && rawDesc.trim()) {
      const smsCandidate = parseSms(rawDesc) || parseSms(rawLine);
      if (smsCandidate) {
        amount = smsCandidate.amount;
        direction = smsCandidate.direction;
        if (smsCandidate.merchant && smsCandidate.merchant !== 'Unknown Merchant') {
          rawDesc = smsCandidate.merchant;
        }
      }
    }

    if (amount <= 0 || !rawDesc.trim()) {
      unparsed.push(rawLine);
      continue;
    }

    const { merchant, merchantKey } = normalizeMerchant(rawDesc);
    const id = generateStableId(date, amount, merchantKey, rawLine);

    if (!seenIds.has(id)) {
      seenIds.add(id);
      transactions.push({
        id,
        date,
        amount,
        direction,
        merchant,
        merchantKey,
        category: 'Other',
        categorySource: 'unsure',
        rawText: rawLine
      });
    }
  }

  return { transactions, unparsed };
}

module.exports = {
  parseCsv,
  findHeaderRow,
  parseIndianAmount
};
