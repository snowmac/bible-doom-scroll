// WebAudio engine: generative ambient pad, optional music file, UI tick.
// Everything routes through `master`, which feeds both the speakers and a
// MediaStream destination so the video recorder can capture the same mix.

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() { this.ctx = null; this.amb = null; this.file = null; this.volume = 0.5; }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.ctx.destination);
      this.master.connect(this.dest);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  startAmbient() {
    const c = this.ensure();
    if (this.amb) return;
    const out = c.createGain();
    out.gain.setValueAtTime(0, c.currentTime);
    out.gain.linearRampToValueAtTime(0.28, c.currentTime + 3);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.7;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 380;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();

    const delay = c.createDelay(1.5); delay.delayTime.value = 0.47;
    const fb = c.createGain(); fb.gain.value = 0.42;
    delay.connect(fb); fb.connect(delay);
    lp.connect(out); lp.connect(delay); delay.connect(out); out.connect(this.master);

    const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]];
    const oscs = [lfo];
    const voices = chords[0].map(() => {
      const o1 = c.createOscillator(), o2 = c.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      o1.detune.value = -7; o2.detune.value = 6;
      const g = c.createGain(); g.gain.value = 0.11;
      o1.connect(g); o2.connect(g); g.connect(lp);
      o1.start(); o2.start(); oscs.push(o1, o2);
      return [o1, o2];
    });
    let step = 0;
    const play = () => {
      const ch = chords[step++ % chords.length];
      voices.forEach(([a, b], i) => {
        const f = midi(ch[i]);
        a.frequency.setTargetAtTime(f, c.currentTime, 0.7);
        b.frequency.setTargetAtTime(f, c.currentTime, 0.7);
      });
    };
    play();
    const timer = setInterval(play, 8000);
    this.amb = { out, oscs, timer };
  }

  stopAmbient() {
    if (!this.amb) return;
    const { out, oscs, timer } = this.amb;
    clearInterval(timer);
    const c = this.ctx;
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.setTargetAtTime(0, c.currentTime, 0.4);
    setTimeout(() => oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }), 2000);
    this.amb = null;
  }

  async startFile(file) {
    const c = this.ensure();
    this.stopFile();
    const buf = await c.decodeAudioData(await file.arrayBuffer());
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = c.createGain(); g.gain.value = 0.9;
    src.connect(g); g.connect(this.master);
    src.start();
    this.file = { src, g };
  }

  stopFile() {
    if (!this.file) return;
    try { this.file.src.stop(); } catch { /* ignore */ }
    this.file = null;
  }

  // Route an <audio> element (narration) into the same mix so it gets recorded.
  connectElement(el) {
    const c = this.ensure();
    if (!el._src) { el._src = c.createMediaElementSource(el); el._src.connect(this.master); }
  }

  tick() {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(c.currentTime + 0.06);
  }

  // music selection helper used by the UI: 'off' | 'ambient' | 'file'
  async apply(mode, file) {
    if (mode === 'ambient') { this.stopFile(); this.startAmbient(); }
    else if (mode === 'file' && file) { this.stopAmbient(); await this.startFile(file); }
    else { this.stopAmbient(); this.stopFile(); }
  }
}
