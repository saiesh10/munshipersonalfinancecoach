/**
 * @file app/api/recurring/route.js
 * Detects recurring subscriptions, price creep, and unutilized memberships.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { detectRecurring } from '@/lib/engine/recurring';

export const dynamic = 'force-dynamic';

const RecurringSchema = z.object({
  transactions: z.array(z.any())
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = RecurringSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { transactions } = validation.data;

  try {
    const subscriptions = detectRecurring(transactions);
    return jsonResponse({ subscriptions });
  } catch (err) {
    return errorResponse('Failed to detect recurring subscriptions: ' + err.message, 500);
  }
}
