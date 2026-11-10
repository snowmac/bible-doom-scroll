import { buildSchedule, indexAt, charOffsets } from './timeline.js';

// Narrators drive the video studio. Common interface:
//   start(), stop(), index (current word), done, progress (0..1), durationMs
export const TAIL_MS = 900;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class TimerNarrator {
  constructor(words, wpm, punct) {
    this.sched = buildSchedule(words, wpm, punct);
    this.durationMs = this.sched.total + TAIL_MS;
    this.t0 = 0; this.running = false;
  }
  start() { this.t0 = performance.now(); this.running = true; }
  stop() { this.running = false; }
  get elapsed() { return this.running ? performance.now() - this.t0 : 0; }
  get index() { return indexAt(this.sched.starts, this.elapsed); }
  get done() { return this.running && this.elapsed >= this.durationMs; }
  get progress() { return clamp(this.elapsed / this.durationMs, 0, 1); }
}

// Captions follow a pre-recorded narration file. Word timing is the text schedule
// stretched onto the real audio length (character/punctuation weighted, not forced alignment).
export class FileNarrator {
  // timings: optional [{start,end}] seconds per word from a voice service. When the count matches the
  // words, captions land on the spoken word exactly; otherwise fall back to the stretched estimate.
  constructor(words, audioEl, punct, nominalWpm, timings) {
    this.el = audioEl;
    this.exact = Array.isArray(timings) && timings.length === words.length && words.length > 0;
    if (timings && !this.exact) console.warn(`Voice timings (${timings.length}) do not match words (${words.length}); estimating`);
    if (this.exact) this.starts = timings.map((t) => t.start * 1000);
    else {
      const sched = buildSchedule(words, nominalWpm, punct);
      const scale = (audioEl.duration * 1000) / sched.total;
      this.starts = sched.starts.map((s) => s * scale);
    }
    this.durationMs = audioEl.duration * 1000 + TAIL_MS;
    this.ended = 0; this.running = false;
  }
  start() {
    this.running = true; this.ended = 0;
    this.el.currentTime = 0;
    this.el.onended = () => { this.ended = performance.now(); };
    this.el.play();
  }
  stop() { this.running = false; this.el.pause(); this.el.onended = null; }
  get index() { return indexAt(this.starts, this.el.currentTime * 1000); }
  get done() { return this.running && this.ended > 0 && performance.now() - this.ended > TAIL_MS; }
  get progress() { return clamp((this.el.currentTime * 1000) / this.durationMs, 0, 1); }
}

// Browser speech synthesis: useful for previewing pace. Its audio cannot be captured into a recording.
export class SpeechNarrator {
  constructor(words, wpm, punct) {
    this.words = words; this.offs = charOffsets(words);
    this.timer = new TimerNarrator(words, wpm, punct);
    this.rate = clamp(wpm / 170, 0.6, 1.8);
    this.durationMs = this.timer.durationMs;
    this.i = 0; this.gotBoundary = false; this.finished = 0; this.running = false; this.t0 = 0;
  }
  start() {
    this.running = true;
    const u = new SpeechSynthesisUtterance(this.words.map((w) => w.w).join(' '));
    u.rate = this.rate;
    u.onboundary = (e) => { if (e.name === 'word' || e.name == null) { this.gotBoundary = true; this.i = indexAt(this.offs, e.charIndex); } };
    u.onend = () => { this.finished = performance.now(); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    this.timer.start();
    this.t0 = performance.now();
  }
  stop() { this.running = false; speechSynthesis.cancel(); this.timer.stop(); }
  get index() { return this.gotBoundary || performance.now() - this.t0 < 2500 ? this.i : this.timer.index; }
  get done() { return this.running && ((this.finished && performance.now() - this.finished > TAIL_MS) || (!this.gotBoundary && this.timer.done)); }
  get progress() { return this.words.length ? this.index / this.words.length : 0; }
}
