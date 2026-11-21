/**
 * @file lib/engine/categorizer.js
 * Rule and keyword-based categorizer with process-level caching and graceful AI enhancement.
 */

const { KEYWORDS } = require('./keywords');

// In-memory process cache for AI categorizations
const aiCategoryCache = new Map();

/**
 * Categorize a single transaction based on user rules, keyword map, and salary heuristics.
 * A user-set category (categorySource "user") is never overwritten.
 * @param {import('../types').Transaction} txn
 * @param {import('../types').Rule[]} [rules=[]]
 * @returns {import('../types').Transaction}
 */
function categorizeTransaction(txn, rules = []) {
  if (!txn) return txn;

  // 1. Never overwrite user-set categories
  if (txn.categorySource === 'user') {
    return { ...txn };
  }

  const merchantKey = (txn.merchantKey || '').toUpperCase().trim();
  const rawTextUpper = (txn.rawText || '').toUpperCase();

  // 2. Check user rules: exact match first, then contains
  if (Array.isArray(rules) && rules.length > 0) {
    // Exact match
    const exactRule = rules.find(r => r.merchantKey && r.merchantKey.toUpperCase() === merchantKey);
    if (exactRule) {
      return {
        ...txn,
        category: exactRule.category,
        categorySource: 'rule'
      };
    }

    // Contains match
    const containsRule = rules.find(r => {
      const rKey = (r.merchantKey || '').toUpperCase();
      return rKey && (merchantKey.includes(rKey) || rKey.includes(merchantKey));
    });

    if (containsRule) {
      return {
        ...txn,
        category: containsRule.category,
        categorySource: 'rule'
      };
    }
  }

  // 3. Keyword map: exact match then longest substring match
  if (KEYWORDS[merchantKey]) {
    return {
      ...txn,
      category: KEYWORDS[merchantKey],
      categorySource: 'keyword'
    };
  }

  let matchedKeyword = null;
  let longestMatchLen = 0;
  for (const [kw, cat] of Object.entries(KEYWORDS)) {
    if (merchantKey.includes(kw) || rawTextUpper.includes(kw)) {
      if (kw.length > longestMatchLen) {
        longestMatchLen = kw.length;
        matchedKeyword = cat;
      }
    }
  }

  if (matchedKeyword) {
    return {
      ...txn,
      category: matchedKeyword,
      categorySource: 'keyword'
    };
  }

  // 4. Credits with salary words -> Income
  if (txn.direction === 'credit') {
    if (/\b(?:SALARY|PAYROLL|STIPEND|BONUS|DIVIDEND)\b/i.test(merchantKey) ||
        /\b(?:SALARY|PAYROLL|STIPEND|BONUS|DIVIDEND)\b/i.test(rawTextUpper)) {
      return {
        ...txn,
        category: 'Income',
        categorySource: 'keyword'
      };
    }
  }

  // 5. Check in-process AI cache
  if (aiCategoryCache.has(merchantKey)) {
    return {
      ...txn,
      category: aiCategoryCache.get(merchantKey),
      categorySource: 'ai'
    };
  }

  // 6. Otherwise "unsure" with category "Other"
  return {
    ...txn,
    category: 'Other',
    categorySource: 'unsure'
  };
}

/**
 * Categorize a batch of transactions.
 * Calls categorizeTransaction, then sends up to 20 unknown merchantKeys to Gemini in ONE batch.
 * @param {import('../types').Transaction[]} transactions
 * @param {import('../types').Rule[]} [rules=[]]
 * @param {function(string[]): Promise<Record<string, string>>} [aiCategorizer]
 * @returns {Promise<import('../types').Transaction[]>}
 */
async function categorizeBatch(transactions, rules = [], aiCategorizer = null) {
  if (!Array.isArray(transactions)) return [];

  // Pass 1: Categorize via user rules & keywords
  let categorized = transactions.map(t => categorizeTransaction(t, rules));

  // Identify unknown merchantKeys
  const unknownKeys = new Set();
  for (const t of categorized) {
    if (t.categorySource === 'unsure' && t.merchantKey && !aiCategoryCache.has(t.merchantKey)) {
      unknownKeys.add(t.merchantKey);
    }
  }

  // If there are unknown keys and an AI categorizer is available, send up to 20 in ONE call
  if (unknownKeys.size > 0 && typeof aiCategorizer === 'function') {
    try {
      const keysToQuery = Array.from(unknownKeys).slice(0, 20);
      const aiResults = await aiCategorizer(keysToQuery);

      if (aiResults && typeof aiResults === 'object') {
        for (const [key, category] of Object.entries(aiResults)) {
          if (category && typeof category === 'string') {
            aiCategoryCache.set(key.toUpperCase(), category);
          }
        }

        // Apply newly cached AI categories
        categorized = categorized.map(t => {
          if (t.categorySource === 'unsure' && t.merchantKey && aiCategoryCache.has(t.merchantKey)) {
            return {
              ...t,
              category: aiCategoryCache.get(t.merchantKey),
              categorySource: 'ai'
            };
          }
          return t;
        });
      }
    } catch {
      // Graceful fallback: return transactions as is
    }
  }

  return categorized;
}

module.exports = {
  categorizeTransaction,
  categorizeBatch,
  aiCategoryCache
};
