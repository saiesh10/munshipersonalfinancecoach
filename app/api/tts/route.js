/**
 * @file app/api/tts/route.js
 * Zero-cost, high-fidelity neural Text-to-Speech audio streaming endpoint.
 * Fetches realistic, natural human voice in English (en-IN) and Hindi (hi).
 */

export const dynamic = 'force-dynamic';

/**
 * Split text into chunks <= maxLen characters on word boundaries
 * to comply with Google Translate TTS length restrictions.
 */
function splitIntoTtsChunks(text, maxLen = 160) {
  if (!text || text.length <= maxLen) return [text.trim()];
  const words = text.trim().split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxLen) {
      current += ' ' + word;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'en-IN';

  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: 'Text parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Clean text and cap total length
  const cleanText = text.trim().slice(0, 1000);
  const ttsLang = lang.toLowerCase().startsWith('hi') ? 'hi' : 'en-IN';
  const chunks = splitIntoTtsChunks(cleanText, 160);

  try {
    const audioBuffers = [];

    for (const chunk of chunks) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${ttsLang}&client=tw-ob`;
      const upstreamRes = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!upstreamRes.ok) {
        throw new Error(`Upstream TTS returned ${upstreamRes.status}`);
      }

      const buf = await upstreamRes.arrayBuffer();
      audioBuffers.push(Buffer.from(buf));
    }

    if (audioBuffers.length === 0) {
      return new Response(JSON.stringify({ error: 'No audio generated' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const combined = Buffer.concat(audioBuffers);

    return new Response(combined, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to stream TTS audio: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
