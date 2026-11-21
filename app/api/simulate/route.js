/**
 * @file app/api/simulate/route.js
 * Runs deterministic multi-month financial simulations with what-if scenarios.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { simulate } from '@/lib/engine/simulate';

export const dynamic = 'force-dynamic';

const SimulateSchema = z.object({
  profile: z.object({
    monthlyIncome: z.number().default(0),
    fixedCosts: z.any().optional().default(0),
    name: z.string().optional()
  }).passthrough(),
  goal: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    targetAmount: z.number().default(0),
    targetDate: z.string().default(''),
    saved: z.number().optional().default(0)
  }).passthrough(),
  transactions: z.array(z.any()).optional().default([]),
  adjustments: z.array(z.any()).optional().default([]),
  today: z.string().optional()
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = SimulateSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { profile, goal, transactions, adjustments, today } = validation.data;

  try {
    const projection = simulate({
      profile,
      goal,
      transactions,
      adjustments,
      today: today || new Date()
    });

    return jsonResponse(projection);
  } catch (err) {
    return errorResponse('Failed to run simulation: ' + err.message, 500);
  }
}
