/**
 * @file app/api/learn/route.js
 * Derives and retroactively applies merchant categorization rules.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { deriveRule, applyRule } from '@/lib/engine/learn';

export const dynamic = 'force-dynamic';

const LearnSchema = z.object({
  transaction: z.object({
    id: z.string(),
    merchantKey: z.string().optional()
  }).passthrough(),
  category: z.string().min(1),
  transactions: z.array(z.any()),
  rules: z.array(z.any()).optional().default([])
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = LearnSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { transaction, category, transactions } = validation.data;

  try {
    const derived = deriveRule(transaction, category);
    const result = applyRule(derived, transactions, transaction.id);

    return jsonResponse({
      rule: result.rule,
      transactions: result.transactions,
      affectedCount: result.affectedCount
    });
  } catch (err) {
    return errorResponse('Failed to learn rule: ' + err.message, 500);
  }
}
