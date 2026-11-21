/**
 * @file lib/api-helper.js
 * Shared utilities for API route handlers (validation, body size checks, error handling).
 */

const MAX_BODY_BYTES = 300 * 1024; // 300 KB limit

/**
 * Safely parse JSON request body with max body size check.
 * @param {Request} req
 * @returns {Promise<{ ok: true, data: any } | { ok: false, error: string, status: number }>}
 */
async function parseJsonBody(req) {
  if (req.method !== 'POST') {
    return { ok: false, error: 'Method not allowed. Use POST.', status: 405 };
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return { ok: false, error: 'Payload too large. Maximum size is 300 KB.', status: 413 };
  }

  try {
    const rawText = await req.text();
    if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
      return { ok: false, error: 'Payload too large. Maximum size is 300 KB.', status: 413 };
    }

    if (!rawText.trim()) {
      return { ok: true, data: {} };
    }

    const data = JSON.parse(rawText);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: 'Invalid JSON request body.', status: 400 };
  }
}

/**
 * Standard error response.
 * @param {string} message
 * @param {number} [status=400]
 * @returns {Response}
 */
function errorResponse(message, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * Standard success response.
 * @param {any} data
 * @param {number} [status=200]
 * @returns {Response}
 */
function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
}

/**
 * Extract client IP from headers.
 * @param {Request} req
 * @returns {string}
 */
function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

module.exports = {
  MAX_BODY_BYTES,
  parseJsonBody,
  errorResponse,
  jsonResponse,
  getClientIp
};
