/**
 * @file app/api/letter/route.js
 * Generates the "Future You" letter using Gemini or humanized fallback in English or Hindi.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse, getClientIp } from '@/lib/api-helper';
import { generateLetter, getFallbackLetter } from '@/lib/engine/letter';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const LetterSchema = z.object({
  summary: z.record(z.any()),
  lang: z.enum(['en', 'hi']).optional().default('en')
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = LetterSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { summary, lang } = validation.data;
  const activeLang = lang || summary?.lang || 'en';
  const clientIp = getClientIp(req);

  try {
    const letter = await generateLetter(summary, clientIp, activeLang);
    return jsonResponse(letter);
  } catch (err) {
    // Graceful fallback: never crash or 500 on letter failure
    return jsonResponse(getFallbackLetter(summary, activeLang));
  }
}
