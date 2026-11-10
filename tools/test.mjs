import assert from 'node:assert/strict';
import { tokenize, buildSchedule, indexAt, orp, refLabel, charOffsets } from '../src/lib/timeline.js';
import { parseNumberedText, LocalWebProvider } from '../src/lib/providers.js';
import fs from 'node:fs';

const verses = [{ref:'John 1:1',n:1,text:'In the beginning was the Word, and the Word was with God.'},{ref:'John 1:2',n:2,text:'The same was in the beginning.'}];
const words = tokenize(verses);
assert.equal(words.length, 18);
assert.equal(words[words.length-1].last, true);
const s = buildSchedule(words, 300);
assert.equal(s.starts[0], 0);
assert.equal(indexAt(s.starts, 0), 0);
assert.equal(indexAt(s.starts, s.total + 1000), words.length - 1);
assert.ok(s.starts[6] - s.starts[5] > 200, 'comma word lingers');
// wpm scaling
const fast = buildSchedule(words, 600);
assert.ok(Math.abs(fast.total * 2 - s.total) < 1e-6);
assert.deepEqual(orp('Word,'), ['W','o','rd,']);
assert.deepEqual(orp('a'), ['','a','']);
assert.deepEqual(orp('“Yahweh'), ['“Ya','h','weh']);
assert.equal(refLabel('John',1,1,1),'John 1:1');
assert.equal(refLabel('John',1,1,5),'John 1:1–5');
assert.equal(charOffsets(words)[1], 3);
const p = parseNumberedText('[1] In the beginning God created. [2] The earth was\n formless. [3] Last one.');
assert.deepEqual(p.map(v=>v.n),[1,2,3]);
assert.equal(p[1].text,'The earth was formless.');

// real data sanity
const prov = new LocalWebProvider();
const orig = globalThis.fetch;
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(new URL('../public/data/web.json', import.meta.url))) });
await prov.init(); globalThis.fetch = orig;
assert.equal(prov.books().length, 66);
const j = await prov.chapter('john', 1);
assert.equal(j.length, 51);
assert.match(j[0].text, /^In the beginning was the Word/);
const rev = await prov.chapter('revelation', 22);
assert.equal(rev.at(-1).n, 21);
let total = 0; for (const b of prov.books()) for (let c=1;c<=b.chapters;c++) total += (await prov.chapter(b.id,c)).length;
console.log('verses', total);
assert.ok(total > 31000);
console.log('ok');

// ---- voice: alignment, exact-timed narrator, worker ----
import { alignmentToWords, countWords } from '../src/lib/align.js';
import { FileNarrator } from '../src/lib/narrators.js';
import worker from '../worker/index.js';
{
  const text = 'In the beginning,  God';
  const chars = [...text];
  const st = chars.map((_, i) => i * 0.1), en = chars.map((_, i) => i * 0.1 + 0.1);
  const w = alignmentToWords({ characters: chars, character_start_times_seconds: st, character_end_times_seconds: en });
  assert.equal(w.length, 4); assert.equal(w.length, countWords(text));
  assert.ok(Math.abs(w[0].start - 0) < 1e-9 && Math.abs(w[0].end - 0.2) < 1e-9);
  assert.ok(Math.abs(w[2].start - 0.7) < 1e-9);          // "beginning," starts at char 7
  assert.ok(Math.abs(w[2].end - 1.7) < 1e-9);            // 10 chars incl. comma
  assert.throws(() => alignmentToWords({}), /alignment/);

  const words = tokenize([{ n: 1, ref: 'x 1:1', text: 'one two three' }]);
  const el = { duration: 3, currentTime: 0, play() {}, pause() {} };
  const exact = new FileNarrator(words, el, true, 170, [{ start: 0.2, end: 0.5 }, { start: 1.0, end: 1.4 }, { start: 2.1, end: 2.6 }]);
  assert.ok(exact.exact);
  el.currentTime = 0.1; assert.equal(exact.index, 0);
  el.currentTime = 1.05; assert.equal(exact.index, 1);
  el.currentTime = 2.2; assert.equal(exact.index, 2);
  const warn = console.warn; console.warn = () => {};
  const est = new FileNarrator(words, el, true, 170, [{ start: 0, end: 1 }]);
  console.warn = warn; assert.ok(!est.exact);

  const env = { ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v' };
  const post = (b) => new Request('https://w/tts', { method: 'POST', body: JSON.stringify(b) });
  const realFetch = globalThis.fetch; let seen;
  globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ audio_base64: 'QUJD', alignment: { characters: chars, character_start_times_seconds: st, character_end_times_seconds: en } })); };
  let r = await worker.fetch(post({ text }), env); let j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.words.length, 4); assert.equal(j.aligned, true); assert.equal(j.audio, 'QUJD');
  assert.match(seen.url, /text-to-speech\/v\/with-timestamps$/); assert.equal(seen.init.headers['xi-api-key'], 'k');
  assert.equal((await worker.fetch(post({ text: '' }), env)).status, 400);
  assert.equal((await worker.fetch(post({ text: 'a'.repeat(4001) }), env)).status, 413);
  assert.equal((await worker.fetch(post({ text }), {})).status, 500);
  globalThis.fetch = async () => new Response('nope', { status: 401 });
  assert.equal((await worker.fetch(post({ text }), env)).status, 502);
  globalThis.fetch = realFetch;
  console.log('voice ok');
}
