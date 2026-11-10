// Cloudflare Worker: provider-neutral voice endpoint.
//   POST /tts  { text, voiceId? }  ->  { audio: <base64>, mime, words: [{start, end}], aligned: boolean }
// Only this file knows about the TTS provider (ElevenLabs here). Swap the provider call to change vendors.
// NOT yet run against the live ElevenLabs API (no key was available when this was written).
import { alignmentToWords, countWords } from '../src/lib/align.js';

const MAX_CHARS = 4000;

export default {
  async fetch(req, env) {
    const cors = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    const send = (body, status = 200) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status, headers: { ...cors, 'content-type': 'application/json' },
      });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return send({ error: 'POST only' }, 405);

    let body;
    try { body = await req.json(); } catch { return send({ error: 'Invalid JSON' }, 400); }
    const text = String(body.text || '').trim();
    if (!text) return send({ error: 'text is required' }, 400);
    if (text.length > MAX_CHARS) return send({ error: `text over ${MAX_CHARS} characters` }, 413);

    const voice = body.voiceId || env.ELEVENLABS_VOICE_ID;
    if (!voice || !env.ELEVENLABS_API_KEY) return send({ error: 'Worker is missing ELEVENLABS_API_KEY or a voice id' }, 500);

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps`, {
      method: 'POST',
      // Auth header name is not on the docs page I read; xi-api-key is ElevenLabs' documented convention. Verify on first run.
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' }),
    });
    if (!r.ok) return send({ error: `Voice provider returned ${r.status}`, detail: (await r.text()).slice(0, 500) }, 502);

    const j = await r.json();
    let words;
    try { words = alignmentToWords(j.alignment); } catch (e) { return send({ error: e.message }, 502); }
    return send({ audio: j.audio_base64, mime: 'audio/mpeg', words, aligned: words.length === countWords(text) });
  },
};
