/**
 * @file lib/client.js
 * Frontend client SDK for Munshi.
 * Calls stateless Next.js Route Handlers with 15s timeout and friendly error messages.
 * Automatically falls back to offline mock if NEXT_PUBLIC_USE_MOCK=true.
 */

import * as mock from './mock/index';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/**
 * Universal POST fetcher with 15-second timeout and friendly error conversion.
 * @param {string} endpoint
 * @param {any} body
 * @returns {Promise<any>}
 */
async function postJson(endpoint, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMessage = json?.error || `Request failed (${res.status})`;
      throw new Error(errorMessage);
    }

    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('The ledger took too long to respond (timed out after 15s). Please try with a smaller batch.');
    }
    throw new Error(err.message || 'Could not connect to Munshi backend.');
  }
}

/**
 * Parse raw text (SMS) or CSV bank statement.
 * @param {Object} params
 * @param {string} [params.text]
 * @param {string} [params.csv]
 * @returns {Promise<{ transactions: import('./types').Transaction[], unparsed: string[] }>}
 */
export async function parseInput({ text, csv }) {
  if (USE_MOCK) {
    return mock.mockParseInput({ text, csv });
  }
  return postJson('/api/parse', { text, csv });
}

/**
 * Batch categorize transactions against user rules, keywords, and AI.
 * @param {Object} params
 * @param {import('./types').Transaction[]} params.transactions
 * @param {import('./types').Rule[]} [params.rules]
 * @returns {Promise<{ transactions: import('./types').Transaction[] }>}
 */
export async function categorizeBatch({ transactions, rules = [] }) {
  if (USE_MOCK) {
    return mock.mockCategorizeBatch({ transactions, rules });
  }
  return postJson('/api/categorize', { transactions, rules });
}

/**
 * Learn and retroactively apply a new categorization rule.
 * @param {Object} params
 * @param {import('./types').Transaction} params.transaction
 * @param {string} params.category
 * @param {import('./types').Transaction[]} params.transactions
 * @param {import('./types').Rule[]} [params.rules]
 * @returns {Promise<{ rule: import('./types').Rule, transactions: import('./types').Transaction[], affectedCount: number }>}
 */
export async function learnRule({ transaction, category, transactions, rules = [] }) {
  if (USE_MOCK) {
    return mock.mockLearnRule({ transaction, category, transactions, rules });
  }
  return postJson('/api/learn', { transaction, category, transactions, rules });
}

/**
 * Detect recurring charges and subscriptions.
 * @param {Object} params
 * @param {import('./types').Transaction[]} params.transactions
 * @returns {Promise<{ subscriptions: import('./types').Subscription[] }>}
 */
export async function detectRecurring({ transactions }) {
  if (USE_MOCK) {
    return mock.mockDetectRecurring({ transactions });
  }
  return postJson('/api/recurring', { transactions });
}

/**
 * Run deterministic financial simulation.
 * @param {Object} params
 * @param {import('./types').Profile} params.profile
 * @param {import('./types').Goal} params.goal
 * @param {import('./types').Transaction[]} [params.transactions]
 * @param {import('./types').Adjustment[]} [params.adjustments]
 * @returns {Promise<import('./types').Projection>}
 */
export async function simulate({ profile, goal, transactions = [], adjustments = [] }) {
  if (USE_MOCK) {
    return mock.mockSimulate({ profile, goal, transactions, adjustments });
  }
  return postJson('/api/simulate', { profile, goal, transactions, adjustments });
}

/**
 * Check mid-month pacing drift.
 * @param {Object} params
 * @param {import('./types').Transaction[]} params.transactions
 * @param {import('./types').Profile} params.profile
 * @param {import('./types').Goal} params.goal
 * @param {string} [params.today]
 * @returns {Promise<{ nudges: import('./types').Nudge[] }>}
 */
export async function getDrift({ transactions, profile, goal, today }) {
  if (USE_MOCK) {
    return mock.mockGetDrift({ transactions, profile, goal, today });
  }
  return postJson('/api/drift', { transactions, profile, goal, today });
}

/**
 * Generate "Future You" letter.
 * @param {Object} params
 * @param {Object} params.summary
 * @returns {Promise<import('./types').Letter>}
 */
export async function writeLetter({ summary }) {
  if (USE_MOCK) {
    return mock.mockWriteLetter({ summary });
  }
  const lang = summary?.lang || 'en';
  return postJson('/api/letter', { summary, lang });
}

/**
 * Ask Future You a question by voice or text.
 * @param {Object} params
 * @param {string} params.question
 * @param {Object} params.summary
 * @param {Array<{q: string, a: string}>} [params.history]
 * @returns {Promise<{ answer: string, source: 'gemini' | 'fallback' }>}
 */
export async function askFuture({ question, summary, history = [] }) {
  if (USE_MOCK) {
    return mock.mockAskFuture({ question, summary, history });
  }
  const lang = summary?.lang || 'en';
  return postJson('/api/ask', { question, summary, history, lang });
}
