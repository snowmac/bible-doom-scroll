import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getState, setState, useStore, touchStreak } from '../lib/store.js';
import { tokenize, buildSchedule, indexAt, orp } from '../lib/timeline.js';
import { useEngine } from '../engine.js';

const PRESETS = [200, 300, 450, 600, 800];

// Rapid serial visual presentation: one word (or a small chunk) at a time at an adjustable WPM.
export default function FlashReader({ autoplay = false } = {}) {
  const { provider, bg, audio, setRef } = useEngine();
  const wpm = useStore((s) => s.wpm);
  const n = useStore((s) => s.chunk);
  const showCtx = useStore((s) => s.context);
  const punct = useStore((s) => s.punct);
  const hideControls = useStore((s) => s.hideControls);

  const [data, setData] = useState({ words: [], book: '', chapter: 0, name: '' });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const idxRef = useRef(0);
  const timing = useRef({ offset: 0, startedAt: 0 });

  const { words } = data;
  const sched = useMemo(() => buildSchedule(words, wpm, punct), [words, wpm, punct]);
  const schedRef = useRef(sched);
  schedRef.current = sched;

  const loadChapter = useCallback(async (book, chapter, verse = 1) => {
    const name = provider.books().find((b) => b.id === book)?.name || book;
    const verses = (await provider.chapter(book, chapter)).map((v) => ({ ...v, ref: `${name} ${chapter}:${v.n}` }));
    const ws = tokenize(verses);
    const vi = Math.max(0, verses.findIndex((v) => v.n === verse));
    const start = Math.max(0, ws.findIndex((w) => w.vi === vi));
    idxRef.current = start;          // set before the sched effect below reads it
    setIdx(start);
    setData({ words: ws, book, chapter, name });
    setState({ book, chapter });
  }, [provider]);

  useEffect(() => {
    const s = getState();
    loadChapter(s.book, s.chapter, s.verse).then(() => { if (autoplay) setPlaying(true); });
  }, [loadChapter, autoplay]);

  // any schedule change (new chapter, wpm slider, punctuation toggle) re-anchors timing at the current word
  useEffect(() => {
    timing.current = { offset: sched.starts[idxRef.current] || 0, startedAt: performance.now() };
  }, [sched]);

  const seek = useCallback((i) => {
    const k = Math.max(0, Math.min(words.length - 1, i));
    idxRef.current = k; setIdx(k);
    timing.current = { offset: schedRef.current.starts[k] || 0, startedAt: performance.now() };
  }, [words.length]);

  const nextChapter = useCallback(async () => {
    const bs = provider.books();
    const bi = bs.findIndex((b) => b.id === data.book);
    let b = data.book, c = data.chapter + 1;
    if (c > bs[bi].chapters) { if (bi + 1 >= bs.length) return; b = bs[bi + 1].id; c = 1; }
    await loadChapter(b, c, 1);
    setPlaying(true);
  }, [provider, data.book, data.chapter, loadChapter]);

  // the clock
  useEffect(() => {
    if (!playing) return undefined;
    audio.ensure();
    touchStreak();
    timing.current = { offset: schedRef.current.starts[idxRef.current] || 0, startedAt: performance.now() };
    let raf = 0;
    const loop = (now) => {
      const s = schedRef.current;
      const t = timing.current.offset + (now - timing.current.startedAt);
      if (t >= s.total) { setPlaying(false); nextChapter(); return; }
      const i = indexAt(s.starts, t);
      if (i !== idxRef.current) { idxRef.current = i; setIdx(i); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, audio, nextChapter]);

  const w = words[idx];

  // follow the verse: label, position, background drift
  useEffect(() => {
    if (!w) return;
    setRef(w.ref);
    setState({ verse: w.n });
    bg.shift(`${data.book}${data.chapter}`, w.n);
  }, [w?.vi, data.book, data.chapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const verseStart = useMemo(() => {
    if (!w) return 0;
    let i = idx;
    while (i > 0 && words[i - 1].vi === w.vi) i--;
    return i;
  }, [idx, w, words]);

  const seekVerse = (dir) => {
    if (!w) return;
    const vi = dir > 0 ? w.vi + 1 : (idx - verseStart > 3 ? w.vi : w.vi - 1);
    const target = words.findIndex((x) => x.vi === Math.max(0, vi));
    if (target >= 0) seek(target);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === 'ArrowLeft') seek(idxRef.current - 10);
      if (e.key === 'ArrowRight') seek(idxRef.current + 10);
      if (e.key === 'ArrowUp') setState({ wpm: Math.min(1000, getState().wpm + 20) });
      if (e.key === 'ArrowDown') setState({ wpm: Math.max(100, getState().wpm - 20) });
      if (e.key === 'c') setState({ hideControls: !getState().hideControls });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seek]);

  if (!w) return <div className="flash"><div className="f-stage" /></div>;

  const chunkWords = words.slice(Math.floor(idx / n) * n, Math.floor(idx / n) * n + n);
  const [a, f, z] = orp(w.w);
  const verseWords = [];
  for (let i = verseStart; i < words.length && words[i].vi === w.vi; i++) verseWords.push(words[i].w);
  const minLeft = Math.max(0, Math.round((sched.total - (sched.starts[idx] || 0)) / 60000));

  return (
    <div className={`flash${hideControls ? ' hc' : ''}`}>
      <div className="f-ref">{w.ref}</div>

      <button type="button" className="f-stage" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
        <span className="f-guide" />
        {n === 1
          ? <span className="f-word orp" style={{ '--len': Math.max(6, w.w.length) }}><span className="a">{a}</span><span className="f">{f}</span><span className="z">{z}</span></span>
          : <span className="f-word plain">{chunkWords.map((x) => x.w).join(' ')}</span>}
        <span className="f-guide bottom" />
      </button>

      {showCtx && (
        <p className="f-context">
          {verseWords.map((t, i) => <span key={i} className={verseStart + i === idx ? 'on' : ''}>{t} </span>)}
        </p>
      )}

      <div className="f-bar"><i style={{ width: `${(idx / Math.max(1, words.length - 1)) * 100}%` }} /></div>

      {hideControls ? (
        <button type="button" className="f-peek" onClick={() => setState({ hideControls: false })} aria-label="Show controls">
          <Icon name="up" size={18} /> Controls
        </button>
      ) : (
      <div className="f-controls">
        <button type="button" className="f-handle" onClick={() => setState({ hideControls: true })} aria-label="Hide controls">
          <Icon name="down" size={24} />
        </button>
        <div className="row transport">
          <button type="button" onClick={() => seekVerse(-1)} aria-label="Previous verse"><Icon name="prev" /></button>
          <button type="button" onClick={() => seek(idx - 10)} aria-label="Back 10 words">−10</button>
          <button type="button" className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={30} fill />
          </button>
          <button type="button" onClick={() => seek(idx + 10)} aria-label="Forward 10 words">+10</button>
          <button type="button" onClick={() => seekVerse(1)} aria-label="Next verse"><Icon name="next" /></button>
        </div>

        <div className="speed">
          <div className="speed-top"><b>{wpm} wpm</b><span>{minLeft ? `~${minLeft} min left in chapter` : 'chapter almost done'}</span></div>
          <input type="range" min="100" max="1000" step="10" value={wpm} onChange={(e) => setState({ wpm: Number(e.target.value) })} aria-label="Words per minute" />
          <div className="chips">
            {PRESETS.map((p) => <button key={p} type="button" className={p === wpm ? 'on' : ''} onClick={() => setState({ wpm: p })}>{p}</button>)}
          </div>
        </div>

        <div className="row opts">
          <div className="seg" role="group" aria-label="Words at once">
            {[1, 2, 3].map((k) => <button key={k} type="button" className={k === n ? 'on' : ''} onClick={() => setState({ chunk: k })}>{k} word{k > 1 ? 's' : ''}</button>)}
          </div>
          <label className="chk"><input type="checkbox" checked={showCtx} onChange={(e) => setState({ context: e.target.checked })} /> Context</label>
          <label className="chk"><input type="checkbox" checked={punct} onChange={(e) => setState({ punct: e.target.checked })} /> Pause on punctuation</label>
        </div>
      </div>
      )}
    </div>
  );
}
