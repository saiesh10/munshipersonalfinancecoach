/**
 * @file app/api/drift/route.js
 * Detects mid-month spending drift and generates proactive nudges.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { detectDrift } from '@/lib/engine/drift';

export const dynamic = 'force-dynamic';

const DriftSchema = z.object({
  transactions: z.array(z.any()).default([]),
  profile: z.object({
    monthlyIncome: z.number().default(0),
    fixedCosts: z.any().optional().default(0)
  }).passthrough(),
  goal: z.object({
    targetAmount: z.number().default(0),
    targetDate: z.string().default(''),
    saved: z.number().optional().default(0)
  }).passthrough(),
  today: z.string().optional()
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = DriftSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { transactions, profile, goal, today } = validation.data;

  try {
    const nudges = detectDrift({
      transactions,
      profile,
      goal,
      today: today || new Date()
    });

    return jsonResponse({ nudges });
  } catch (err) {
    return errorResponse('Failed to detect spend drift: ' + err.message, 500);
  }
}
