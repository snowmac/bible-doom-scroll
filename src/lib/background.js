// Shared animated background. Draws into any 2D context at any size, so the feed,
// the word flasher and the video recorder all use the same engine.

const TAU = Math.PI * 2;
export const KINDS = ['aurora', 'embers', 'stars', 'waves'];

function hueDiff(a, b) { return ((b - a + 540) % 360) - 180; }
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class Background {
  constructor() {
    this.kind = 'aurora';
    this.hue = 230; this.targetHue = 230;
    this.video = null; this.videoUrl = null;
    this.parts = null; this.partsFor = '';
    this.dim = 0.35;
  }

  setKind(k) { if (KINDS.includes(k)) { this.kind = k; this.parts = null; } }

  // Called when the active verse changes: glide to a new palette.
  shift(seedStr, n = 0) { this.targetHue = (hash(String(seedStr)) % 360 + n * 11) % 360; }

  setVideo(file) {
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
    if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
    this.video = null; this.videoUrl = null;
    if (!file) return;
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    this.videoUrl = URL.createObjectURL(file);
    v.src = this.videoUrl;
    v.play().catch(() => {});
    this.video = v;
  }

  #initParts(w, h) {
    const key = `${this.kind}:${w}x${h}`;
    if (this.parts && this.partsFor === key) return;
    this.partsFor = key;
    const r = Math.random;
    if (this.kind === 'embers') {
      this.parts = Array.from({ length: 90 }, () => ({ x: r() * w, y: r() * h, s: 1 + r() * 3.2, v: 18 + r() * 60, p: r() * TAU, a: 0.25 + r() * 0.6 }));
    } else if (this.kind === 'stars') {
      this.parts = Array.from({ length: 160 }, () => ({ x: r() * w, y: r() * h, z: 0.2 + r() * 0.8, p: r() * TAU }));
    } else this.parts = [];
  }

  draw(ctx, w, h, now = performance.now()) {
    const t = now / 1000;
    this.hue = (this.hue + hueDiff(this.hue, this.targetHue) * 0.02 + 360) % 360;
    const hue = this.hue;
    const u = Math.min(w, h);

    if (this.video && this.video.readyState >= 2 && this.video.videoWidth) {
      const vw = this.video.videoWidth, vh = this.video.videoHeight;
      const s = Math.max(w / vw, h / vh);
      ctx.drawImage(this.video, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
      ctx.fillStyle = `rgba(0,0,0,${this.dim + 0.1})`;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, `hsl(${hue} 55% 9%)`);
    base.addColorStop(1, `hsl(${(hue + 40) % 360} 55% 5%)`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    this.#initParts(w, h);

    if (this.kind === 'aurora') {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const x = w * (0.5 + 0.42 * Math.sin(t * (0.07 + i * 0.031) + i * 1.7));
        const y = h * (0.5 + 0.38 * Math.cos(t * (0.05 + i * 0.027) + i * 2.3));
        const rad = u * (0.55 + 0.2 * Math.sin(t * 0.11 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const hh = (hue + i * 38) % 360;
        g.addColorStop(0, `hsl(${hh} 80% 45% / 0.55)`);
        g.addColorStop(1, `hsl(${hh} 80% 30% / 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (this.kind === 'embers') {
      ctx.globalCompositeOperation = 'screen';
      for (const p of this.parts) {
        p.y -= p.v * 0.016 * (u / 600); p.x += Math.sin(t + p.p) * 0.3;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + p.p);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 5 * (u / 600));
        g.addColorStop(0, `hsl(${(hue + 20) % 360} 95% 65% / ${p.a * tw})`);
        g.addColorStop(1, `hsl(${hue} 90% 40% / 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.s * 6, p.y - p.s * 6, p.s * 12, p.s * 12);
      }
    } else if (this.kind === 'stars') {
      ctx.globalCompositeOperation = 'screen';
      for (const p of this.parts) {
        p.y += p.z * 0.5 * (u / 600); if (p.y > h) { p.y = 0; p.x = Math.random() * w; }
        const a = (0.35 + 0.65 * Math.abs(Math.sin(t * p.z * 2 + p.p))) * p.z;
        ctx.fillStyle = `hsl(${(hue + 30) % 360} 60% 85% / ${a})`;
        const s = (0.6 + p.z * 1.8) * (u / 600);
        ctx.fillRect(p.x, p.y, s, s);
      }
    } else if (this.kind === 'waves') {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const y0 = h * (0.35 + i * 0.12), amp = u * (0.05 + i * 0.012);
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += Math.max(8, w / 80)) {
          ctx.lineTo(x, y0 + Math.sin(x / (u * 0.18) + t * (0.4 + i * 0.1) + i) * amp);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = `hsl(${(hue + i * 25) % 360} 70% 40% / 0.14)`;
        ctx.fill();
      }
    }

    // vignette keeps text readable on every background
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(w / 2, h / 2, u * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${this.dim + 0.2})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
