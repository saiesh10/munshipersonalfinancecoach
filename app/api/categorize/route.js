/**
 * @file app/api/categorize/route.js
 * Batch categorizes transactions using rules, keywords, and graceful Gemini fallback.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { categorizeBatch } from '@/lib/engine/categorizer';
import { CATEGORIES } from '@/lib/engine/categories';
import { categorizeUnknownMerchants } from '@/lib/engine/ai';

export const dynamic = 'force-dynamic';

const CategorizeSchema = z.object({
  transactions: z.array(z.any()),
  rules: z.array(z.any()).optional().default([])
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = CategorizeSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { transactions, rules } = validation.data;

  try {
    const categorized = await categorizeBatch(
      transactions,
      rules,
      keys => categorizeUnknownMerchants(keys, CATEGORIES)
    );

    return jsonResponse({ transactions: categorized });
  } catch (err) {
    return errorResponse('Failed to categorize transactions: ' + err.message, 500);
  }
}
