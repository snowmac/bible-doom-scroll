// Client for the voice endpoint (see worker/index.js). Results are cached per text so Preview then Record
// does not pay for the same audio twice.
export const MAX_TTS_CHARS = 4000;

const cache = new Map();

export async function synthesize(endpoint, text, voiceId = '') {
  const key = `${endpoint}|${voiceId}|${text}`;
  if (cache.has(key)) return cache.get(key);

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voiceId: voiceId || undefined }),
  });
  if (!r.ok) {
    let msg = `Voice service returned ${r.status}`;
    try { msg = (await r.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const j = await r.json();
  const bin = atob(j.audio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: j.mime || 'audio/mpeg' });
  const out = { blob, url: URL.createObjectURL(blob), words: j.words || [] };

  cache.set(key, out);
  if (cache.size > 6) {
    const oldest = cache.keys().next().value;
    URL.revokeObjectURL(cache.get(oldest).url);
    cache.delete(oldest);
  }
  return out;
}

export function audioElementFor(url) {
  const el = new Audio(url);
  el.preload = 'auto';
  return new Promise((resolve, reject) => {
    el.onloadedmetadata = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode the voice audio'));
  });
}
