/**
 * @file app/api/parse/route.js
 * Parses SMS messages or CSV bank statements into standard Transactions.
 * Seamlessly extracts transactions from uploaded text files, SMS dumps, and bank CSVs with AI fallback.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { parseInputText } from '@/lib/engine/parser';
import { parseCsv } from '@/lib/engine/csv';
import { parseUnreadableSmsLines } from '@/lib/engine/ai';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const ParseSchema = z.object({
  text: z.string().optional(),
  csv: z.string().optional()
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = ParseSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { text, csv } = validation.data;
  if (!text && !csv) {
    return errorResponse('Either text or csv field must be provided', 400);
  }

  try {
    const allTransactions = [];
    const allUnparsed = [];
    const seenIds = new Set();

    const addTxn = (t) => {
      if (t && t.id && !seenIds.has(t.id)) {
        seenIds.add(t.id);
        allTransactions.push(t);
      }
    };

    // 1. Process CSV input (if provided)
    if (csv && csv.trim()) {
      const csvResult = parseCsv(csv);

      if (csvResult.transactions.length > 0) {
        for (const t of csvResult.transactions) {
          addTxn(t);
        }

        // If there were any unparsed rows from the CSV statement, try extracting with SMS parser + AI
        if (csvResult.unparsed.length > 0) {
          const unparsedText = csvResult.unparsed.join('\n');
          const unparsedResult = await parseInputText(unparsedText, parseUnreadableSmsLines);
          for (const t of unparsedResult.transactions) {
            addTxn(t);
          }
          allUnparsed.push(...unparsedResult.unparsed);
        }
      } else {
        // If CSV parsing found 0 transactions (e.g. uploaded file was an SMS text dump, .txt file, or unformatted messages),
        // seamlessly treat the entire content as text messages and run regex + AI parsing!
        const textFallbackResult = await parseInputText(csv, parseUnreadableSmsLines);
        for (const t of textFallbackResult.transactions) {
          addTxn(t);
        }
        allUnparsed.push(...textFallbackResult.unparsed);
      }
    }

    // 2. Process text input (if provided)
    if (text && text.trim()) {
      const textResult = await parseInputText(text, parseUnreadableSmsLines);

      // If text parser found 0 transactions and content looks like a CSV table, try CSV parser as fallback
      if (textResult.transactions.length === 0 && text.includes(',') && text.includes('\n')) {
        const csvFallbackResult = parseCsv(text);
        if (csvFallbackResult.transactions.length > 0) {
          for (const t of csvFallbackResult.transactions) {
            addTxn(t);
          }
          allUnparsed.push(...csvFallbackResult.unparsed);
        } else {
          allUnparsed.push(...textResult.unparsed);
        }
      } else {
        for (const t of textResult.transactions) {
          addTxn(t);
        }
        allUnparsed.push(...textResult.unparsed);
      }
    }

    // Deduplicate unparsed lines and filter out any empty lines
    const parsedRawTexts = new Set(allTransactions.map(t => (t.rawText || '').trim()));
    const uniqueUnparsed = Array.from(new Set(
      allUnparsed
        .map(u => (typeof u === 'string' ? u.trim() : ''))
        .filter(u => u.length > 0 && !parsedRawTexts.has(u))
    ));

    return jsonResponse({
      transactions: allTransactions,
      unparsed: uniqueUnparsed
    });
  } catch (err) {
    return errorResponse(err.message || 'Failed to parse transactions', 500);
  }
}
