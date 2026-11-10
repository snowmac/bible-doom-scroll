// Canvas caption renderer for the video studio (viral-style word captions).

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// anim: { lastChunk, chunkSince } mutable pop-animation state owned by the caller
export function drawCaption(c, w, h, now, { words, i, n, upper, highlight, progress, label, attribution }, anim) {
  const u = w / 1080;
  const ci = Math.floor(i / n);
  if (ci !== anim.lastChunk) { anim.lastChunk = ci; anim.chunkSince = now; }
  const chunk = words.slice(ci * n, ci * n + n);
  const text = (x) => (upper ? x.w.toUpperCase() : x.w);
  const pop = 0.82 + 0.18 * easeOutBack(clamp((now - anim.chunkSince) / 170, 0, 1));

  let fs = [0, 170, 140, 118, 100][n] * u;
  const font = () => `900 ${fs}px "Arial Black", Impact, system-ui, sans-serif`;
  c.save();
  c.font = font(); c.textBaseline = 'middle'; c.lineJoin = 'round';
  const widthOf = (ws) => ws.reduce((a, x) => a + c.measureText(text(x)).width, 0) + c.measureText(' ').width * (ws.length - 1);
  let lines = [chunk];
  if (chunk.length > 1 && widthOf(chunk) > w * 0.86) {
    const mid = Math.ceil(chunk.length / 2);
    lines = [chunk.slice(0, mid), chunk.slice(mid)];
  }
  const maxW = Math.max(...lines.map(widthOf));
  if (maxW > w * 0.86) { fs *= (w * 0.86) / maxW; c.font = font(); }

  const lh = fs * 1.18, y0 = h * 0.5 - (lines.length * lh) / 2 + lh / 2;
  c.translate(w / 2, h / 2); c.scale(pop, pop); c.translate(-w / 2, -h / 2);
  c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = fs * 0.14;
  const spaceW = c.measureText(' ').width;
  let k = 0;
  lines.forEach((ln, li) => {
    let x = (w - widthOf(ln)) / 2;
    for (const wd of ln) {
      const t = text(wd), tw = c.measureText(t).width;
      const hot = highlight && n > 1 && ci * n + k === i;
      c.lineWidth = fs * 0.2; c.strokeStyle = '#000'; c.textAlign = 'left';
      c.strokeText(t, x, y0 + li * lh);
      c.fillStyle = hot ? '#ffd84a' : '#fff';
      c.fillText(t, x, y0 + li * lh);
      x += tw + spaceW; k++;
    }
  });
  c.restore();

  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${46 * u}px system-ui, sans-serif`;
  c.fillStyle = 'rgba(255,255,255,.92)'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10 * u;
  c.fillText(`${words[i].ref}  ·  ${label}`.toUpperCase(), w / 2, h * 0.11);
  c.font = `500 ${28 * u}px system-ui, sans-serif`;
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.fillText(attribution, w / 2, h * 0.955);
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillRect(0, h - 10 * u, w * progress, 10 * u);
}
