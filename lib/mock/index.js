/**
 * @file lib/mock/index.js
 * Offline mock fallback implementations when NEXT_PUBLIC_USE_MOCK=true.
 */

import {
  SAMPLE_TRANSACTIONS,
  SAMPLE_RULES,
  SAMPLE_PROFILE,
  SAMPLE_GOAL
} from './sampleData';

import { parseInputText } from '../engine/parser';
import { parseCsv } from '../engine/csv';
import { categorizeBatch } from '../engine/categorizer';
import { deriveRule, applyRule } from '../engine/learn';
import { detectRecurring } from '../engine/recurring';
import { simulate } from '../engine/simulate';
import { detectDrift } from '../engine/drift';
import { getFallbackLetter } from '../engine/letter';
import { answerFutureQuestion } from '../engine/ask';
import { parseUnreadableSmsLines } from '../engine/ai';

export async function mockParseInput({ text, csv }) {
  if (csv) {
    const csvResult = parseCsv(csv);
    if (csvResult.transactions.length > 0) {
      if (csvResult.unparsed.length > 0) {
        const unparsedRes = await parseInputText(csvResult.unparsed.join('\n'), parseUnreadableSmsLines);
        return {
          transactions: [...csvResult.transactions, ...unparsedRes.transactions],
          unparsed: unparsedRes.unparsed
        };
      }
      return csvResult;
    }
    return parseInputText(csv, parseUnreadableSmsLines);
  }
  return parseInputText(text || '', parseUnreadableSmsLines);
}

export async function mockCategorizeBatch({ transactions, rules }) {
  return { transactions: await categorizeBatch(transactions, rules) };
}

export async function mockLearnRule({ transaction, category, transactions, rules }) {
  const derived = deriveRule(transaction, category);
  return applyRule(derived, transactions, transaction.id);
}

export async function mockDetectRecurring({ transactions }) {
  return { subscriptions: detectRecurring(transactions) };
}

export async function mockSimulate({ profile, goal, transactions, adjustments }) {
  return simulate({ profile, goal, transactions, adjustments });
}

export async function mockGetDrift({ transactions, profile, goal, today }) {
  return { nudges: detectDrift({ transactions, profile, goal, today }) };
}

export async function mockWriteLetter({ summary }) {
  return getFallbackLetter(summary);
}

export async function mockAskFuture({ question, summary, history }) {
  return answerFutureQuestion({ question, summary, history });
}
