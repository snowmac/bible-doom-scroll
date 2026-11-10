// Mock voice service with known word timings, for testing the sync + recording pipeline without an API key.
// Each word becomes a tone burst whose length depends on the word. Usage: node tools/mock-tts.mjs [port]
import http from 'node:http';

const SR = 22050;

export function synth(words) {
  let t = 0.15;
  const timings = [], segs = [];
  for (const w of words) {
    const dur = 0.12 + 0.045 * w.length;
    timings.push({ start: +t.toFixed(4), end: +(t + dur).toFixed(4) });
    segs.push({ t, dur, f: 300 + (w.charCodeAt(0) % 12) * 40 });
    t += dur + 0.07;
  }
  const n = Math.floor((t + 0.2) * SR);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (const s of segs) {
    const a = Math.floor(s.t * SR), len = Math.floor(s.dur * SR);
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / 200, (len - i) / 200);
      buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * s.f * i) / SR) * 9000 * env), 44 + (a + i) * 2);
    }
  }
  return { wav: buf, timings };
}

export function serve(port) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405, cors); return res.end(); }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const { text = '' } = JSON.parse(raw || '{}');
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length) { res.writeHead(400, { ...cors, 'content-type': 'application/json' }); return res.end('{"error":"text is required"}'); }
      const { wav, timings } = synth(words);
      res.writeHead(200, { ...cors, 'content-type': 'application/json' });
      res.end(JSON.stringify({ audio: wav.toString('base64'), mime: 'audio/wav', words: timings, aligned: true }));
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  const port = Number(process.argv[2]) || 8787;
  await serve(port);
  console.log('mock tts on', port);
}
