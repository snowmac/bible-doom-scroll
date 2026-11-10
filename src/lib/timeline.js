// Pure helpers: tokenizing passages into timed words. No DOM, unit-testable in node.

const SOFT = /[,;:—–)”"']$/;
const HARD = /[.!?…]["”’')]*$/;

export function tokenize(verses) {
  // verses: [{ref, n, text}] -> [{w, vi, ref, last, pause}]
  const words = [];
  verses.forEach((v, vi) => {
    const parts = v.text.split(/\s+/).filter(Boolean);
    parts.forEach((w, i) => {
      const last = i === parts.length - 1;
      let pause = 1;
      if (HARD.test(w)) pause = 2.0;
      else if (SOFT.test(w)) pause = 1.5;
      else if (w.length > 9) pause = 1.25;
      if (last) pause += 0.4;
      words.push({ w, vi, ref: v.ref, n: v.n, last, pause });
    });
  });
  return words;
}

export function buildSchedule(words, wpm, punct = true) {
  const base = 60000 / Math.max(30, wpm);
  const starts = new Array(words.length);
  let t = 0;
  for (let i = 0; i < words.length; i++) {
    starts[i] = t;
    t += base * (punct ? words[i].pause : 1);
  }
  return { starts, total: t, base };
}

export function indexAt(starts, t) {
  // last index with starts[i] <= t
  let lo = 0, hi = starts.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

// Optimal recognition point split for single-word flashing.
export function orp(word) {
  const m = word.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
  const lead = m ? m[1] : '', core = m ? m[2] : word, trail = m ? m[3] : '';
  const len = core.length;
  const k = len <= 1 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : len <= 13 ? 3 : 4;
  return [lead + core.slice(0, k), core.charAt(k) || '', core.slice(k + 1) + trail];
}

export function refLabel(bookName, chapter, from, to) {
  if (from == null) return `${bookName} ${chapter}`;
  return from === to ? `${bookName} ${chapter}:${from}` : `${bookName} ${chapter}:${from}–${to}`;
}

// char offset -> word index for speech boundary sync
export function charOffsets(words) {
  const offs = []; let pos = 0;
  for (const w of words) { offs.push(pos); pos += w.w.length + 1; }
  return offs;
}
