/**
 * @file app/api/ask/route.js
 * Conversational Route Handler for asking Future You questions by voice or text.
 * Supports English and Hindi queries and responses.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse, getClientIp } from '@/lib/api-helper';
import { answerFutureQuestion, getGenericFallbackAnswer } from '@/lib/engine/ask';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const AskSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(200, 'Question too long (max 200 characters)'),
  summary: z.record(z.any()),
  history: z.array(
    z.object({
      q: z.string(),
      a: z.string()
    })
  ).max(3).optional().default([]),
  lang: z.enum(['en', 'hi']).optional().default('en')
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = AskSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { question, summary, history, lang } = validation.data;
  const activeLang = lang || summary?.lang || 'en';
  const clientIp = getClientIp(req);

  try {
    const result = await answerFutureQuestion({
      question,
      summary,
      history,
      clientIp,
      lang: activeLang
    });

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({
      answer: getGenericFallbackAnswer(summary, activeLang),
      source: 'fallback'
    });
  }
}
